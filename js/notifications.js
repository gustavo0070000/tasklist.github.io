// Notifications management module for Tasklist
import { playSound } from './effects.js';

let lastLoggedId = null;
let lastKnownReactions = {}; // logId -> stringified reactions

// Initialize notifications state
export function initNotifications(initialHistory) {
  if (initialHistory && initialHistory.length > 0) {
    lastLoggedId = initialHistory[0].id;
    initialHistory.forEach(log => {
      lastKnownReactions[log.id] = JSON.stringify(log.reactions || {});
    });
  }
}

// Get human-readable status of browser notification support
export function getNotificationStatus() {
  if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    return { supported: false, state: 'insecure', reason: 'Notificações exigem conexão segura (HTTPS).' };
  }
  if (!('Notification' in window)) {
    return { supported: false, state: 'unsupported', reason: 'Este navegador não suporta notificações (no iPhone, adicione à Tela de Início).' };
  }
  return { supported: true, state: Notification.permission, reason: '' };
}

// Request permission to send notifications
export function requestPermission() {
  const status = getNotificationStatus();
  if (!status.supported) {
    return Promise.resolve(status.state);
  }
  return Notification.requestPermission().then(permission => permission);
}

// Play a sweet, soft zen chime (respects sound toggle via effects.js)
export function playZenChime() {
  playSound('chime');
}

// Display a browser Notification and play sound
export function showNotification(title, body) {
  playZenChime();

  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  try {
    const options = {
      body,
      icon: 'assets/icon-192.png',
      badge: 'assets/favicon.png',
      vibrate: [100, 50, 100],
      tag: 'tasklist-alert'
    };

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(title, options);
      });
    } else {
      new Notification(title, options);
    }
  } catch (e) {
    console.error('Error displaying notification:', e);
  }
}

function displayActor(log) {
  if (log.via === 'alexa') return 'Alexa';
  if (log.user === 'Gus') return 'Gustavo';
  if (log.user === 'Isa') return 'Isabella';
  if (log.via === 'painel') return 'O painel';
  if (log.user === 'Shared') return 'Vocês';
  return log.user || 'Alguém';
}

// Check history logs for new activities by the OTHER user
export function checkNewActivities(history, currentUser) {
  if (!history || history.length === 0) return;

  const latestLog = history[0];

  if (lastLoggedId === null) {
    lastLoggedId = latestLog.id;
    return;
  }

  if (latestLog.id !== lastLoggedId) {
    const newLogs = [];
    for (const log of history) {
      if (log.id === lastLoggedId) break;
      newLogs.push(log);
    }

    lastLoggedId = latestLog.id;

    const externalLogs = newLogs.filter(log => log.user !== currentUser);
    if (externalLogs.length > 0) {
      const logToNotify = { ...externalLogs[0], user: displayActor(externalLogs[0]) };
      const title = 'Tasklist — Gustavo & Isabella';
      let body = '';

      switch (logToNotify.action) {
        case 'add_task':
          body = `${logToNotify.user} adicionou: "${logToNotify.taskTitle}" em "${logToNotify.listName || 'Tarefas'}"`;
          break;
        case 'complete_task':
          body = `${logToNotify.user} concluiu: "${logToNotify.taskTitle}" ✅`;
          break;
        case 'uncomplete_task':
          body = `${logToNotify.user} reabriu: "${logToNotify.taskTitle}"`;
          break;
        case 'delete_task':
          body = `${logToNotify.user} removeu a tarefa: "${logToNotify.taskTitle}"`;
          break;
        case 'add_list':
          body = `${logToNotify.user} criou a lista: "${logToNotify.listName}"`;
          break;
        case 'delete_list':
          body = `${logToNotify.user} excluiu a lista: "${logToNotify.listName}"`;
          break;
        case 'add_note':
          body = `${logToNotify.user} deixou um recado no Mural 💌`;
          break;
        case 'add_wish':
          body = `${logToNotify.user} adicionou um desejo: "${logToNotify.wishTitle}" 🎁`;
          break;
        case 'add_project':
          body = `${logToNotify.user} criou uma nova meta: "${logToNotify.projectName}" 🚀`;
          break;
        case 'nudge':
          body = `${logToNotify.user} enviou: ${logToNotify.nudgeText}`;
          break;
        default:
          body = `${logToNotify.user} atualizou a lista de tarefas.`;
      }

      showNotification(title, body);
    }
  }
}

// Check for new emoji reactions by the OTHER user
export function checkNewReactions(history, currentUser) {
  if (!history) return;

  const isFirstRun = Object.keys(lastKnownReactions).length === 0;

  history.forEach(log => {
    const logId = log.id;
    const reactions = log.reactions || {};
    const stringified = JSON.stringify(reactions);

    if (isFirstRun) {
      lastKnownReactions[logId] = stringified;
      return;
    }

    const previous = lastKnownReactions[logId];
    if (previous !== stringified) {
      Object.keys(reactions).forEach(user => {
        if (user !== currentUser) {
          const prevReactions = previous ? JSON.parse(previous) : {};
          if (!prevReactions[user]) {
            const emoji = reactions[user];
            let description = 'uma atividade';
            if (log.action === 'complete_task') {
              description = `você concluir "${log.taskTitle}"`;
            } else if (log.action === 'add_task') {
              description = `você adicionar "${log.taskTitle}"`;
            }

            showNotification(
              'Agradecimento recebido! ❤️',
              `${user} enviou um ${emoji} por ${description}!`
            );
          }
        }
      });
      lastKnownReactions[logId] = stringified;
    }
  });
}
