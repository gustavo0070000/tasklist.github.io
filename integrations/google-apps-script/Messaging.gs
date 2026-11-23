/**
 * Canais de saída: Push (FCM), Telegram e Echo falando (Voice Monkey).
 */

// ---------- Push (Firebase Cloud Messaging HTTP v1) ----------
function enviarPush(user, title, body, tag) {
  var project = cfg('FIREBASE_PROJECT_ID');
  if (!project || project === 'seu-projeto') return 0;
  var tokens = fbGet('push/' + secret_() + '/' + user) || {};
  var sent = 0;
  Object.keys(tokens).forEach(function (key) {
    var t = tokens[key];
    if (!t || !t.token) return;
    var res = UrlFetchApp.fetch('https://fcm.googleapis.com/v1/projects/' + project + '/messages:send', {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
        'x-goog-user-project': project
      },
      payload: JSON.stringify({
        message: {
          token: t.token,
          data: { title: title, body: body, tag: tag || 'tasklist-alert', url: cfg('APP_URL') },
          webpush: { headers: { Urgency: 'high', TTL: '86400' } }
        }
      })
    });
    var code = res.getResponseCode();
    if (code === 200) { sent++; return; }
    var text = res.getContentText();
    if (code === 404 || /UNREGISTERED|registration-token-not-registered|INVALID_ARGUMENT/.test(text)) {
      fbDelete('push/' + secret_() + '/' + user + '/' + key); // aparelho desinstalou / token expirou
    } else {
      Logger.log('Push falhou (' + code + '): ' + text.slice(0, 300));
    }
  });
  return sent;
}

// ---------- Telegram ----------
function telegramApi_(method, payload) {
  var token = cfg('TELEGRAM_BOT_TOKEN');
  if (!token) return null;
  var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var json = JSON.parse(res.getContentText() || '{}');
  if (!json.ok) Logger.log('Telegram ' + method + ' falhou: ' + res.getContentText().slice(0, 300));
  return json;
}

function enviarTelegram(chatId, html) {
  if (!chatId) return null;
  return telegramApi_('sendMessage', { chat_id: chatId, text: html, parse_mode: 'HTML', disable_web_page_preview: true });
}

function telegramDoUsuario_(user) {
  var users = cfg('TELEGRAM_USERS') || {};
  return users[user] || '';
}

// escapeHtml_ agora fica em Firebase.gs (arquivo obrigatório) para evitar ReferenceError quando Messaging.gs não for usado.

// ---------- Echo falando (Voice Monkey v3) ----------
function anunciarNaEcho(texto) {
  var token = cfg('VOICE_MONKEY_TOKEN');
  var device = cfg('VOICE_MONKEY_DEVICE');
  if (!token || !device) return false;
  var quiet = cfg('ANNOUNCE_QUIET_HOURS') || [22, 7];
  var hour = Number(Utilities.formatDate(new Date(), cfg('TIMEZONE'), 'H'));
  if (quiet[0] > quiet[1] ? (hour >= quiet[0] || hour < quiet[1]) : (hour >= quiet[0] && hour < quiet[1])) {
    Logger.log('Horário de silêncio — não anunciei: ' + texto);
    return false;
  }
  var res = UrlFetchApp.fetch('https://api-v3.voicemonkey.io/announce', {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify({
      token: token,
      device: device,
      speech: texto,
      voice: cfg('VOICE_MONKEY_VOICE') || undefined,
      language: cfg('VOICE_MONKEY_LANGUAGE') || undefined
    })
  });
  if (res.getResponseCode() >= 300) {
    Logger.log('Voice Monkey falhou (' + res.getResponseCode() + '): ' + res.getContentText().slice(0, 300));
    return false;
  }
  return true;
}
