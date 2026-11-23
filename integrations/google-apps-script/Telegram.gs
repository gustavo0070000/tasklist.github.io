/**
 * Bot do Telegram (polling a cada minuto, sem webhook).
 *
 *  /hoje               agenda + tarefas de hoje
 *  /tarefas            pendentes numeradas por pessoa
 *  /add texto          nova tarefa (termine com "pro gus", "pra isa" ou "pros dois";
 *                      inclua "hoje" ou "amanhã" para dar prazo)
 *  /feito 3            conclui a tarefa nº 3 da última /tarefas (ou parte do nome)
 *  /mercado leite      adiciona na lista "Mercado"
 *  /recado texto       fixa um recado no mural
 *  /carinho texto      manda um carinho (a Echo fala!)
 *  /resumo             resumo matinal agora
 *  /id                 mostra seu ID (para configurar TELEGRAM_USERS)
 *  Texto solto         vira tarefa para quem mandou.
 */
function processarTelegram() {
  var props = PropertiesService.getScriptProperties();
  var offset = Number(props.getProperty('TELEGRAM_OFFSET') || 0);
  var res = telegramApi_('getUpdates', { offset: offset, timeout: 0, allowed_updates: ['message'] });
  if (!res || !res.ok) return;

  res.result.forEach(function (update) {
    offset = Math.max(offset, update.update_id + 1);
    props.setProperty('TELEGRAM_OFFSET', String(offset)); // antes de processar: nunca repete
    var msg = update.message;
    if (!msg || !msg.text) return;
    try {
      responderTelegram_(msg);
    } catch (e) {
      Logger.log('Erro no comando do Telegram: ' + e.message);
      enviarTelegram(msg.chat.id, '😕 Deu erro: ' + escapeHtml_(e.message));
    }
  });
}

function quemMandou_(msg) {
  var users = cfg('TELEGRAM_USERS') || {};
  var fromId = String(msg.from && msg.from.id);
  if (users.Gus && String(users.Gus) === fromId) return 'Gus';
  if (users.Isa && String(users.Isa) === fromId) return 'Isa';
  return null;
}

// Interpreta "lavar louça pro gus amanhã" -> { title, owner, deadline }
function interpretarTarefa_(texto, autor) {
  var t = ' ' + texto.trim() + ' ';
  var owner = autor || 'Shared';
  var ownerPatterns = [
    [/\s(pro|para o|pra o|p\/)\s*(gus|gustavo)\b/i, 'Gus'],
    [/\s(pra|para a|pra a|p\/)\s*(isa|isabella|isabela)\b/i, 'Isa'],
    [/\s(pros dois|para os dois|pra nós|pra nos|para nós|ambos|pro casal)\b/i, 'Shared'],
    [/\s@(gus|gustavo)\b/i, 'Gus'],
    [/\s@(isa|isabella)\b/i, 'Isa'],
    [/\s@(ambos|casal)\b/i, 'Shared']
  ];
  ownerPatterns.forEach(function (p) {
    if (p[0].test(t)) { owner = p[1]; t = t.replace(p[0], ' '); }
  });

  var deadline = null;
  var tz = cfg('TIMEZONE');
  var hojeAs = function (diasAFrente) {
    var base = new Date(Date.now() + diasAFrente * 24 * 3600 * 1000);
    return new Date(Utilities.formatDate(base, tz, "yyyy-MM-dd'T'21:00:00XXX")).toISOString();
  };
  if (/\s(amanha|amanhã)\s/i.test(t)) { deadline = hojeAs(1); t = t.replace(/\s(para |pra )?(amanha|amanhã)\s/i, ' '); }
  else if (/\shoje\s/i.test(t)) { deadline = hojeAs(0); t = t.replace(/\s(para |pra )?hoje\s/i, ' '); }

  var title = t.replace(/\s+/g, ' ').trim();
  title = title.charAt(0).toUpperCase() + title.slice(1);
  return { title: title, owner: owner, deadline: deadline };
}

