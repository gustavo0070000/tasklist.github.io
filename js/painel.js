// ============================================================================
// MODO PAINEL — tela de parede para Echo Show 15 (1920×1080, horizontal) / TV
// ----------------------------------------------------------------------------
// - Sem rolagem: tudo cabe na tela; listas longas mostram "+N".
// - Toque numa tarefa para concluir (tarefas de "Ambos" perguntam quem fez).
// - Escurece sozinho à noite, desloca 1–3px de tempos em tempos (anti-marcação),
//   recarrega de madrugada para pegar versões novas.
// - Conexão: ?config=<base64> (link "Copiar link p/ Alexa") ou a do app salvo.
// - Dentro da skill da Alexa (?alexa=1), conversa com a skill via alexa-html.js.
// ============================================================================

import * as db from './firebase-db.js';
import * as agenda from './agenda.js';
import * as weather from './weather.js';
import { GUS_AVATAR_SVG, ISA_AVATAR_SVG, AMBOS_AVATAR_SVG } from './illustrations.js';
import { playSound, launchConfetti, resizeConfettiCanvas, showToast } from './effects.js';

const params = new URLSearchParams(window.location.search);
const IN_ALEXA = params.get('alexa') === '1';
const NIGHT_START = 22.5; // 22:30
const NIGHT_END = 6;      // 06:00

const state = {
  data: null,
  calendar: { updatedAt: null, events: [] },
  settings: {},
  weather: null,
  conn: 'connecting',
  lastHistoryId: null,
  pendingWho: null,
  pendingAddOwner: 'Shared',
  wakeUntil: 0
};

const $ = id => document.getElementById(id);

const PEOPLE = [
  { key: 'Gus', label: 'Gustavo', avatar: GUS_AVATAR_SVG },
  { key: 'Isa', label: 'Isabella', avatar: ISA_AVATAR_SVG },
  { key: 'Shared', label: 'Ambos', avatar: AMBOS_AVATAR_SVG }
];

const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };

function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

// ---------------------------------------------------------------------------
// Conexão
// ---------------------------------------------------------------------------

function resolveConnection() {
  const configParam = params.get('config');
  if (configParam) {
    try {
      const b64 = decodeURIComponent(configParam).replace(/ /g, '+'); // '+' pode virar espaço na URL
      const decoded = JSON.parse(decodeURIComponent(escape(atob(b64))));
      if (decoded.firebaseConfig && decoded.secretKey) {
        db.useConfigOverride(decoded.firebaseConfig, decoded.secretKey, 'Gus');
        return 'firebase';
      }
    } catch (e) {
      console.error('Link do painel inválido:', e);
    }
  }
  if (db.getSavedConfig()) return 'firebase';
  if (db.isLocalMode()) return 'local';
  return null;
}

function start() {
  resizeConfettiCanvas();
  const mode = resolveConnection();
  if (!mode) {
    $('pnConnect').hidden = false;
    $('pnStage').hidden = true;
    return;
  }

  if (mode === 'firebase' && !db.initFirebase()) {
    $('pnSyncText').textContent = 'Erro no Firebase';
    return;
  }

  db.listenToConnectionStatus(status => { state.conn = status; renderSync(); });
  db.listenToData(raw => {
    const data = db.normalizeData(raw);
    announceNewActivity(data);
    state.data = data;
    render();
  });
  db.listenToCalendar(cal => { state.calendar = cal; render(); });
  db.listenToSettings(settings => {
    const changed = JSON.stringify((state.settings || {}).weather || null) !== JSON.stringify((settings || {}).weather || null);
    state.settings = settings || {};
    if (changed) refreshWeather(true);
  });

  bindUI();
  tickClock();
  setInterval(tickClock, 1000 * 15);
  setInterval(() => render(), 60 * 1000);          // atrasos, "agora", horários
  setInterval(() => refreshWeather(false), 20 * 60 * 1000);
  setInterval(antiBurnIn, 7 * 60 * 1000);
  scheduleNightlyReload();
  requestWakeLock();
  if (IN_ALEXA) connectAlexa();
}

