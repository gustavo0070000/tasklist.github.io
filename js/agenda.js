// Agenda unificada: eventos do Google Agenda (Gustavo + Isabella) + tarefas com prazo.
// Usado pelo app (Resumo/Calendário) e pelo Modo Painel (Echo Show).

export const OWNER_META = {
  Gus: { name: 'Gustavo', short: 'Gus', cls: 'gus', color: '#aee8e4', ink: '#0d3b3e' },
  Isa: { name: 'Isabella', short: 'Isa', cls: 'isa', color: '#ffc4b0', ink: '#4a1c11' },
  Shared: { name: 'Ambos', short: 'Ambos', cls: 'shared', color: '#ffec99', ink: '#7f1d1d' }
};

export function ownerMeta(owner) {
  return OWNER_META[owner] || OWNER_META.Shared;
}

// Eventos de dia inteiro chegam como 'YYYY-MM-DD' (fim exclusivo, padrão Google).
// new Date('YYYY-MM-DD') seria meia-noite UTC (21h do dia anterior no Brasil),
// então convertemos para meia-noite LOCAL.
export function parseEventDate(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function eventsOnDay(events, day) {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  return (events || []).filter(ev => {
    const s = parseEventDate(ev.start);
    let e = parseEventDate(ev.end) || s;
    if (!s) return false;
    if (e <= s) e = new Date(s.getTime() + 1); // eventos de duração zero
    return s < dayEnd && e > dayStart;
  });
}

export function tasksOnDay(tasks, day) {
  return (tasks || []).filter(t => t.deadline && isSameDay(new Date(t.deadline), day));
}

export function formatTime(date) {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Lista ordenada para um dia: eventos de dia inteiro primeiro, depois tudo por horário.
export function buildDayAgenda(tasks, events, day) {
  const items = [];

  eventsOnDay(events, day).forEach(ev => {
    const s = parseEventDate(ev.start);
    const e = parseEventDate(ev.end);
    const startsToday = isSameDay(s, day);
    const multiDay = !ev.allDay && e && !isSameDay(s, new Date(e.getTime() - 1));
    let timeLabel = 'Dia todo';
    if (!ev.allDay) {
      if (startsToday) timeLabel = formatTime(s);
      else timeLabel = 'Contínuo';
    }
    items.push({
      kind: 'event',
      id: ev.id,
      title: ev.title,
      owner: ev.owner,
      location: ev.location,
      allDay: ev.allDay || (!startsToday && multiDay),
      sortKey: ev.allDay || !startsToday ? -1 : s.getTime(),
      timeLabel,
      endLabel: !ev.allDay && e && isSameDay(e, day) ? formatTime(e) : '',
      start: s,
      end: e
    });
  });

  tasksOnDay(tasks, day).forEach(t => {
    const d = new Date(t.deadline);
    items.push({
      kind: 'task',
      id: t.id,
      title: t.title,
      owner: t.owner || 'Shared',
      completed: Boolean(t.completed),
      emoji: t.emoji,
      allDay: false,
      sortKey: d.getTime(),
      timeLabel: formatTime(d),
      endLabel: '',
      start: d
    });
  });

  return items.sort((a, b) => a.sortKey - b.sortKey);
}

// Próximos N dias (a partir de amanhã) com eventos/tarefas, para "Próximos dias".
export function upcomingDays(tasks, events, fromDate, days = 5) {
  const out = [];
  for (let i = 1; i <= days; i++) {
    const day = addDays(startOfDay(fromDate), i);
    const items = buildDayAgenda(tasks.filter(t => !t.completed), events, day);
    if (items.length > 0) out.push({ day, items });
  }
  return out;
}

export function dayLabel(day, today = new Date(), short = false) {
  if (isSameDay(day, today)) return 'Hoje';
  if (isSameDay(day, addDays(today, 1))) return 'Amanhã';
  const label = short
    ? day.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }).replace('.', '')
    : day.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function relativeSyncLabel(iso) {
  if (!iso) return 'nunca sincronizado';
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'agora mesmo';
  if (diffMin < 60) return `há ${diffMin} min`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `há ${h} h`;
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
