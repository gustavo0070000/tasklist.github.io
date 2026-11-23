// ============================================================================
// Skill "nossa lista" / "nosso hub" — tasklist Gustavo & Isabella
// ----------------------------------------------------------------------------
// Compatível com Echo Show 15 (painel visual APL idêntico ao Modo Painel web)
// E Echo Dot (comandos de voz sem tela).
//
// Recursos no painel APL da Echo Show 15:
// - Relógio ao vivo (data-binding localTime) + data em português
// - Recado do Mural colorido conforme a cor do post-it
// - Clima ao vivo via Open-Meteo (temperatura, condição, alerta de chuva, 3 dias)
// - 4 colunas escuras com topo pastel (Hoje/Próximos dias, Gustavo, Isabella, Ambos)
// - Toque em qualquer tarefa na tela para concluir em tempo real no Firebase
// - Barra de progresso do dia, sequência (streak), contagem regressiva da próxima
//   meta (ex.: Casamento) e botão "● Ao vivo" para atualizar com 1 toque
// ============================================================================

const https = require('https');
const config = require('./config');
const fb = require('./firebase');

const OWNER_NAMES = { Gus: 'Gustavo', Isa: 'Isabella', Shared: 'vocês dois' };
const OWNER_LABELS = { Gus: 'Gustavo', Isa: 'Isabella', Shared: 'Ambos' };
const OWNER_SHORT = { Gus: 'Gus', Isa: 'Isa', Shared: 'Ambos' };
const WEEKDAYS_FULL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS_FULL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };
const APL_TOKEN = 'tasklist-dashboard-apl';

const NOTE_COLORS = {
  yellow: { bg: '#FFF3B0', label: '#713F12' },
  blue:   { bg: '#BBD7FA', label: '#1E3A5F' },
  peach:  { bg: '#FFDFC4', label: '#7C2D12' },
  mint:   { bg: '#C9F3E3', label: '#064E3B' },
  pink:   { bg: '#FBCFE8', label: '#831843' },
  green:  { bg: '#BBF7D0', label: '#14532D' }
};

const WMO = {
  0: ['☀️', 'Céu limpo'], 1: ['🌤️', 'Poucas nuvens'], 2: ['⛅', 'Parcialmente nublado'], 3: ['☁️', 'Nublado'],
  45: ['🌫️', 'Neblina'], 48: ['🌫️', 'Neblina'],
  51: ['🌦️', 'Garoa fraca'], 53: ['🌦️', 'Garoa'], 55: ['🌦️', 'Garoa forte'], 56: ['🌦️', 'Garoa gelada'], 57: ['🌦️', 'Garoa gelada'],
  61: ['🌧️', 'Chuva fraca'], 63: ['🌧️', 'Chuva'], 65: ['🌧️', 'Chuva forte'], 66: ['🌧️', 'Chuva gelada'], 67: ['🌧️', 'Chuva gelada'],
  71: ['🌨️', 'Neve fraca'], 73: ['🌨️', 'Neve'], 75: ['🌨️', 'Neve forte'], 77: ['🌨️', 'Granizo fino'],
  80: ['🌦️', 'Pancadas fracas'], 81: ['🌧️', 'Pancadas de chuva'], 82: ['⛈️', 'Pancadas fortes'],
  85: ['🌨️', 'Neve'], 86: ['🌨️', 'Neve forte'],
  95: ['⛈️', 'Trovoadas'], 96: ['⛈️', 'Trovoadas com granizo'], 99: ['⛈️', 'Trovoadas com granizo']
};

let weatherCache = { key: null, at: 0, data: null };

// ---------------------------------------------------------------------------
// Utilitários de resposta, datas e clima (Open-Meteo)
// ---------------------------------------------------------------------------