// ---------------------------------------------------------------------------
// Relógio, noite, anti burn-in
// ---------------------------------------------------------------------------

function tickClock() {
  const now = new Date();
  $('pnTime').textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  $('pnDate').textContent = date.charAt(0).toUpperCase() + date.slice(1);

  const h = now.getHours() + now.getMinutes() / 60;
  const night = (h >= NIGHT_START || h < NIGHT_END) && Date.now() > state.wakeUntil;
  document.body.classList.toggle('pn-night', night);
}

function antiBurnIn() {
  const x = Math.round(Math.random() * 6 - 3);
  const y = Math.round(Math.random() * 4 - 2);
  $('pnStage').style.transform = `translate(${x}px, ${y}px)`;
}

function scheduleNightlyReload() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 4, 7, 0);
  setTimeout(() => window.location.reload(), next - now);
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      await navigator.wakeLock.request('screen');
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') navigator.wakeLock.request('screen').catch(() => {});
      });
    }
  } catch (e) { /* sem suporte: tudo bem */ }
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function render() {
  if (!state.data) return;
  renderMural();
  renderAgenda();
  PEOPLE.forEach(renderPerson);
  renderFooter();
  renderWeather();
}

function renderSync() {
  const labels = { online: 'Ao vivo', reconnecting: 'Reconectando...', offline: 'Sem conexão', local: 'Modo local', connecting: 'Conectando...' };
  $('pnSyncText').textContent = labels[state.conn] || state.conn;
  $('pnSyncDot').dataset.status = state.conn;
}

function renderMural() {
  const notes = [...(state.data.notes || [])];
  if (notes.length === 0) { $('pnMural').hidden = true; return; }
  const pinned = notes.filter(n => n.pinned);
  const pool = pinned.length > 0 ? pinned : notes;
  const featured = pool.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
  $('pnMural').hidden = false;
  $('pnMural').dataset.color = featured.color || 'yellow';
  $('pnMuralAuthor').textContent = `Recado de ${agenda.ownerMeta(featured.user).name}`;
  $('pnMuralText').textContent = `“${featured.text}”`;
}

function renderAgenda() {
  const today = new Date();
  const items = agenda.buildDayAgenda(state.data.tasks, state.calendar.events, today);
  const now = Date.now();

  $('pnAgendaCount').textContent = items.length === 0 ? 'livre' : `${items.length} ite${items.length === 1 ? 'm' : 'ns'}`;

  if (items.length === 0) {
    $('pnToday').innerHTML = '<p class="pn-empty">Nada marcado para hoje 🌿</p>';
  } else {
    $('pnToday').innerHTML = items.map(item => {
      const meta = agenda.ownerMeta(item.owner);
      const past = item.kind === 'event' && !item.allDay && item.end && item.end.getTime() < now;
      const current = item.kind === 'event' && !item.allDay && item.start.getTime() <= now && item.end && item.end.getTime() > now;
      const icon = item.kind === 'event'
        ? `<span class="pn-ev-marker ${meta.cls}"></span>`
        : `<span class="pn-check-mini ${item.completed ? 'checked' : ''}">${item.completed ? '✓' : ''}</span>`;
      return `
        <div class="pn-ag-item ${item.kind} ${meta.cls} ${past || item.completed ? 'past' : ''} ${current ? 'now' : ''}" ${item.kind === 'task' ? `data-task-id="${item.id}"` : ''}>
          <span class="pn-ag-time">${escapeHTML(item.timeLabel)}</span>
          ${icon}
          <span class="pn-ag-body">
            <span class="pn-ag-title">${escapeHTML(item.title)}</span>
            ${item.location ? `<span class="pn-ag-sub">📍 ${escapeHTML(item.location)}</span>` : ''}
          </span>
          <span class="pn-ag-who ${meta.cls}">${meta.short}</span>
        </div>`;
    }).join('');
  }
  fitList($('pnToday'), '.pn-ag-item');

  const upcoming = agenda.upcomingDays(state.data.tasks, state.calendar.events, today, 6).slice(0, 4);
  $('pnUpcoming').innerHTML = upcoming.length === 0
    ? '<p class="pn-empty small">Semana tranquila por enquanto ✨</p>'
    : upcoming.map(({ day, items: dayItems }) => `
        <div class="pn-up-day">
          <span class="pn-up-label">${agenda.dayLabel(day, today, true)}</span>
          <span class="pn-up-items">${dayItems.slice(0, 3).map(i => {
            const meta = agenda.ownerMeta(i.owner);
            return `<span class="pn-up-item"><span class="pn-dot ${meta.cls}"></span>${i.allDay ? '' : `<b>${escapeHTML(i.timeLabel)}</b> `}${escapeHTML(i.title)}</span>`;
          }).join('')}${dayItems.length > 3 ? `<span class="pn-up-more">+${dayItems.length - 3}</span>` : ''}</span>
        </div>`).join('');
}

