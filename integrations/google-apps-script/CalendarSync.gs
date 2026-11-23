/**
 * Google Agenda (Gustavo + Isabella) -> Firebase calendar/{chave}
 * Roda a cada 15 minutos (gatilho criado por instalarGatilhos()).
 */
function sincronizarAgendas() {
  var tz = cfg('TIMEZONE');
  var now = new Date();
  var start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - cfg('SYNC_DAYS_BACK'));
  var end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + cfg('SYNC_DAYS_AHEAD'));
  var privateKw = normalizeText_(cfg('PRIVATE_KEYWORD') || '');
  var tasksCalId = PropertiesService.getScriptProperties().getProperty('TASKS_CALENDAR_ID');

  var sources = [];
  var cals = cfg('CALENDARS') || {};
  Object.keys(cals).forEach(function (owner) {
    if (cals[owner]) sources.push({ id: cals[owner], owner: owner });
  });
  (cfg('EXTRA_SHARED_CALENDARS') || []).forEach(function (id) { sources.push({ id: id, owner: 'Shared' }); });

  var byKey = {};
  var problems = [];

  sources.forEach(function (src) {
    var cal = src.id === 'primary' ? CalendarApp.getDefaultCalendar() : CalendarApp.getCalendarById(src.id);
    if (!cal) {
      // tenta assinar (a agenda precisa ter sido compartilhada com esta conta)
      try { cal = CalendarApp.subscribeToCalendar(src.id); } catch (e) { cal = null; }
    }
    if (!cal) {
      problems.push('Sem acesso à agenda de ' + OWNER_NAMES[src.owner] + ' (' + src.id + '). Ela foi compartilhada com esta conta?');
      return;
    }
    if (tasksCalId && cal.getId() === tasksCalId) return; // não reimportar as tarefas

    cal.getEvents(start, end).forEach(function (ev) {
      if (src.id === 'primary') {
        try { if (ev.getMyStatus() === CalendarApp.GuestStatus.NO) return; } catch (e) { /* ignore */ }
      }
      var allDay = ev.isAllDayEvent();
      var evStart = allDay ? ev.getAllDayStartDate() : ev.getStartTime();
      var evEnd = allDay ? ev.getAllDayEndDate() : ev.getEndTime();
      var startStr = allDay ? Utilities.formatDate(evStart, tz, 'yyyy-MM-dd') : evStart.toISOString();
      var endStr = allDay ? Utilities.formatDate(evEnd, tz, 'yyyy-MM-dd') : evEnd.toISOString();
      var isPrivate = privateKw && normalizeText_(ev.getDescription()).indexOf(privateKw) !== -1;

      // eventos recorrentes compartilham o mesmo ID; a chave inclui o início
      var key = (ev.getId() + '_' + startStr).replace(/[^a-zA-Z0-9_-]/g, '_').slice(-120);

      if (byKey[key]) {
        // o mesmo evento está na agenda dos dois -> "Ambos"
        if (byKey[key].owner !== src.owner) byKey[key].owner = 'Shared';
        return;
      }
      byKey[key] = {
        id: key,
        title: isPrivate ? 'Ocupado' : (ev.getTitle() || '(sem título)'),
        start: startStr,
        end: endStr,
        allDay: allDay,
        owner: src.owner,
        location: isPrivate ? '' : (ev.getLocation() || ''),
        calendarName: cal.getName()
      };
    });
  });

  fbPut('calendar/' + secret_(), {
    updatedAt: new Date().toISOString(),
    events: byKey,
    problems: problems
  });

  Logger.log('Agendas sincronizadas: ' + Object.keys(byKey).length + ' eventos. ' + problems.join(' '));
  return { count: Object.keys(byKey).length, problems: problems };
}

/**
 * Tarefas com prazo -> eventos na agenda "Tarefas do Casal".
 * Cria/atualiza/remove conforme as tarefas mudam no app.
 */
function sincronizarTarefasNaAgenda() {
  if (!cfg('TASKS_TO_CALENDAR')) return;
  var cal = getTasksCalendar_();
  var data = loadData_();
  var now = new Date();
  var windowStart = new Date(now.getTime() - 24 * 3600 * 1000);
  var windowEnd = new Date(now.getTime() + cfg('SYNC_DAYS_AHEAD') * 24 * 3600 * 1000);

  var wanted = {};
  toEntries_(data.tasks).forEach(function (e) {
    var t = e.value;
    if (t.completed || !t.deadline) return;
    var d = new Date(t.deadline);
    if (d < windowStart || d > windowEnd) return;
    wanted[t.id] = t;
  });

  var existing = {};
  cal.getEvents(windowStart, windowEnd).forEach(function (ev) {
    var id = ev.getTag('tasklistId');
    if (!id) return;
    if (!wanted[id] || existing[id]) { ev.deleteEvent(); return; }
    existing[id] = ev;
  });

  var created = 0, updated = 0;
  Object.keys(wanted).forEach(function (id) {
    var t = wanted[id];
    var title = (t.emoji ? t.emoji + ' ' : '') + t.title + ' · ' + (OWNER_NAMES[t.owner] || 'Ambos');
    var startAt = new Date(t.deadline);
    var endAt = new Date(startAt.getTime() + 30 * 60 * 1000);
    var ev = existing[id];
    if (!ev) {
      ev = cal.createEvent(title, startAt, endAt, { description: 'Tarefa do app tasklist — ' + cfg('APP_URL') });
      ev.setTag('tasklistId', id);
      try { ev.removeAllReminders(); ev.addPopupReminder(30); } catch (e) { /* ignore */ }
      created++;
    } else {
      if (ev.getTitle() !== title) ev.setTitle(title);
      if (ev.getStartTime().getTime() !== startAt.getTime()) ev.setTime(startAt, endAt);
      updated++;
    }
  });
  Logger.log('Tarefas na agenda: ' + created + ' criadas, ' + updated + ' conferidas.');
}

function getTasksCalendar_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('TASKS_CALENDAR_ID');
  var cal = id ? CalendarApp.getCalendarById(id) : null;
  if (!cal) {
    var found = CalendarApp.getCalendarsByName(cfg('TASKS_CALENDAR_NAME'));
    cal = found && found.length ? found[0] : CalendarApp.createCalendar(cfg('TASKS_CALENDAR_NAME'), { color: CalendarApp.Color.YELLOW });
    props.setProperty('TASKS_CALENDAR_ID', cal.getId());
    compartilharAgendaDeTarefas_(cal.getId());
  }
  return cal;
}

// Compartilha a agenda de tarefas com a Isa (serviço avançado "Calendar")
function compartilharAgendaDeTarefas_(calendarId) {
  var email = cfg('ISA_EMAIL_TO_SHARE_TASKS_CALENDAR');
  if (!email) return;
  try {
    Calendar.Acl.insert({ role: 'reader', scope: { type: 'user', value: email } }, calendarId);
    Logger.log('Agenda de tarefas compartilhada com ' + email);
  } catch (e) {
    Logger.log('Não consegui compartilhar automaticamente (' + e.message + '). Compartilhe pelo Google Agenda.');
  }
}