function escapeSsml(text) {
  return String(text || '').replace(/&/g, 'e').replace(/[<>"]/g, '');
}

function respond({ speech = null, reprompt = null, directives = [], endSession, attributes = {} }) {
  const response = {};
  if (speech) response.outputSpeech = { type: 'SSML', ssml: `<speak>${escapeSsml(speech)}</speak>` };
  if (reprompt) response.reprompt = { outputSpeech: { type: 'SSML', ssml: `<speak>${escapeSsml(reprompt)}</speak>` } };
  if (directives.length) response.directives = directives;
  if (endSession !== undefined) response.shouldEndSession = endSession;
  return { version: '1.0', sessionAttributes: attributes, response };
}

function supportedInterfaces(event) {
  return (((event.context || {}).System || {}).device || {}).supportedInterfaces || {};
}

function supportsApl(event) {
  return Boolean(supportedInterfaces(event)['Alexa.Presentation.APL']);
}

function supportsHtml(event) {
  return Boolean(supportedInterfaces(event)['Alexa.Presentation.HTML']);
}

function panelUrl() {
  return config.PANEL_URL + (config.PANEL_URL.includes('?') ? '&' : '?') + 'alexa=1';
}

function startPanelDirective() {
  return {
    type: 'Alexa.Presentation.HTML.Start',
    data: { source: 'tasklist-skill' },
    request: { uri: panelUrl(), method: 'GET' },
    configuration: { timeoutInSeconds: 300 }
  };
}

function toastDirective(text) {
  return { type: 'Alexa.Presentation.HTML.HandleMessage', message: { type: 'toast', text } };
}

function slotValue(event, name) {
  const slots = ((event.request || {}).intent || {}).slots || {};
  const slot = slots[name];
  if (!slot) return '';
  const resolved = (((slot.resolutions || {}).resolutionsPerAuthority || [])[0] || {});
  if (resolved.status && resolved.status.code === 'ER_SUCCESS_MATCH') return resolved.values[0].value.id || resolved.values[0].value.name;
  return slot.value || '';
}

function offsetMinutes() {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(config.UTC_OFFSET || '-03:00');
  if (!m) return -180;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

function localDateObj(date = new Date()) {
  return new Date(date.getTime() + offsetMinutes() * 60000);
}

function localDateKey(date = new Date()) {
  return localDateObj(date).toISOString().slice(0, 10);
}

function addDaysKey(dateKey, delta) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

function diffDaysKeys(targetKey, baseKey) {
  const [y1, m1, d1] = targetKey.split('-').map(Number);
  const [y2, m2, d2] = baseKey.split('-').map(Number);
  return Math.round((Date.UTC(y1, m1 - 1, d1) - Date.UTC(y2, m2 - 1, d2)) / 86400000);
}

function localTime(date) {
  const d = localDateObj(date);
  const h = d.getUTCHours();
  const min = d.getUTCMinutes();
  return min === 0 ? `${h} horas` : `${h} e ${String(min).padStart(2, '0')}`;
}

function localClock(date = new Date()) {
  const d = localDateObj(date);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function localDateFullLabel(date = new Date()) {
  const d = localDateObj(date);
  return `${WEEKDAYS_FULL[d.getUTCDay()]}, ${d.getUTCDate()} de ${MONTHS_FULL[d.getUTCMonth()]}`;
}

function shortDayLabel(dateKey, todayKey) {
  const diff = diffDaysKeys(dateKey, todayKey);
  if (diff === 1) return 'Amanhã';
  const [y, m, d] = dateKey.split('-').map(Number);
  const wd = WEEKDAYS_SHORT[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${wd} ${String(d).padStart(2, '0')}`;
}

function listJoin(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

// "lavar louça pro gustavo amanhã" -> { title, owner, deadline }
function parseTask(text) {
  let t = ` ${String(text || '').trim()} `;
  let owner = 'Shared';
  const patterns = [
    [/\s(pro|para o|pra o|do|pro o)\s+(gus|gustavo)\b/i, 'Gus'],
    [/\s(pra|para a|pra a|da|para)\s+(isa|isabella|isabela)\b/i, 'Isa'],
    [/\s(pros dois|para os dois|pra nós|pra gente|para nós|para a gente|pro casal|para ambos|pra ambos)\b/i, 'Shared']
  ];
  patterns.forEach(([re, who]) => {
    if (re.test(t)) { owner = who; t = t.replace(re, ' '); }
  });

  let deadline = null;
  const dayAt = plusDays => {
    const nowLocal = localDateObj(new Date());
    const y = nowLocal.getUTCFullYear();
    const m = nowLocal.getUTCMonth();
    const d = nowLocal.getUTCDate() + plusDays;
    const local = new Date(Date.UTC(y, m, d, config.DEFAULT_DEADLINE_HOUR, 0, 0));
    return new Date(local.getTime() - offsetMinutes() * 60000).toISOString();
  };
  if (/\s(para |pra )?amanh(a|ã)\s/i.test(t)) { deadline = dayAt(1); t = t.replace(/\s(para |pra )?amanh(a|ã)\s/i, ' '); }
  else if (/\s(para |pra )?hoje\s/i.test(t)) { deadline = dayAt(0); t = t.replace(/\s(para |pra )?hoje\s/i, ' '); }

  let title = t.replace(/\s+/g, ' ').trim();
  title = title.charAt(0).toUpperCase() + title.slice(1);
  return { title, owner, deadline };
}

function describeWeather(code, isDay = 1) {
  const [icon, label] = WMO[code] || ['🌡️', 'Tempo'];
  if (!isDay && (code === 0 || code === 1)) return { icon: '🌙', label };
  return { icon, label };
}

function httpsGetJson(url, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 300) return reject(new Error(`HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('Weather timeout')));
  });
}

async function fetchWeather(loc) {
  if (!loc || typeof loc.lat !== 'number' || typeof loc.lon !== 'number') return null;
  const cacheKey = `${loc.lat},${loc.lon}`;
  if (weatherCache.key === cacheKey && Date.now() - weatherCache.at < 15 * 60 * 1000) {
    return weatherCache.data;
  }
  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${loc.lat}&longitude=${loc.lon}`
    + '&current=temperature_2m,apparent_temperature,weather_code,is_day'
    + '&hourly=temperature_2m,precipitation_probability,weather_code'
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
    + '&timezone=auto&forecast_days=4';
  const raw = await httpsGetJson(url, 2500);
  const cur = raw.current || {};
  const nowLocalIso = localDateObj(new Date()).toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const hTimes = (raw.hourly && raw.hourly.time) || [];
  const next12 = [];
  for (let i = 0; i < hTimes.length && next12.length < 12; i++) {
    if (hTimes[i].slice(0, 13) >= nowLocalIso) {
      next12.push({
        hour: Number(hTimes[i].slice(11, 13)),
        rain: (raw.hourly.precipitation_probability && raw.hourly.precipitation_probability[i]) || 0
      });
    }
  }
  const rainy = next12.find(h => h.rain >= 50);
  const maxRain = next12.reduce((m, h) => Math.max(m, h.rain), 0);

  const days = ((raw.daily && raw.daily.time) || []).map((t, i) => {
    const [y, m, d] = t.split('-').map(Number);
    const wd = WEEKDAYS_SHORT[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    return {
      label: wd,
      icon: describeWeather(raw.daily.weather_code[i], 1).icon,
      max: Math.round(raw.daily.temperature_2m_max[i]),
      min: Math.round(raw.daily.temperature_2m_min[i])
    };
  });

  const summary = {
    name: loc.name || '',
    temp: Math.round(cur.temperature_2m),
    ...describeWeather(cur.weather_code, cur.is_day),
    todayMax: days[0] ? days[0].max : null,
    todayMin: days[0] ? days[0].min : null,
    rainAlert: rainy
      ? `Chance de chuva às ${rainy.hour}h (${rainy.rain}%) ☔`
      : (maxRain >= 30 ? `Possibilidade de chuva (${maxRain}%)` : ''),
    nextDays: days.slice(1, 4)
  };
  weatherCache = { key: cacheKey, at: Date.now(), data: summary };
  return summary;
}

// ---------------------------------------------------------------------------
// Snapshot de dados (espelha a lógica do painel.js)
// ---------------------------------------------------------------------------

function sortTasksForPanel(tasks, todayKey, nowMs) {
  const rank = t => {
    if (!t.deadline) return 2;
    const dMs = new Date(t.deadline).getTime();
    if (dMs < nowMs) return 0;
    if (localDateKey(new Date(dMs)) <= todayKey) return 1;
    return 3;
  };
  return [...tasks].sort((a, b) =>
    rank(a) - rank(b)
    || (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1)
    || (a.deadline && b.deadline ? new Date(a.deadline) - new Date(b.deadline) : 0)
    || new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
}

function deadlineBadgeInfo(task, todayKey, nowMs) {
  if (!task.deadline) return null;
  const d = new Date(task.deadline);
  const dKey = localDateKey(d);
  if (d.getTime() < nowMs) return { text: 'atrasada', bg: '#7F1D1D', fg: '#FECACA' };
  if (dKey === todayKey) return { text: localClock(d), bg: '#78350F', fg: '#FDE68A' };
  if (dKey === addDaysKey(todayKey, 1)) return { text: 'amanhã', bg: '#334155', fg: '#E2E8F0' };
  const [, m, day] = dKey.split('-');
  return { text: `${day}/${m}`, bg: '#334155', fg: '#CBD5E1' };
}

async function loadSnapshot({ includeWeather = true } = {}) {
  const [data, events, settings] = await Promise.all([
    fb.loadData().catch(() => ({})),
    fb.loadCalendar().catch(() => []),
    fb.loadSettings().catch(() => ({}))
  ]);

  let weather = null;
  if (includeWeather && settings && settings.weather) {
    weather = await fetchWeather(settings.weather).catch(() => null);
  }

  const now = new Date();
  const nowMs = now.getTime();
  const today = localDateKey(now);

  const eventMatchesDay = (ev, dayKey) => (ev.allDay
    ? ev.start <= dayKey && (ev.end > dayKey || ev.end === ev.start)
    : localDateKey(new Date(ev.start)) === dayKey);

  const todaysEvents = events
    .filter(ev => eventMatchesDay(ev, today))
    .sort((a, b) => (a.allDay === b.allDay ? (a.start < b.start ? -1 : 1) : (a.allDay ? -1 : 1)));

  const allTasks = fb.entries(data.tasks).map(e => e.value);
  const pending = allTasks.filter(t => !t.completed);
  const dueToday = pending.filter(t => t.deadline && localDateKey(new Date(t.deadline)) <= today);

  // Itens de hoje (Google Agenda + tarefas com prazo hoje)
  const todayAgenda = [
    ...todaysEvents.map(ev => ({
      kind: 'event',
      id: ev.id,
      title: ev.title || '(sem título)',
      owner: ev.owner || 'Shared',
      allDay: Boolean(ev.allDay),
      timeLabel: ev.allDay ? 'Dia todo' : localClock(new Date(ev.start)),
      sortKey: ev.allDay ? '00:00' : localClock(new Date(ev.start)),
      location: ev.location || ''
    })),
    ...allTasks
      .filter(t => t.deadline && localDateKey(new Date(t.deadline)) === today)
      .map(t => ({
        kind: 'task',
        id: t.id,
        title: t.title,
        owner: t.owner || 'Shared',
        completed: Boolean(t.completed),
        timeLabel: localClock(new Date(t.deadline)),
        sortKey: localClock(new Date(t.deadline))
      }))
  ].sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));

  // Próximos 6 dias
  const upcoming = [];
  for (let i = 1; i <= 6 && upcoming.length < 4; i++) {
    const dk = addDaysKey(today, i);
    const dayEvs = events.filter(ev => eventMatchesDay(ev, dk));
    const dayTasks = pending.filter(t => t.deadline && localDateKey(new Date(t.deadline)) === dk);
    const items = [
      ...dayEvs.map(ev => ({ title: ev.title, owner: ev.owner || 'Shared', time: ev.allDay ? '' : localClock(new Date(ev.start)) })),
      ...dayTasks.map(t => ({ title: t.title, owner: t.owner || 'Shared', time: localClock(new Date(t.deadline)) }))
    ];
    if (items.length > 0) upcoming.push({ label: shortDayLabel(dk, today), items });
  }

  // Mural: pinned mais recente ou nota mais recente
  const notes = fb.entries(data.notes).map(e => e.value);
  const pinnedNotes = notes.filter(n => n.pinned);
  const notePool = pinnedNotes.length > 0 ? pinnedNotes : notes;
  notePool.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  const latestNote = notePool[0] || null;

  // Progresso do dia (igual painel.js)
  const scopeToday = allTasks.filter(t =>
    (!t.completed && (!t.deadline || localDateKey(new Date(t.deadline)) <= today))
    || (t.completed && t.completedAt && localDateKey(new Date(t.completedAt)) === today));
  const doneTodayAll = scopeToday.filter(t => t.completed);

  // Streak
  const doneDays = new Set(allTasks.filter(t => t.completed && t.completedAt).map(t => localDateKey(new Date(t.completedAt))));
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const dk = addDaysKey(today, -i);
    if (doneDays.has(dk)) streak++;
    else if (i > 0) break;
  }

  // Próxima meta com targetDate
  const projects = fb.entries(data.projects)
    .map(e => e.value)
    .filter(p => p && p.targetDate && String(p.targetDate).slice(0, 10) >= today)
    .sort((a, b) => (String(a.targetDate) < String(b.targetDate) ? -1 : 1));
  let nextGoal = null;
  if (projects.length > 0) {
    const g = projects[0];
    const days = diffDaysKeys(String(g.targetDate).slice(0, 10), today);
    nextGoal = days === 0 ? `🚀 ${g.name}: é hoje!` : `🚀 ${g.name}: faltam ${days} dia${days === 1 ? '' : 's'}`;
  }

  return {
    nowMs,
    today,
    data,
    events,
    todaysEvents,
    todayAgenda,
    upcoming,
    allTasks,
    pending,
    dueToday,
    scopeTodayTotal: scopeToday.length,
    doneTodayAll,
    streak,
    nextGoal,
    latestNote,
    settings,
    weather
  };
}

// ---------------------------------------------------------------------------
// Painel Visual APL 2023.3 — visual 1:1 com o Modo Painel web (painel.html)
// ---------------------------------------------------------------------------

function buildPersonCardApl(snap, { key, label, emoji, capBg }) {
  const ownerTasks = snap.allTasks.filter(t => (t.owner || 'Shared') === key);
  const pending = sortTasksForPanel(ownerTasks.filter(t => !t.completed), snap.today, snap.nowMs);
  const doneToday = ownerTasks
    .filter(t => t.completed && t.completedAt && localDateKey(new Date(t.completedAt)) === snap.today)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

  const totalToday = pending.length + doneToday.length;
  const pct = totalToday > 0 ? Math.round((doneToday.length / totalToday) * 100) : 0;
  const allDone = pending.length === 0 && doneToday.length > 0;
  const countText = `${pending.length === 0 ? 'Tudo em dia!' : `${pending.length} pendente${pending.length === 1 ? '' : 's'}`} · ${doneToday.length} feita${doneToday.length === 1 ? '' : 's'} hoje`;

  const listItems = [];

  if (pending.length === 0 && doneToday.length === 0) {
    listItems.push({
      type: 'Frame',
      width: '100%',
      backgroundColor: '#191E2A',
      borderColor: '#333C4F',
      borderWidth: '1.5dp',
      borderRadius: '12dp',
      paddingTop: '14dp',
      paddingBottom: '14dp',
      paddingLeft: '12dp',
      paddingRight: '12dp',
      item: {
        type: 'Text',
        text: 'Sem tarefas 🌸',
        color: '#94A3B8',
        fontSize: '15dp',
        fontWeight: '600',
        textAlign: 'center',
        width: '100%'
      }
    });
  } else {
    pending.slice(0, 12).forEach(t => {
      const badge = deadlineBadgeInfo(t, snap.today, snap.nowMs);
      const rowItems = [
        {
          type: 'Frame',
          width: '20dp',
          height: '20dp',
          borderRadius: '6dp',
          borderColor: '#94A3B8',
          borderWidth: '2dp',
          backgroundColor: '#1A1F2B'
        },
        {
          type: 'Text',
          text: `${t.emoji || '✨'} ${t.title}`,
          color: '#F8FAFC',
          fontSize: '15dp',
          fontWeight: '700',
          maxLines: 1,
          grow: 1,
          shrink: 1,
          spacing: '8dp'
        }
      ];

      if (t.priority === 'High') {
        rowItems.push({
          type: 'Frame',
          width: '20dp',
          height: '20dp',
          borderRadius: '10dp',
          backgroundColor: '#FB7185',
          spacing: '6dp',
          item: {
            type: 'Text',
            text: '!',
            color: '#0F172A',
            fontSize: '13dp',
            fontWeight: '900',
            textAlign: 'center',
            textAlignVertical: 'center',
            width: '100%',
            height: '100%'
          }
        });
      }

      if (badge) {
        rowItems.push({
          type: 'Frame',
          backgroundColor: badge.bg,
          borderRadius: '7dp',
          paddingLeft: '6dp',
          paddingRight: '6dp',
          paddingTop: '2dp',
          paddingBottom: '2dp',
          spacing: '6dp',
          item: {
            type: 'Text',
            text: badge.text,
            color: badge.fg,
            fontSize: '11dp',
            fontWeight: '800',
            maxLines: 1
          }
        });
      }

      listItems.push({
        type: 'TouchWrapper',
        width: '100%',
        spacing: listItems.length > 0 ? '8dp' : '0dp',
        onPress: {
          type: 'SendEvent',
          arguments: ['completeTask', t.id]
        },
        item: {
          type: 'Frame',
          width: '100%',
          backgroundColor: '#262C3B',
          borderColor: '#0A0D12',
          borderWidth: '2dp',
          borderRadius: '12dp',
          paddingLeft: '10dp',
          paddingRight: '10dp',
          paddingTop: '9dp',
          paddingBottom: '9dp',
          item: {
            type: 'Container',
            direction: 'row',
            alignItems: 'center',
            width: '100%',
            items: rowItems
          }
        }
      });
    });

    doneToday.slice(0, 4).forEach(t => {
      listItems.push({
        type: 'Frame',
        width: '100%',
        spacing: '8dp',
        backgroundColor: '#1B202C',
        borderColor: '#2B3242',
        borderWidth: '1.5dp',
        borderRadius: '12dp',
        paddingLeft: '10dp',
        paddingRight: '10dp',
        paddingTop: '8dp',
        paddingBottom: '8dp',
        item: {
          type: 'Container',
          direction: 'row',
          alignItems: 'center',
          width: '100%',
          items: [
            {
              type: 'Frame',
              width: '20dp',
              height: '20dp',
              borderRadius: '6dp',
              backgroundColor: '#10B981',
              item: {
                type: 'Text',
                text: '✓',
                color: '#052E16',
                fontSize: '13dp',
                fontWeight: '900',
                textAlign: 'center',
                textAlignVertical: 'center',
                width: '100%',
                height: '100%'
              }
            },
            {
              type: 'Text',
              text: `${t.emoji || '✨'} ${t.title}`,
              color: '#64748B',
              fontSize: '14dp',
              fontWeight: '600',
              maxLines: 1,
              grow: 1,
              shrink: 1,
              spacing: '8dp'
            }
          ]
        }
      });
    });

    if (pending.length > 12) {
      listItems.push({
        type: 'Text',
        text: `+${pending.length - 12} mais no app`,
        color: '#94A3B8',
        fontSize: '13dp',
        fontWeight: '700',
        textAlign: 'center',
        width: '100%',
        spacing: '8dp'
      });
    }
  }

  return {
    type: 'Frame',
    grow: 1,
    basis: '0dp',
    height: '100%',
    spacing: '12dp',
    backgroundColor: '#1E2330',
    borderColor: '#0A0D12',
    borderWidth: '2dp',
    borderRadius: '18dp',
    item: {
      type: 'Container',
      width: '100%',
      height: '100%',
      items: [
        // Pastel Header Cap
        {
          type: 'Frame',
          width: '100%',
          backgroundColor: capBg,
          borderRadii: {
            topLeft: '16dp',
            topRight: '16dp',
            bottomLeft: '0dp',
            bottomRight: '0dp'
          },
          paddingLeft: '12dp',
          paddingRight: '12dp',
          paddingTop: '11dp',
          paddingBottom: '11dp',
          item: {
            type: 'Container',
            direction: 'row',
            alignItems: 'center',
            width: '100%',
            items: [
              {
                type: 'Frame',
                width: '38dp',
                height: '38dp',
                backgroundColor: '#FFFFFF',
                borderColor: '#0F172A',
                borderWidth: '2dp',
                borderRadius: '11dp',
                item: {
                  type: 'Text',
                  text: emoji,
                  fontSize: '21dp',
                  textAlign: 'center',
                  textAlignVertical: 'center',
                  width: '100%',
                  height: '100%'
                }
              },
              {
                type: 'Container',
                grow: 1,
                shrink: 1,
                spacing: '10dp',
                items: [
                  {
                    type: 'Text',
                    text: `${label}${allDone ? ' 🎉' : ''}`,
                    color: '#0F172A',
                    fontSize: '19dp',
                    fontWeight: '800',
                    maxLines: 1
                  },
                  {
                    type: 'Text',
                    text: countText,
                    color: '#334155',
                    fontSize: '12dp',
                    fontWeight: '700',
                    maxLines: 1
                  }
                ]
              },
              {
                type: 'Frame',
                minWidth: '30dp',
                height: '30dp',
                backgroundColor: '#14171F',
                borderRadius: '10dp',
                paddingLeft: '8dp',
                paddingRight: '8dp',
                spacing: '6dp',
                item: {
                  type: 'Text',
                  text: String(pending.length),
                  color: '#FFFFFF',
                  fontSize: '14dp',
                  fontWeight: '800',
                  textAlign: 'center',
                  textAlignVertical: 'center',
                  height: '100%'
                }
              }
            ]
          }
        },
        // Thin Progress Strip
        {
          type: 'Frame',
          width: '100%',
          height: '4dp',
          backgroundColor: '#14171F',
          ...(pct > 0 ? {
            item: {
              type: 'Frame',
              width: `${pct}%`,
              height: '100%',
              backgroundColor: '#10B981'
            }
          } : {})
        },
        // Scrollable Dark Task List
        {
          type: 'ScrollView',
          grow: 1,
          width: '100%',
          item: {
            type: 'Container',
            width: '100%',
            paddingLeft: '10dp',
            paddingRight: '10dp',
            paddingTop: '10dp',
            paddingBottom: '10dp',
            items: listItems
          }
        }
      ]
    }
  };
}

function buildAgendaColumnApl(snap) {
  const ownerAccent = { Gus: '#AEEAD5', Isa: '#FFD4B8', Shared: '#FDE88A' };
  const todayItems = [];

  if (snap.todayAgenda.length === 0) {
    todayItems.push({
      type: 'Frame',
      width: '100%',
      backgroundColor: '#191E2A',
      borderColor: '#333C4F',
      borderWidth: '1.5dp',
      borderRadius: '12dp',
      paddingTop: '14dp',
      paddingBottom: '14dp',
      paddingLeft: '12dp',
      paddingRight: '12dp',
      item: {
        type: 'Text',
        text: 'Nada marcado para hoje 🌿',
        color: '#94A3B8',
        fontSize: '14dp',
        fontWeight: '600',
        textAlign: 'center',
        width: '100%'
      }
    });
  } else {
    snap.todayAgenda.slice(0, 7).forEach(item => {
      const accent = ownerAccent[item.owner] || '#FDE88A';
      todayItems.push({
        type: 'Frame',
        width: '100%',
        spacing: todayItems.length > 0 ? '8dp' : '0dp',
        backgroundColor: '#262C3B',
        borderColor: '#0A0D12',
        borderWidth: '2dp',
        borderRadius: '12dp',
        paddingLeft: '10dp',
        paddingRight: '10dp',
        paddingTop: '9dp',
        paddingBottom: '9dp',
        item: {
          type: 'Container',
          direction: 'row',
          alignItems: 'center',
          width: '100%',
          items: [
            {
              type: 'Frame',
              width: '5dp',
              height: '24dp',
              borderRadius: '3dp',
              backgroundColor: accent
            },
            {
              type: 'Text',
              text: item.timeLabel,
              color: '#94A3B8',
              fontSize: '13dp',
              fontWeight: '800',
              spacing: '8dp',
              maxLines: 1
            },
            {
              type: 'Text',
              text: item.title,
              color: item.completed ? '#64748B' : '#F8FAFC',
              fontSize: '14dp',
              fontWeight: '700',
              maxLines: 1,
              grow: 1,
              shrink: 1,
              spacing: '8dp'
            },
            {
              type: 'Frame',
              backgroundColor: accent,
              borderRadius: '8dp',
              paddingLeft: '7dp',
              paddingRight: '7dp',
              paddingTop: '2dp',
              paddingBottom: '2dp',
              spacing: '6dp',
              item: {
                type: 'Text',
                text: OWNER_SHORT[item.owner] || 'Ambos',
                color: '#0F172A',
                fontSize: '11dp',
                fontWeight: '800',
                maxLines: 1
              }
            }
          ]
        }
      });
    });
  }

  const upcomingItems = [];
  if (snap.upcoming.length === 0) {
    upcomingItems.push({
      type: 'Frame',
      width: '100%',
      backgroundColor: '#191E2A',
      borderColor: '#333C4F',
      borderWidth: '1.5dp',
      borderRadius: '10dp',
      paddingTop: '10dp',
      paddingBottom: '10dp',
      paddingLeft: '10dp',
      paddingRight: '10dp',
      item: {
        type: 'Text',
        text: 'Semana tranquila por enquanto ✨',
        color: '#94A3B8',
        fontSize: '13dp',
        fontWeight: '600',
        textAlign: 'center',
        width: '100%'
      }
    });
  } else {
    snap.upcoming.slice(0, 3).forEach(day => {
      const summary = day.items.slice(0, 2).map(i => (i.time ? `${i.time} ${i.title}` : i.title)).join(' · ');
      upcomingItems.push({
        type: 'Container',
        direction: 'row',
        alignItems: 'center',
        width: '100%',
        spacing: upcomingItems.length > 0 ? '6dp' : '0dp',
        items: [
          {
            type: 'Text',
            text: day.label,
            color: '#FBBF24',
            fontSize: '12dp',
            fontWeight: '800',
            width: '58dp',
            maxLines: 1
          },
          {
            type: 'Text',
            text: summary + (day.items.length > 2 ? ` +${day.items.length - 2}` : ''),
            color: '#CBD5E1',
            fontSize: '13dp',
            fontWeight: '600',
            maxLines: 1,
            grow: 1,
            shrink: 1,
            spacing: '6dp'
          }
        ]
      });
    });
  }

  const countLabel = snap.todayAgenda.length === 0
    ? 'livre'
    : `${snap.todayAgenda.length} ite${snap.todayAgenda.length === 1 ? 'm' : 'ns'}`;

  return {
    type: 'Frame',
    width: '26%',
    height: '100%',
    backgroundColor: '#1E2330',
    borderColor: '#0A0D12',
    borderWidth: '2.5dp',
    borderRadius: '18dp',
    padding: '14dp',
    item: {
      type: 'Container',
      width: '100%',
      height: '100%',
      items: [
        // Header Hoje + badge
        {
          type: 'Container',
          direction: 'row',
          justifyContent: 'spaceBetween',
          alignItems: 'center',
          width: '100%',
          paddingBottom: '12dp',
          items: [
            {
              type: 'Text',
              text: '📅 Hoje',
              color: '#F8FAFC',
              fontSize: '20dp',
              fontWeight: '800'
            },
            {
              type: 'Frame',
              backgroundColor: '#2B3242',
              borderColor: '#3B4459',
              borderWidth: '1.5dp',
              borderRadius: '10dp',
              paddingLeft: '9dp',
              paddingRight: '9dp',
              paddingTop: '3dp',
              paddingBottom: '3dp',
              item: {
                type: 'Text',
                text: countLabel,
                color: '#CBD5E1',
                fontSize: '12dp',
                fontWeight: '700'
              }
            }
          ]
        },
        // Lista de Hoje
        {
          type: 'ScrollView',
          grow: 1,
          width: '100%',
          item: {
            type: 'Container',
            width: '100%',
            items: todayItems
          }
        },
        // Divisória + Próximos Dias
        {
          type: 'Frame',
          width: '100%',
          height: '1.5dp',
          backgroundColor: '#2E3648',
          spacing: '10dp'
        },
        {
          type: 'Text',
          text: 'PRÓXIMOS DIAS',
          color: '#64748B',
          fontSize: '11dp',
          fontWeight: '800',
          letterSpacing: '1dp',
          spacing: '8dp',
          paddingBottom: '6dp'
        },
        {
          type: 'Container',
          width: '100%',
          items: upcomingItems
        }
      ]
    }
  };
}

function buildWeatherCardApl(w) {
  if (!w) return null;
  const infoItems = [
    {
      type: 'Text',
      text: w.label,
      color: '#F8FAFC',
      fontSize: '14dp',
      fontWeight: '800',
      maxLines: 1
    },
    {
      type: 'Text',
      text: `${w.todayMax !== null ? `${w.todayMax}° / ${w.todayMin}° · ` : ''}${w.name}`,
      color: '#94A3B8',
      fontSize: '12dp',
      fontWeight: '600',
      maxLines: 1
    }
  ];
  if (w.rainAlert) {
    infoItems.push({
      type: 'Text',
      text: w.rainAlert,
      color: '#60A5FA',
      fontSize: '12dp',
      fontWeight: '700',
      maxLines: 1
    });
  }

  const dayColumns = (w.nextDays || []).slice(0, 3).map((d, idx) => ({
    type: 'Container',
    alignItems: 'center',
    spacing: idx > 0 ? '10dp' : '0dp',
    items: [
      { type: 'Text', text: d.label, color: '#94A3B8', fontSize: '11dp', fontWeight: '700' },
      { type: 'Text', text: d.icon, fontSize: '17dp' },
      { type: 'Text', text: `${d.max}° ${d.min}°`, color: '#E2E8F0', fontSize: '11dp', fontWeight: '700' }
    ]
  }));

  const rowItems = [
    { type: 'Text', text: w.icon, fontSize: '30dp' },
    { type: 'Text', text: `${w.temp}°`, color: '#FFFFFF', fontSize: '34dp', fontWeight: '800', spacing: '8dp' },
    { type: 'Container', spacing: '10dp', maxWidth: '170dp', items: infoItems }
  ];

  if (dayColumns.length > 0) {
    rowItems.push({
      type: 'Frame',
      width: '1.5dp',
      height: '46dp',
      backgroundColor: '#2F374A',
      spacing: '12dp'
    });
    rowItems.push({
      type: 'Container',
      direction: 'row',
      alignItems: 'center',
      spacing: '12dp',
      items: dayColumns
    });
  }

  return {
    type: 'Frame',
    spacing: '14dp',
    backgroundColor: '#1E2330',
    borderColor: '#0A0D12',
    borderWidth: '2.5dp',
    borderRadius: '16dp',
    paddingLeft: '14dp',
    paddingRight: '14dp',
    paddingTop: '8dp',
    paddingBottom: '8dp',
    item: {
      type: 'Container',
      direction: 'row',
      alignItems: 'center',
      items: rowItems
    }
  };
}

function buildAplDashboardDirective(snap, statusBanner = '') {
  const noteColor = NOTE_COLORS[(snap.latestNote && snap.latestNote.color) || 'blue'] || NOTE_COLORS.blue;
  const noteAuthor = snap.latestNote ? (OWNER_LABELS[snap.latestNote.user] || 'Vocês').toUpperCase() : 'MURAL';
  const noteQuote = snap.latestNote
    ? `“${snap.latestNote.text}”`
    : 'Diga "deixar um recado..." para fixar um bilhete aqui';

  const headerItems = [
    // Relógio ao vivo + Data amarela
    {
      type: 'Container',
      minWidth: '175dp',
      items: [
        {
          type: 'Text',
          text: "${Time.hours(localTime) < 10 ? '0' : ''}${Time.hours(localTime)}:${Time.minutes(localTime) < 10 ? '0' : ''}${Time.minutes(localTime)}",
          color: '#FFFFFF',
          fontSize: '44dp',
          fontWeight: '800',
          lineHeight: 0.95
        },
        {
          type: 'Text',
          text: localDateFullLabel(),
          color: '#FBBF24',
          fontSize: '14dp',
          fontWeight: '700',
          paddingTop: '2dp',
          maxLines: 1
        }
      ]
    },
    // Cartão do Recado do Mural no centro
    {
      type: 'Frame',
      grow: 1,
      shrink: 1,
      spacing: '14dp',
      backgroundColor: noteColor.bg,
      borderColor: '#0A0D12',
      borderWidth: '2.5dp',
      borderRadius: '16dp',
      paddingLeft: '16dp',
      paddingRight: '16dp',
      paddingTop: '10dp',
      paddingBottom: '10dp',
      item: {
        type: 'Container',
        width: '100%',
        items: [
          {
            type: 'Text',
            text: `💗 RECADO DE ${noteAuthor}`,
            color: noteColor.label,
            fontSize: '11dp',
            fontWeight: '800',
            letterSpacing: '0.8dp',
            maxLines: 1
          },
          {
            type: 'Text',
            text: noteQuote,
            color: '#0F172A',
            fontSize: '17dp',
            fontWeight: '800',
            fontStyle: 'italic',
            maxLines: 2,
            paddingTop: '2dp'
          }
        ]
      }
    }
  ];

  const weatherCard = buildWeatherCardApl(snap.weather);
  if (weatherCard) headerItems.push(weatherCard);

  // Barra de progresso no rodapé
  const totalToday = snap.scopeTodayTotal;
  const doneCount = snap.doneTodayAll.length;
  const pctTotal = totalToday > 0 ? Math.round((doneCount / totalToday) * 100) : 0;
  const progressLabel = totalToday === 0 ? 'Dia livre ✨' : `${doneCount} de ${totalToday} hoje`;

  const footerItems = [
    {
      type: 'Text',
      text: progressLabel,
      color: '#CBD5E1',
      fontSize: '13dp',
      fontWeight: '800',
      maxLines: 1
    },
    {
      type: 'Frame',
      grow: 1,
      shrink: 1,
      height: '10dp',
      spacing: '12dp',
      backgroundColor: '#252B3B',
      borderColor: '#0A0D12',
      borderWidth: '1dp',
      borderRadius: '6dp',
      ...(pctTotal > 0 ? {
        item: {
          type: 'Frame',
          width: `${pctTotal}%`,
          height: '100%',
          backgroundColor: '#10B981',
          borderRadius: '5dp'
        }
      } : {})
    }
  ];

  if (snap.streak >= 2) {
    footerItems.push({
      type: 'Frame',
      spacing: '10dp',
      backgroundColor: '#292218',
      borderColor: '#F59E0B',
      borderWidth: '1.5dp',
      borderRadius: '10dp',
      paddingLeft: '10dp',
      paddingRight: '10dp',
      paddingTop: '4dp',
      paddingBottom: '4dp',
      item: {
        type: 'Text',
        text: `🔥 ${snap.streak} dias`,
        color: '#FDE68A',
        fontSize: '12dp',
        fontWeight: '800',
        maxLines: 1
      }
    });
  }

  if (snap.nextGoal) {
    footerItems.push({
      type: 'Frame',
      spacing: '10dp',
      backgroundColor: '#222836',
      borderColor: '#384155',
      borderWidth: '1.5dp',
      borderRadius: '12dp',
      paddingLeft: '12dp',
      paddingRight: '12dp',
      paddingTop: '4dp',
      paddingBottom: '4dp',
      item: {
        type: 'Text',
        text: snap.nextGoal,
        color: '#F8FAFC',
        fontSize: '12dp',
        fontWeight: '800',
        maxLines: 1
      }
    });
  }

  footerItems.push({
    type: 'Text',
    text: statusBanner || '🎙️ Toque numa tarefa para concluir',
    color: statusBanner ? '#FDE047' : '#94A3B8',
    fontSize: '12dp',
    fontWeight: statusBanner ? '800' : '600',
    spacing: '12dp',
    maxLines: 1
  });

  // Pill "● Ao vivo" clicável para atualizar na hora
  footerItems.push({
    type: 'TouchWrapper',
    spacing: '10dp',
    onPress: {
      type: 'SendEvent',
      arguments: ['refresh']
    },
    item: {
      type: 'Frame',
      backgroundColor: '#1F2633',
      borderColor: '#2E3A4D',
      borderWidth: '1.5dp',
      borderRadius: '12dp',
      paddingLeft: '10dp',
      paddingRight: '10dp',
      paddingTop: '4dp',
      paddingBottom: '4dp',
      item: {
        type: 'Text',
        text: '🟢 Ao vivo',
        color: '#A7F3D0',
        fontSize: '12dp',
        fontWeight: '800',
        maxLines: 1
      }
    }
  });

  const document = {
    type: 'APL',
    version: '2023.3',
    theme: 'dark',
    mainTemplate: {
      items: [
        {
          type: 'Container',
          width: '100vw',
          height: '100vh',
          backgroundColor: '#14171F',
          paddingLeft: '20dp',
          paddingRight: '20dp',
          paddingTop: '14dp',
          paddingBottom: '12dp',
          items: [
            // TOP BAR
            {
              type: 'Container',
              direction: 'row',
              alignItems: 'center',
              width: '100%',
              paddingBottom: '14dp',
              items: headerItems
            },
            // MAIN 4-COLUMN BODY
            {
              type: 'Container',
              direction: 'row',
              grow: 1,
              width: '100%',
              items: [
                buildAgendaColumnApl(snap),
                buildPersonCardApl(snap, { key: 'Gus', label: 'Gustavo', emoji: '👦🏻', capBg: '#AEEAD5' }),
                buildPersonCardApl(snap, { key: 'Isa', label: 'Isabella', emoji: '👩🏻', capBg: '#FFD4B8' }),
                buildPersonCardApl(snap, { key: 'Shared', label: 'Ambos', emoji: '❤️', capBg: '#FDE88A' })
              ]
            },
            // BOTTOM STATUS BAR
            {
              type: 'Container',
              direction: 'row',
              alignItems: 'center',
              width: '100%',
              paddingTop: '10dp',
              items: footerItems
            }
          ]
        }
      ]
    }
  };

  return {
    type: 'Alexa.Presentation.APL.RenderDocument',
    token: APL_TOKEN,
    document
  };
}

// ---------------------------------------------------------------------------
// Fala do resumo de hoje
// ---------------------------------------------------------------------------

function buildTodaySpeech(snap) {
  let speech = '';
  if (snap.todaysEvents.length === 0) speech += 'Hoje não tem nenhum compromisso na agenda. ';
  else {
    speech += `Na agenda de hoje: ${listJoin(snap.todaysEvents.slice(0, 5).map(ev => {
      const who = { Gus: ', do Gustavo', Isa: ', da Isabella', Shared: '' }[ev.owner] || '';
      return ev.allDay ? `${ev.title}${who}` : `${ev.title} às ${localTime(new Date(ev.start))}${who}`;
    }))}. `;
  }

  if (snap.dueToday.length === 0) {
    speech += snap.pending.length > 0
      ? `Nenhuma tarefa com prazo pra hoje, mas tem ${snap.pending.length} pendente${snap.pending.length === 1 ? '' : 's'} no total.`
      : 'E nenhuma tarefa pendente. Aproveitem!';
  } else {
    const byOwner = ['Gus', 'Isa', 'Shared'].map(o => [o, snap.dueToday.filter(t => (t.owner || 'Shared') === o)]).filter(([, l]) => l.length);
    speech += `Tarefas pra hoje: ${byOwner.map(([o, l]) => {
      const label = o === 'Shared' ? 'para os dois' : `para ${OWNER_NAMES[o] === 'Gustavo' ? 'o Gustavo' : 'a Isabella'}`;
      return `${label}, ${listJoin(l.slice(0, 4).map(t => t.title))}`;
    }).join('; ')}.`;
  }
  return speech;
}

async function todaySpeech() {
  return buildTodaySpeech(await loadSnapshot({ includeWeather: false }));
}

// ---------------------------------------------------------------------------
// Intents e Eventos de Toque APL
// ---------------------------------------------------------------------------

async function handleIntent(event, attrs) {
  const name = event.request.intent.name;
  const hasApl = supportsApl(event);
  const panelOpen = Boolean(attrs.panelOpen);
  const htmlOpen = Boolean(attrs.htmlOpen);

  const finish = async (speech, toast, refreshVisual = false) => {
    const directives = [];
    if (hasApl && (panelOpen || refreshVisual)) {
      const snap = await loadSnapshot({ includeWeather: true });
      directives.push(buildAplDashboardDirective(snap, toast || ''));
    } else if (htmlOpen && toast) {
      directives.push(toastDirective(toast));
    }
    const keepScreen = hasApl ? (panelOpen || refreshVisual) : htmlOpen;
    return respond({
      speech,
      directives,
      endSession: keepScreen ? undefined : true,
      attributes: keepScreen ? { ...attrs, panelOpen: true } : attrs
    });
  };

  switch (name) {
    case 'AdicionarTarefaIntent': {
      const raw = slotValue(event, 'tarefa');
      if (!raw) return respond({ speech: 'O que eu devo adicionar?', reprompt: 'Diga, por exemplo: adicionar lavar a louça pro Gustavo.', endSession: false, attributes: attrs });
      const info = parseTask(raw);
      await fb.addTask(info);
      const quem = { Shared: 'pra vocês dois', Gus: 'pro Gustavo', Isa: 'pra Isabella' }[info.owner];
      return finish(`Pronto! Anotei ${info.title} ${quem}${info.deadline ? (/amanh/i.test(raw) ? ', para amanhã' : ', para hoje') : ''}.`, `🎙️ Adicionada: "${info.title}"`, true);
    }
    case 'MercadoIntent': {
      const item = slotValue(event, 'item');
      if (!item) return respond({ speech: 'O que precisa comprar?', endSession: false, attributes: attrs });
      const title = item.charAt(0).toUpperCase() + item.slice(1);
      const { list } = await fb.addTask({ title, owner: 'Shared', listHint: 'mercado', emoji: '🛒' });
      return finish(`Coloquei ${item} na lista ${list.name}.`, `🛒 ${title} na lista ${list.name}`, true);
    }
    case 'HojeIntent':
      return finish(await todaySpeech(), '', true);
    case 'ConcluirTarefaIntent': {
      const q = slotValue(event, 'tarefa');
      if (!q) return respond({ speech: 'Qual tarefa vocês terminaram?', endSession: false, attributes: attrs });
      const result = await fb.completeTask(q);
      if (result.task) return finish(`Boa! Marquei ${result.task.title} como feita.`, `✅ "${result.task.title}" concluída`, true);
      if (result.found.length === 0) return finish(`Não achei nenhuma tarefa pendente parecida com ${q}.`);
      return finish(`Achei ${result.found.length} tarefas parecidas: ${listJoin(result.found.slice(0, 3).map(t => t.title))}. Fala o nome mais completo.`);
    }
    case 'RecadoIntent': {
      const text = slotValue(event, 'recado');
      if (!text) return respond({ speech: 'Qual é o recado?', endSession: false, attributes: attrs });
      await fb.addNote(text.charAt(0).toUpperCase() + text.slice(1));
      return finish('Recado fixado no mural!', '💌 Novo recado no mural', true);
    }
    case 'CarinhoIntent': {
      const para = slotValue(event, 'pessoa');
      const de = para === 'Gus' ? 'Isa' : 'Gus';
      const tipo = slotValue(event, 'carinho') || 'beijo';
      const textos = { beijo: '😘 Um beijo!', abraco: '🤗 Um abraço apertado!', 'te amo': '❤️ Te amo muito!', saudade: '🥰 Saudade!' };
      await fb.sendNudge(de, textos[fb.normalize(tipo)] || `💌 ${tipo}`);
      return finish(`Mandei ${para === 'Gus' ? 'pro Gustavo' : 'pra Isabella'}!`, '💛 Carinho enviado!');
    }
    case 'AbrirPainelIntent':
      return launch(event, attrs);
    case 'AMAZON.HelpIntent':
      return respond({
        speech: 'Você pode dizer: adicionar lavar a louça pro Gustavo; comprar leite; o que tem pra hoje; marcar lavar a louça como feita; ou deixar um recado. O que vai ser?',
        reprompt: 'O que vai ser?',
        endSession: false,
        attributes: attrs
      });
    case 'AMAZON.StopIntent':
    case 'AMAZON.CancelIntent':
    case 'AMAZON.NavigateHomeIntent':
      return respond({ speech: 'Até mais!', endSession: true });
    case 'AMAZON.FallbackIntent':
    default:
      return respond({
        speech: 'Não entendi. Tente: adicionar comprar ração pro Bruce, ou: o que tem pra hoje.',
        endSession: (panelOpen || htmlOpen) ? undefined : false,
        attributes: attrs
      });
  }
}

async function handleAplUserEvent(event, attrs) {
  const args = (event.request && event.request.arguments) || [];
  const action = args[0];

  if (action === 'completeTask' && args[1]) {
    const completed = await fb.completeTaskById(args[1]);
    const snap = await loadSnapshot({ includeWeather: true });
    const banner = completed ? `✅ "${completed.title}" concluída!` : '🔄 Painel atualizado!';
    return respond({
      speech: completed ? `Boa! ${completed.title} concluída.` : null,
      directives: supportsApl(event) ? [buildAplDashboardDirective(snap, banner)] : [],
      attributes: { ...attrs, panelOpen: true }
    });
  }

  const snap = await loadSnapshot({ includeWeather: true });
  return respond({
    directives: supportsApl(event) ? [buildAplDashboardDirective(snap, '🔄 Atualizado agora!')] : [],
    attributes: { ...attrs, panelOpen: true }
  });
}

async function launch(event, attrs) {
  if (supportsApl(event)) {
    const snap = await loadSnapshot({ includeWeather: true });
    const resumoCurto = snap.todaysEvents.length > 0
      ? `Abrindo o painel de vocês. Hoje há ${snap.todaysEvents.length} compromisso${snap.todaysEvents.length === 1 ? '' : 's'} e ${snap.pending.length} tarefa${snap.pending.length === 1 ? '' : 's'} pendente${snap.pending.length === 1 ? '' : 's'}.`
      : `Abrindo o painel de vocês. ${snap.pending.length} tarefa${snap.pending.length === 1 ? '' : 's'} pendente${snap.pending.length === 1 ? '' : 's'}.`;
    return respond({
      speech: resumoCurto,
      directives: [buildAplDashboardDirective(snap)],
      attributes: { ...attrs, panelOpen: true }
    });
  }

  if (supportsHtml(event)) {
    return respond({
      speech: 'Abrindo o painel de vocês.',
      directives: [startPanelDirective()],
      attributes: { ...attrs, htmlOpen: true }
    });
  }

  const speech = await todaySpeech();
  return respond({
    speech: `${speech} Quer adicionar alguma coisa?`,
    reprompt: 'Quer adicionar alguma tarefa?',
    endSession: false,
    attributes: attrs
  });
}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

exports.handler = async event => {
  const req = event.request || {};
  const attrs = (event.session && event.session.attributes) || {};
  try {
    switch (req.type) {
      case 'LaunchRequest':
        return await launch(event, attrs);
      case 'IntentRequest':
        return await handleIntent(event, attrs);
      case 'Alexa.Presentation.APL.UserEvent':
        return await handleAplUserEvent(event, attrs);
      case 'Alexa.Presentation.HTML.Message':
        return respond({ attributes: { ...attrs, htmlOpen: true } });
      case 'SessionEndedRequest':
        return respond({});
      default:
        return respond({ attributes: attrs });
    }
  } catch (err) {
    console.error('Erro na skill:', err);
    return respond({ speech: 'Ops, não consegui falar com a lista agora. Tenta de novo daqui a pouco.', endSession: true });
  }
};

// Exportado para testes
exports._parseTask = parseTask;
exports._buildAplDashboardDirective = buildAplDashboardDirective;