function sortTasksForPanel(tasks) {
  const now = new Date();
  const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const rank = t => {
    if (!t.deadline) return 2;
    const d = new Date(t.deadline);
    if (d < now) return 0;           // atrasada
    if (d <= endToday) return 1;     // hoje
    return 3;                        // futura
  };
  return [...tasks].sort((a, b) =>
    rank(a) - rank(b)
    || (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1)
    || (a.deadline && b.deadline ? new Date(a.deadline) - new Date(b.deadline) : 0)
    || new Date(a.createdAt) - new Date(b.createdAt));
}

function deadlineBadge(task) {
  if (!task.deadline) return '';
  const d = new Date(task.deadline);
  const now = new Date();
  if (d < now) return '<span class="pn-badge late">atrasada</span>';
  if (agenda.isSameDay(d, now)) return `<span class="pn-badge today">${agenda.formatTime(d)}</span>`;
  if (agenda.isSameDay(d, agenda.addDays(now, 1))) return '<span class="pn-badge">amanhã</span>';
  return `<span class="pn-badge">${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>`;
}

function renderPerson(person) {
  const section = document.querySelector(`.pn-person[data-owner="${person.key}"]`);
  const tasks = state.data.tasks.filter(t => (t.owner || 'Shared') === person.key);
  const pending = sortTasksForPanel(tasks.filter(t => !t.completed));
  const today = new Date();
  const doneToday = tasks
    .filter(t => t.completed && t.completedAt && agenda.isSameDay(new Date(t.completedAt), today))
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

  const totalToday = pending.length + doneToday.length;
  const pct = totalToday > 0 ? Math.round((doneToday.length / totalToday) * 100) : 0;
  const allDone = pending.length === 0 && doneToday.length > 0;

  section.innerHTML = `
    <div class="pn-person-head">
      <div class="pn-avatar">${person.avatar}</div>
      <div class="pn-person-info">
        <span class="pn-person-name">${person.label}${allDone ? ' 🎉' : ''}</span>
        <span class="pn-person-count">${pending.length === 0 ? 'Tudo em dia!' : `${pending.length} pendente${pending.length === 1 ? '' : 's'}`} · ${doneToday.length} feita${doneToday.length === 1 ? '' : 's'} hoje</span>
      </div>
      <button type="button" class="pn-add-btn" data-add-owner="${person.key}" aria-label="Adicionar tarefa para ${person.label}">+</button>
    </div>
    <div class="pn-person-bar"><div class="pn-person-bar-fill" style="width:${pct}%"></div></div>
    <div class="pn-task-list">
      ${pending.length === 0 && doneToday.length === 0 ? '<p class="pn-empty">Sem tarefas 🌸</p>' : ''}
      ${pending.map(t => `
        <button type="button" class="pn-task" data-task-id="${t.id}">
          <span class="pn-check"></span>
          <span class="pn-task-emoji">${escapeHTML(t.emoji || '✨')}</span>
          <span class="pn-task-title">${escapeHTML(t.title)}</span>
          ${t.priority === 'High' ? '<span class="pn-badge high">!</span>' : ''}
          ${deadlineBadge(t)}
        </button>`).join('')}
      ${doneToday.map(t => `
        <button type="button" class="pn-task done" data-task-id="${t.id}">
          <span class="pn-check checked">✓</span>
          <span class="pn-task-emoji">${escapeHTML(t.emoji || '✨')}</span>
          <span class="pn-task-title">${escapeHTML(t.title)}</span>
          ${t.completedBy && t.completedBy !== person.key ? `<span class="pn-badge by">${agenda.ownerMeta(t.completedBy).short}</span>` : ''}
        </button>`).join('')}
    </div>`;

  fitList(section.querySelector('.pn-task-list'), '.pn-task');
}

