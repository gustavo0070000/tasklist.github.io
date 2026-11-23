/**
 * Roda a cada minuto: lê o histórico do app e avisa o OUTRO (push/Telegram),
 * faz a Echo falar os carinhos, manda lembretes de prazo e atende o bot.
 */
function aCadaMinuto() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    try { processarHistorico_(); } catch (e) { Logger.log('Histórico: ' + e.message); }
    try { lembretesDePrazo_(); } catch (e) { Logger.log('Lembretes: ' + e.message); }
    try { if (cfg('TELEGRAM_BOT_TOKEN') && typeof processarTelegram === 'function') processarTelegram(); } catch (e) { Logger.log('Telegram: ' + e.message); }
  } finally {
    lock.releaseLock();
  }
}

function nomeDoAutor_(log) {
  if (log.via === 'alexa' && log.action !== 'nudge') return 'Alexa';
  if (log.user === 'Gus') return 'Gustavo';
  if (log.user === 'Isa') return 'Isabella';
  return 'Vocês';
}

function textoDaAtividade_(log) {
  var who = nomeDoAutor_(log);
  switch (log.action) {
    case 'add_task': return who + ' adicionou: "' + log.taskTitle + '"';
    case 'complete_task': return who + ' concluiu: "' + log.taskTitle + '" ✅';
    case 'add_note': return who + ' deixou um recado no Mural 💌';
    case 'add_wish': return who + ' adicionou um desejo: "' + log.wishTitle + '" 🎁';
    case 'add_project': return who + ' criou a meta: "' + log.projectName + '" 🚀';
    case 'nudge': return who + ' mandou: ' + log.nudgeText;
    default: return '';
  }
}

function destinatarios_(log) {
  if (log.user === 'Gus') return ['Isa'];
  if (log.user === 'Isa') return ['Gus'];
  return ['Gus', 'Isa']; // Alexa, painel, "os dois"
}

function processarHistorico_() {
  var props = PropertiesService.getScriptProperties();
  var lastId = props.getProperty('LAST_HISTORY_ID');
  var history = toEntries_(fbGet('tasks/' + secret_() + '/history')).map(function (e) { return e.value; });
  if (history.length === 0) return;
  if (!lastId) { props.setProperty('LAST_HISTORY_ID', history[0].id); return; }
  if (history[0].id === lastId) return;

  var novos = [];
  for (var i = 0; i < history.length; i++) {
    if (history[i].id === lastId) break;
    novos.push(history[i]);
  }
  props.setProperty('LAST_HISTORY_ID', history[0].id);

  // ignora atividade antiga (ex.: script ficou parado) e processa em ordem cronológica
  var limite = Date.now() - 30 * 60 * 1000;
  novos.reverse().forEach(function (log) {
    if (new Date(log.timestamp).getTime() < limite) return;
    var texto = textoDaAtividade_(log);
    if (!texto) return;

    destinatarios_(log).forEach(function (user) {
      if (typeof enviarPush === 'function') {
        enviarPush(user, 'Tasklist — Gustavo & Isabella', texto, log.action === 'nudge' ? 'tasklist-nudge' : 'tasklist-alert');
      }
      if ((cfg('TELEGRAM_NOTIFY_ACTIONS') || []).indexOf(log.action) !== -1 && log.via !== 'telegram' && typeof enviarTelegram === 'function' && typeof telegramDoUsuario_ === 'function') {
        enviarTelegram(telegramDoUsuario_(user), escapeHtml_(texto));
      }
    });

    if (log.action === 'nudge' && cfg('ANNOUNCE_NUDGES') && typeof anunciarNaEcho === 'function') {
      anunciarNaEcho(nomeDoAutor_(log) + ' mandou um carinho: ' + String(log.nudgeText || '').replace(/[^\p{L}\p{N}\s!?.,]/gu, '').trim());
    }
  });
}

function lembretesDePrazo_() {
  var minutos = cfg('DEADLINE_REMINDER_MINUTES');
  if (!minutos) return;
  var props = PropertiesService.getScriptProperties();
  var lembrados = JSON.parse(props.getProperty('REMINDED_TASKS') || '{}');
  var now = Date.now();
  var data = loadData_();
  var mudou = false;

  pendingTasks_(data).forEach(function (t) {
    if (!t.deadline || lembrados[t.id]) return;
    var due = new Date(t.deadline).getTime();
    if (due < now || due - now > minutos * 60 * 1000) return;
    var hora = Utilities.formatDate(new Date(due), cfg('TIMEZONE'), 'HH:mm');
    var texto = '⏰ "' + t.title + '" vence às ' + hora;
    var users = t.owner === 'Gus' || t.owner === 'Isa' ? [t.owner] : ['Gus', 'Isa'];
    users.forEach(function (u) {
      if (typeof enviarPush === 'function') enviarPush(u, 'Lembrete de tarefa', texto, 'tasklist-due-' + t.id);
      if (cfg('TELEGRAM_BOT_TOKEN') && typeof enviarTelegram === 'function' && typeof telegramDoUsuario_ === 'function') {
        enviarTelegram(telegramDoUsuario_(u), escapeHtml_(texto));
      }
    });
    lembrados[t.id] = now;
    mudou = true;
  });

  // limpa lembretes com mais de 3 dias
  Object.keys(lembrados).forEach(function (id) {
    if (now - lembrados[id] > 3 * 24 * 3600 * 1000) { delete lembrados[id]; mudou = true; }
  });
  if (mudou) props.setProperty('REMINDED_TASKS', JSON.stringify(lembrados));
}
