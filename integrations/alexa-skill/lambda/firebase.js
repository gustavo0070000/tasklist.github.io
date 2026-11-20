// Firebase Realtime Database via REST (regras do app permitem tasks/{chave} e leitura de calendar/{chave}).
const https = require('https');
const config = require('./config');

function request(method, path, body) {
  const base = config.FIREBASE_URL.replace(/\/+$/, '');
  const url = new URL(`${base}/${path}.json`);
  const payload = body === undefined ? null : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method,
      headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}
    }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 300) return reject(new Error(`Firebase ${method} ${path}: ${res.statusCode} ${data.slice(0, 200)}`));
        try { resolve(data ? JSON.parse(data) : null); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(6000, () => req.destroy(new Error('Firebase timeout')));
    if (payload) req.write(payload);
    req.end();
  });
}

const get = path => request('GET', path);
const put = (path, v) => request('PUT', path, v);
const patch = (path, v) => request('PATCH', path, v);

function entries(node) {
  if (!node) return [];
  if (Array.isArray(node)) return node.map((v, i) => ({ key: String(i), value: v })).filter(e => e.value);
  return Object.keys(node).map(k => ({ key: k, value: node[k] })).filter(e => e.value);
}

function nextIndex(node) {
  return entries(node).reduce((max, e) => Math.max(max, Number(e.key)), -1) + 1;
}

const root = () => `tasks/${config.SECRET_KEY}`;

async function loadData() {
  return (await get(root())) || {};
}

async function logHistory(data, action, details) {
  const history = entries(data.history).map(e => e.value);
  const log = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    user: 'Shared',
    action,
    timestamp: new Date().toISOString(),
    via: 'alexa',
    ...details
  };
  await patch(root(), {
    history: [log, ...history].slice(0, 50),
    lastUpdated: log.timestamp,
    lastUpdatedBy: 'Alexa'
  });
  return log;
}

function findList(data, hint) {
  const lists = entries(data.lists).map(e => e.value);
  if (hint) {
    const h = normalize(hint);
    const match = lists.find(l => normalize(l.name).includes(h));
    if (match) return match;
  }
  return lists[0] || { id: 'l-geral', name: 'Casa & Rotina' };
}

async function addTask({ title, owner = 'Shared', deadline = null, listHint = null, emoji = '✨' }) {
  const data = await loadData();
  const list = findList(data, listHint);
  const now = new Date();
  const task = {
    id: `t-${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
    listId: list.id,
    projectId: null,
    title,
    completed: false,
    completedBy: null,
    completedAt: null,
    createdBy: owner === 'Shared' ? 'Gus' : owner,
    createdAt: now.toISOString(),
    deadline,
    owner,
    priority: 'Medium',
    recurrence: 'none',
    emoji,
    svgKey: null,
    subtasks: [],
    comments: []
  };
  await put(`${root()}/tasks/${nextIndex(data.tasks)}`, task);
  await logHistory(data, 'add_task', { taskId: task.id, taskTitle: title, listName: list.name });
  return { task, list };
}

async function completeTask(match) {
  const data = await loadData();
  const pending = entries(data.tasks).filter(e => !e.value.completed);
  const q = normalize(match);
  const found = pending.filter(e => normalize(e.value.title).includes(q) || q.includes(normalize(e.value.title)));
  if (found.length !== 1) return { found: found.map(e => e.value) };
  const entry = found[0];
  await patch(`${root()}/tasks/${entry.key}`, {
    completed: true,
    completedBy: entry.value.owner || 'Shared',
    completedAt: new Date().toISOString()
  });
  await logHistory(data, 'complete_task', { taskId: entry.value.id, taskTitle: entry.value.title, user: entry.value.owner || 'Shared' });
  return { task: entry.value };
}

async function addNote(text) {
  const data = await loadData();
  const note = { id: `n-${Date.now()}`, user: 'Shared', text, color: 'yellow', pinned: false, reactions: {}, timestamp: new Date().toISOString() };
  await put(`${root()}/notes/${nextIndex(data.notes)}`, note);
  await logHistory(data, 'add_note', { noteId: note.id, noteText: text.slice(0, 24) + (text.length > 24 ? '...' : '') });
  return note;
}

async function sendNudge(from, text) {
  const data = await loadData();
  return logHistory(data, 'nudge', { nudgeText: text, user: from });
}

async function loadCalendar() {
  const cal = (await get(`calendar/${config.SECRET_KEY}`)) || {};
  return entries(cal.events).map(e => e.value);
}

function normalize(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

module.exports = { loadData, loadCalendar, addTask, completeTask, addNote, sendNudge, entries, normalize };