// Esconde o que não cabe e mostra "+N" (o painel nunca rola)
function fitList(container, selector) {
  if (!container) return;
  const old = container.querySelector('.pn-more');
  if (old) old.remove();
  const rows = [...container.querySelectorAll(selector)];
  rows.forEach(r => { r.hidden = false; });
  const limit = container.getBoundingClientRect().bottom;
  let hidden = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].getBoundingClientRect().bottom <= limit + 1) break;
    rows[i].hidden = true;
    hidden++;
  }
  if (hidden > 0) {
    // reserva espaço para o "+N"
    const visible = rows.filter(r => !r.hidden);
    if (visible.length > 0) { visible[visible.length - 1].hidden = true; hidden++; }
    const more = document.createElement('div');
    more.className = 'pn-more';
    more.textContent = `+${hidden} mais no app`;
    container.appendChild(more);
  }
}

function renderFooter() {
  const tasks = state.data.tasks;
  const now = new Date();
  const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const scope = tasks.filter(t =>
    (!t.completed && (!t.deadline || new Date(t.deadline) <= endToday))
    || (t.completed && t.completedAt && agenda.isSameDay(new Date(t.completedAt), now)));
  const done = scope.filter(t => t.completed);
  const total = scope.length;
  const by = who => done.filter(t => (t.completedBy || t.owner || 'Shared') === who).length;
  const width = n => (total > 0 ? (n / total) * 100 : 0) + '%';

  $('pnProgressLabel').textContent = total === 0 ? 'Dia livre ✨' : `${done.length} de ${total} hoje`;
  $('pnProgressGus').style.width = width(by('Gus'));
  $('pnProgressIsa').style.width = width(by('Isa'));
  $('pnProgressShared').style.width = width(by('Shared'));

  // Sequência (dias seguidos com tarefas concluídas)
  let streak = 0;
  const doneDays = new Set(tasks.filter(t => t.completed && t.completedAt).map(t => new Date(t.completedAt).toDateString()));
  for (let i = 0; i < 365; i++) {
    const d = agenda.addDays(agenda.startOfDay(now), -i);
    if (doneDays.has(d.toDateString())) streak++;
    else if (i > 0) break;
  }
  $('pnStreak').hidden = streak < 2;
  $('pnStreak').textContent = `🔥 ${streak} dias seguidos`;

  // Próxima meta com data
  const goals = (state.data.projects || [])
    .filter(p => p.targetDate && new Date(p.targetDate) >= agenda.startOfDay(now))
    .sort((a, b) => new Date(a.targetDate) - new Date(b.targetDate));
  if (goals.length > 0) {
    const g = goals[0];
    const days = Math.ceil((agenda.startOfDay(new Date(g.targetDate)) - agenda.startOfDay(now)) / 86400000);
    $('pnGoal').hidden = false;
    $('pnGoal').textContent = days === 0 ? `🚀 ${g.name}: é hoje!` : `🚀 ${g.name}: faltam ${days} dia${days === 1 ? '' : 's'}`;
  } else {
    $('pnGoal').hidden = true;
  }
}

function refreshWeather(force) {
  const loc = state.settings && state.settings.weather;
  if (!loc) { state.weather = null; renderWeather(); return; }
  weather.fetchWeather(loc, { force })
    .then(w => { state.weather = w; renderWeather(); })
    .catch(err => console.warn('Clima indisponível:', err));
}

