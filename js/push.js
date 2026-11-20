// Notificações push reais (chegam com o app FECHADO) via Firebase Cloud Messaging.
// O envio é feito pelo Google Apps Script (integrations/google-apps-script).
// Requer: settings/{chave}/push = { messagingSenderId, appId, vapidKey }.

import * as db from './firebase-db.js';

const MESSAGING_SDK = 'https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Falha ao carregar ' + src));
    document.head.appendChild(s);
  });
}

export function isPushConfigured(settings) {
  const p = settings && settings.push;
  return Boolean(p && p.messagingSenderId && p.appId && p.vapidKey);
}

export function pushSupportStatus() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'Este navegador não suporta push. No iPhone, instale o app na Tela de Início (iOS 16.4+).' };
  }
  if (db.isLocalMode()) return { ok: false, reason: 'Push exige o Firebase conectado (não funciona no Modo Local).' };
  return { ok: true, reason: '' };
}

// Registra o aparelho e salva o token em push/{chave}/{usuário}
export async function enablePush(settings, user) {
  const status = pushSupportStatus();
  if (!status.ok) throw new Error(status.reason);
  if (!isPushConfigured(settings)) throw new Error('Configure Sender ID, App ID e chave VAPID primeiro.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permissão de notificação negada.');

  await loadScript(MESSAGING_SDK);
  const config = db.getActiveConfig();
  const fullConfig = {
    ...config.firebaseConfig,
    messagingSenderId: settings.push.messagingSenderId,
    appId: settings.push.appId
  };

  // App separado para o Messaging, para não mexer na instância do Realtime Database
  const app = firebase.apps.find(a => a.name === 'push') || firebase.initializeApp(fullConfig, 'push');
  const messaging = firebase.messaging(app);
  const registration = await navigator.serviceWorker.ready;
  const token = await messaging.getToken({
    vapidKey: settings.push.vapidKey,
    serviceWorkerRegistration: registration
  });
  if (!token) throw new Error('Não foi possível obter o token de push.');

  await db.savePushToken(user, token, {
    device: (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || 'web',
    ua: navigator.userAgent.slice(0, 120)
  });
  try { localStorage.setItem('tasklist_push_enabled_for', user); } catch (e) { /* ignore */ }
  return token;
}

export function isPushEnabledHere(user) {
  try { return localStorage.getItem('tasklist_push_enabled_for') === user && Notification.permission === 'granted'; } catch (e) { return false; }
}
