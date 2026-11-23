/**
 * Resumo matinal (gatilho diário em MORNING_HOUR):
 * agenda dos dois + tarefas do dia + clima -> Telegram, push e Echo.
 */
function resumoMatinal() {
  var resumo = montarResumo_();

  var group = cfg('TELEGRAM_GROUP_CHAT_ID');
  if (group) enviarTelegram(group, resumo.html);
  else ['Gus', 'Isa'].forEach(function (u) { enviarTelegram(telegramDoUsuario_(u), resumo.html); });

  ['Gus', 'Isa'].forEach(function (u) { enviarPush(u, '☀️ Bom dia!', resumo.curto, 'tasklist-morning'); });

  if (cfg('ANNOUNCE_MORNING')) anunciarNaEcho(resumo.falado);
  return resumo;
}

function montarResumo_() {
  var tz = cfg('TIMEZONE');
  var now = new Date();
  var hojeStr = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  var fimHoje = new Date(Utilities.formatDate(now, tz, "yyyy-MM-dd'T'23:59:59XXX"));
  var data = loadData_();
  var cal = fbGet('calendar/' + secret_()) || {};

  var eventos = toEntries_(cal.events).map(function (e) { return e.value; }).filter(function (ev) {
    if (ev.allDay) return ev.start <= hojeStr && (ev.end > hojeStr || ev.end === ev.start);
    return Utilities.formatDate(new Date(ev.start), tz, 'yyyy-MM-dd') === hojeStr;
  }).sort(function (a, b) { return a.allDay === b.allDay ? (a.start < b.start ? -1 : 1) : (a.allDay ? -1 : 1); });

  var pendentes = pendingTasks_(data);
  var doDia = pendentes.filter(function (t) { return t.deadline && new Date(t.deadline) <= fimHoje; });

  var clima = climaDeHoje_();
  var dia = Utilities.formatDate(now, tz, 'dd/MM');

  var html = '☀️ <b>Bom dia, Gustavo &amp; Isabella!</b> (' + dia + ')\n';
  if (clima) html += '\n' + escapeHtml_(clima.texto) + '\n';

  html += '\n📅 <b>Agenda de hoje</b>\n';
  if (eventos.length === 0) html += 'Nenhum compromisso 🌿\n';
  eventos.forEach(function (ev) {
    var hora = ev.allDay ? 'Dia todo' : Utilities.formatDate(new Date(ev.start), tz, 'HH:mm');
    html += '• ' + hora + ' — ' + escapeHtml_(ev.title) + ' <i>(' + OWNER_NAMES[ev.owner] + ')</i>\n';
  });

  html += '\n✅ <b>Tarefas para hoje</b> (' + doDia.length + ')\n';
  ['Gus', 'Isa', 'Shared'].forEach(function (owner) {
    var lista = doDia.filter(function (t) { return (t.owner || 'Shared') === owner; });
    if (lista.length === 0) return;
    html += '<b>' + OWNER_NAMES[owner] + ':</b> ' + lista.map(function (t) {
      var atrasada = new Date(t.deadline) < now ? ' ⚠️' : '';
      return escapeHtml_(t.title) + atrasada;
    }).join(', ') + '\n';
  });
  if (doDia.length === 0) html += 'Nada com prazo hoje ✨\n';
  html += '\nTotal pendente: ' + pendentes.length + ' · <a href="' + cfg('APP_URL') + '">abrir app</a>';

  var curto = eventos.length + ' compromisso(s) e ' + doDia.length + ' tarefa(s) para hoje.' + (clima ? ' ' + clima.curto : '');

  var falado = 'Bom dia, Gustavo e Isabella! ';
  if (clima) falado += clima.falado + ' ';
  if (eventos.length > 0) {
    falado += 'Hoje vocês têm ' + eventos.length + (eventos.length === 1 ? ' compromisso' : ' compromissos') + ': ' +
      eventos.slice(0, 4).map(function (ev) {
        return ev.allDay ? ev.title : ev.title + ' às ' + Utilities.formatDate(new Date(ev.start), tz, 'H:mm');
      }).join(', ') + '. ';
  }
  falado += doDia.length > 0
    ? 'E ' + doDia.length + (doDia.length === 1 ? ' tarefa' : ' tarefas') + ' para hoje. Bom dia!'
    : 'Nenhuma tarefa com prazo para hoje. Aproveitem!';

  return { html: html, curto: curto, falado: falado };
}