function renderWeather() {
  const w = state.weather;
  const box = $('pnWeather');
  if (!w) { box.hidden = true; return; }
  box.hidden = false;
  const days = w.days.slice(1, 4).map(d => {
    const { icon } = weather.describeWeather(d.code);
    const label = d.date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    return `<span class="pn-wday"><span>${label}</span><span class="pn-wday-icon">${icon}</span><span>${d.max}°<small>${d.min}°</small></span></span>`;
  }).join('');
  const today = w.days[0];
  box.innerHTML = `
    <div class="pn-wnow">
      <span class="pn-wicon">${w.icon}</span>
      <span class="pn-wtemp">${w.temp}°</span>
      <span class="pn-wdesc">
        <strong>${escapeHTML(w.label)}</strong>
        <span>${today ? `${today.max}° / ${today.min}°` : ''} · ${escapeHTML(w.name)}</span>
        ${w.rainAlert ? `<span class="pn-wrain">${escapeHTML(w.rainAlert)}</span>` : ''}
      </span>
    </div>
    <div class="pn-wdays">${days}</div>`;
}

// ---------------------------------------------------------------------------
// Ações (toque)
// ---------------------------------------------------------------------------

function bindUI() {
  document.addEventListener('click', e => {
    // Toque acorda a tela à noite por 2 minutos
    if (document.body.classList.contains('pn-night')) {
      state.wakeUntil = Date.now() + 2 * 60 * 1000;
      tickClock();
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    const addBtn = e.target.closest('[data-add-owner]');
    if (addBtn) return openAdd(addBtn.getAttribute('data-add-owner'));

    const taskEl = e.target.closest('[data-task-id]');
    if (taskEl && state.data) return onTaskTap(taskEl.getAttribute('data-task-id'));
  }, true);

  document.querySelectorAll('.pn-who-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = state.pendingWho;
      $('pnWhoModal').classList.remove('open');
      state.pendingWho = null;
      if (id) setTaskDone(id, true, btn.getAttribute('data-who'));
    });
  });
  $('pnWhoCancel').addEventListener('click', () => { $('pnWhoModal').classList.remove('open'); state.pendingWho = null; });

  $('pnAddCancel').addEventListener('click', () => $('pnAddModal').classList.remove('open'));
  $('pnAddForm').addEventListener('submit', () => {
    const title = $('pnAddInput').value.trim();
    if (!title) return;
    addTask(title, state.pendingAddOwner, $('pnAddToday').checked);
    $('pnAddModal').classList.remove('open');
  });

  window.addEventListener('resize', () => { resizeConfettiCanvas(); render(); });
}

function onTaskTap(taskId) {
  const task = state.data.tasks.find(t => t.id === taskId);
  if (!task) return;
  if (task.completed) {
    setTaskDone(taskId, false);
    return;
  }
  if (task.owner === 'Gus' || task.owner === 'Isa') {
    setTaskDone(taskId, true, task.owner);
  } else {
    state.pendingWho = taskId;
    $('pnWhoTask').textContent = `“${task.title}”`;
    $('pnWhoModal').classList.add('open');
  }
}

function setTaskDone(taskId, done, who = null) {
  const data = state.data;
  const task = data.tasks.find(t => t.id === taskId);
  if (!task) return;
  task.completed = done;
  task.completedBy = done ? (who || task.owner || 'Shared') : null;
  task.completedAt = done ? new Date().toISOString() : null;

  // O histórico registra quem fez (quando "os dois", fica como Ambos)
  db.logAction(data, done ? 'complete_task' : 'uncomplete_task', {
    taskId: task.id,
    taskTitle: task.title,
    user: done ? task.completedBy : 'Shared',
    via: 'painel'
  });
  state.lastHistoryId = data.history[0].id; // não anunciar a própria ação

  if (done) {
    const ownerPending = data.tasks.filter(t => (t.owner || 'Shared') === (task.owner || 'Shared') && !t.completed).length;
    if (ownerPending === 0) {
      playSound('celebrate');
      launchConfetti(90);
      showToast(`Tudo feito para ${agenda.ownerMeta(task.owner).name}! 🎉`);
    } else {
      playSound('check');
      showToast(`“${task.title}” concluída! ✅`, { actionLabel: 'Desfazer', onAction: () => setTaskDone(taskId, false) });
    }
  } else {
    playSound('uncheck');
  }

  render();
  save(data);
}