function responderTelegram_(msg) {
  var chatId = msg.chat.id;
  var text = msg.text.trim();
  var parts = text.match(/^\/(\w+)(?:@\w+)?\s*([\s\S]*)$/);
  var cmd = parts ? parts[1].toLowerCase() : '';
  var arg = parts ? parts[2].trim() : text;

  if (cmd === 'id' || cmd === 'start') {
    return enviarTelegram(chatId, '👋 Seu ID do Telegram é <code>' + msg.from.id + '</code>' +
      (msg.chat.type !== 'private' ? '\nID deste grupo: <code>' + chatId + '</code>' : '') +
      '\nColoque em TELEGRAM_USERS no Apps Script para eu te reconhecer.');
  }

  var autor = quemMandou_(msg);
  if (!autor) {
    return enviarTelegram(chatId, '🔒 Não te conheço ainda. Mande /id e configure TELEGRAM_USERS.');
  }

  switch (cmd) {
    case 'hoje':
    case 'resumo': {
      var r = montarResumo_();
      return enviarTelegram(chatId, r.html);
    }
    case 'tarefas':
    case 'lista':
      return enviarTelegram(chatId, listarTarefas_(chatId));
    case 'feito':
    case 'feita':
    case 'ok':
      return enviarTelegram(chatId, concluirPorTelegram_(chatId, arg, autor));
    case 'mercado': {
      if (!arg) return enviarTelegram(chatId, 'Use: /mercado leite, pão e café');
      var item = addTaskRemote(capitalizar_(arg), 'Shared', { listHint: 'mercado', by: autor, via: 'telegram', emoji: '🛒' });
      return enviarTelegram(chatId, '🛒 Anotado no Mercado: <b>' + escapeHtml_(item.title) + '</b>');
    }
    case 'recado': {
      if (!arg) return enviarTelegram(chatId, 'Use: /recado texto do recado');
      addNoteRemote(arg, autor, 'telegram');
      return enviarTelegram(chatId, '💌 Recado fixado no mural!');
    }
    case 'carinho': {
      var nudge = arg || '❤️ Te amo!';
      sendNudgeRemote(nudge, autor, 'telegram');
      return enviarTelegram(chatId, '💌 Carinho enviado para ' + (autor === 'Gus' ? 'Isabella' : 'Gustavo') + '!');
    }
    case 'add':
    case 'nova':
    case '':
      if (cmd === '' && text.charAt(0) === '/') break;
      if (!arg) return enviarTelegram(chatId, 'Use: /add lavar louça pro gus hoje');
      var info = interpretarTarefa_(arg, cmd === '' ? autor : 'Shared');
      if (!info.title) return enviarTelegram(chatId, 'Faltou o nome da tarefa 🙂');
      addTaskRemote(info.title, info.owner, { deadline: info.deadline, by: autor, via: 'telegram' });
      return enviarTelegram(chatId, '✅ Tarefa adicionada para <b>' + OWNER_NAMES[info.owner] + '</b>: ' + escapeHtml_(info.title) +
        (info.deadline ? ' (prazo ' + Utilities.formatDate(new Date(info.deadline), cfg('TIMEZONE'), 'dd/MM') + ')' : ''));
    default:
      break;
  }
  return enviarTelegram(chatId, 'Comandos: /hoje · /tarefas · /add · /feito N · /mercado · /recado · /carinho · /resumo');
}

function listarTarefas_(chatId) {
  var data = loadData_();
  var pend = pendingTasks_(data);
  var numerada = [];
  var html = '📋 <b>Pendentes</b> (' + pend.length + ')\n';
  ['Gus', 'Isa', 'Shared'].forEach(function (owner) {
    var lista = pend.filter(function (t) { return (t.owner || 'Shared') === owner; });
    if (lista.length === 0) return;
    html += '\n<b>' + OWNER_NAMES[owner] + '</b>\n';
    lista.forEach(function (t) {
      numerada.push(t.id);
      var prazo = t.deadline ? ' <i>(' + Utilities.formatDate(new Date(t.deadline), cfg('TIMEZONE'), 'dd/MM HH:mm') + ')</i>' : '';
      html += numerada.length + '. ' + escapeHtml_(t.title) + prazo + '\n';
    });
  });
  PropertiesService.getScriptProperties().setProperty('TG_LIST_' + chatId, JSON.stringify(numerada));
  return html + '\nConclua com /feito número';
}

function concluirPorTelegram_(chatId, arg, autor) {
  if (!arg) return 'Use /feito 2 (número da /tarefas) ou /feito parte do nome';
  var id = null;
  if (/^\d+$/.test(arg)) {
    var ids = JSON.parse(PropertiesService.getScriptProperties().getProperty('TG_LIST_' + chatId) || '[]');
    id = ids[Number(arg) - 1];
    if (!id) return 'Número não encontrado. Mande /tarefas de novo.';
  } else {
    var alvo = normalizeText_(arg);
    var achou = pendingTasks_(loadData_()).filter(function (t) { return normalizeText_(t.title).indexOf(alvo) !== -1; });
    if (achou.length === 0) return 'Não achei tarefa pendente com "' + escapeHtml_(arg) + '".';
    if (achou.length > 1) return 'Achei ' + achou.length + ' tarefas. Seja mais específico ou use /tarefas.';
    id = achou[0].id;
  }
  var t = completeTaskRemote(id, autor, 'telegram');
  return t ? '🎉 Concluída: <b>' + escapeHtml_(t.title) + '</b>' : 'Essa tarefa não existe mais.';
}

function capitalizar_(s) {
  s = String(s || '').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