function openAdd(owner) {
  state.pendingAddOwner = owner;
  $('pnAddTitle').textContent = `Nova tarefa — ${agenda.ownerMeta(owner).name}`;
  $('pnAddInput').value = '';
  $('pnAddModal').classList.add('open');
  setTimeout(() => $('pnAddInput').focus(), 50);
}

function addTask(title, owner, forToday) {
  const data = state.data;
  const now = new Date();
  const list = data.lists[0];
  const task = {
    id: 't-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    listId: list ? list.id : 'l-geral',
    projectId: null,
    title,
    completed: false,
    completedBy: null,
    completedAt: null,
    createdBy: owner === 'Shared' ? 'Gus' : owner,
    createdAt: now.toISOString(),
    deadline: forToday ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 21, 0, 0).toISOString() : null,
    owner,
    priority: 'Medium',
    recurrence: 'none',
    emoji: '✨',
    svgKey: null,
    subtasks: [],
    comments: []
  };
  data.tasks.push(task);
  db.logAction(data, 'add_task', { taskId: task.id, taskTitle: title, listName: list ? list.name : 'Lista', user: 'Shared', via: 'painel' });
  state.lastHistoryId = data.history[0].id;
  playSound('add');
  showToast('Tarefa adicionada! ✨');
  render();
  save(data);
}

function save(data) {
  db.updateDatabase(data).catch(err => {
    console.error(err);
    showToast('Erro ao salvar no Firebase', 'error');
  });
}

// ---------------------------------------------------------------------------
// Avisos na tela quando o casal faz algo pelo celular
// ---------------------------------------------------------------------------

function announceNewActivity(data) {
  const latest = (data.history || [])[0];
  if (!latest) return;
  if (state.lastHistoryId === null) { state.lastHistoryId = latest.id; return; }
  if (latest.id === state.lastHistoryId) return;
  state.lastHistoryId = latest.id;

  const who = agenda.ownerMeta(latest.user).name;
  let text = '';
  if (latest.action === 'nudge') text = `💌 ${who}: ${latest.nudgeText}`;
  else if (latest.action === 'complete_task') text = `✅ ${who} concluiu “${latest.taskTitle}”`;
  else if (latest.action === 'add_task') text = `➕ ${latest.via === 'alexa' ? 'Alexa' : who} adicionou “${latest.taskTitle}”`;
  else if (latest.action === 'add_note') text = `💌 ${who} deixou um recado no mural`;
  if (!text) return;

  if (Date.now() < state.wakeUntil || !document.body.classList.contains('pn-night')) {
    playSound(latest.action === 'nudge' ? 'chime' : 'check');
  }
  showToast(text, { duration: 6000 });
  if (latest.action === 'nudge') launchConfetti(40);
}

// ---------------------------------------------------------------------------
// Alexa (skill com Alexa Web API): mensagens e manter a sessão viva
// ---------------------------------------------------------------------------

function connectAlexa() {
  const script = document.createElement('script');
  script.src = 'https://cdn.html.games.alexa.a2z.com/alexa-html/latest/alexa-html.js';
  script.onload = () => {
    if (!window.Alexa) return;
    window.Alexa.create({ version: '1.1' })
      .then(({ alexa }) => {
        document.body.classList.add('pn-in-alexa');
        alexa.skill.onMessage(msg => {
          if (msg && msg.type === 'toast' && msg.text) showToast(msg.text, { duration: 6000 });
          if (msg && msg.type === 'reload') window.location.reload();
        });
        const ping = () => alexa.skill.sendMessage({ type: 'keepalive', at: Date.now() }, () => {});
        setInterval(ping, 4 * 60 * 1000);
      })
      .catch(err => console.warn('Alexa.create falhou:', err));
  };
  document.head.appendChild(script);
}

start();
