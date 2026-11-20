/**
 * Acesso ao Firebase Realtime Database via REST, autenticado com o OAuth da
 * própria conta Google (dono do projeto) — ignora as regras de segurança, por
 * isso o nó calendar/ pode ficar "somente leitura" para os navegadores.
 */
function fbUrl_(path) {
  var base = String(cfg('FIREBASE_URL')).replace(/\/+$/, '');
  return base + '/' + path + '.json';
}

function fbRequest_(method, path, body, query) {
  var url = fbUrl_(path) + '?access_token=' + encodeURIComponent(ScriptApp.getOAuthToken()) + (query ? '&' + query : '');
  var options = { method: method, muteHttpExceptions: true, contentType: 'application/json' };
  if (body !== undefined) options.payload = JSON.stringify(body);
  var res = UrlFetchApp.fetch(url, options);
  var code = res.getResponseCode();
  if (code >= 300) throw new Error('Firebase ' + method + ' ' + path + ' -> ' + code + ': ' + res.getContentText().slice(0, 300));
  var text = res.getContentText();
  return text ? JSON.parse(text) : null;
}

function fbGet(path, query) { return fbRequest_('get', path, undefined, query); }
function fbPut(path, value) { return fbRequest_('put', path, value); }
function fbPatch(path, value) { return fbRequest_('patch', path, value); }
function fbDelete(path) { return fbRequest_('delete', path); }

function secret_() { return cfg('SECRET_KEY'); }

// Firebase devolve arrays como array OU objeto (quando há buracos)
function toEntries_(node) {
  if (!node) return [];
  if (Array.isArray(node)) {
    var out = [];
    node.forEach(function (v, i) { if (v) out.push({ key: String(i), value: v }); });
    return out;
  }
  return Object.keys(node).map(function (k) { return { key: k, value: node[k] }; }).filter(function (e) { return e.value; });
}

function nextIndex_(node) {
  var entries = toEntries_(node);
  var max = -1;
  entries.forEach(function (e) { var n = parseInt(e.key, 10); if (!isNaN(n) && n > max) max = n; });
  return max + 1;
}

function loadData_() {
  var data = fbGet('tasks/' + secret_()) || {};
  return data;
}

// Registra no histórico (mesmo formato do app) e atualiza lastUpdated
function logHistory_(data, action, details) {
  var history = toEntries_(data.history).map(function (e) { return e.value; });
  var log = {
    id: 'log-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    user: details.user || 'Shared',
    action: action,
    timestamp: new Date().toISOString()
  };
  Object.keys(details).forEach(function (k) { log[k] = details[k]; });
  history.unshift(log);
  history = history.slice(0, 50);
  fbPatch('tasks/' + secret_(), {
    history: history,
    lastUpdated: new Date().toISOString(),
    lastUpdatedBy: log.user
  });
  return log;
}

function findListId_(data, nameHint) {
  var lists = toEntries_(data.lists).map(function (e) { return e.value; });
  if (nameHint) {
    var hint = normalizeText_(nameHint);
    var match = lists.filter(function (l) { return normalizeText_(l.name).indexOf(hint) !== -1; })[0];
    if (match) return match;
  }
  return lists[0] || { id: 'l-geral', name: 'Casa & Rotina' };
}

function addTaskRemote(title, owner, opts) {
  opts = opts || {};
  var data = loadData_();
  var list = findListId_(data, opts.listHint);
  var now = new Date();
  var task = {
    id: 't-' + now.getTime() + '-' + Math.random().toString(36).slice(2, 6),
    listId: list.id,
    projectId: null,
    title: title,
    completed: false,
    completedBy: null,
    completedAt: null,
    createdBy: opts.by && opts.by !== 'Shared' ? opts.by : 'Gus',
    createdAt: now.toISOString(),
    deadline: opts.deadline || null,
    owner: owner || 'Shared',
    priority: opts.priority || 'Medium',
    recurrence: 'none',
    emoji: opts.emoji || (list.name && /mercado|compra/i.test(list.name) ? '🛒' : '✨'),
    svgKey: null,
    subtasks: [],
    comments: []
  };
  fbPut('tasks/' + secret_() + '/tasks/' + nextIndex_(data.tasks), task);
  logHistory_(data, 'add_task', { taskId: task.id, taskTitle: title, listName: list.name, user: opts.by || 'Shared', via: opts.via || 'script' });
  return task;
}

function completeTaskRemote(taskId, who, via) {
  var data = loadData_();
  var entry = toEntries_(data.tasks).filter(function (e) { return e.value.id === taskId; })[0];
  if (!entry) return null;
  fbPatch('tasks/' + secret_() + '/tasks/' + entry.key, {
    completed: true,
    completedBy: who || entry.value.owner || 'Shared',
    completedAt: new Date().toISOString()
  });
  logHistory_(data, 'complete_task', { taskId: taskId, taskTitle: entry.value.title, user: who || 'Shared', via: via || 'script' });
  return entry.value;
}

function addNoteRemote(text, who, via) {
  var data = loadData_();
  var note = {
    id: 'n-' + Date.now(),
    user: who || 'Shared',
    text: text,
    color: 'yellow',
    pinned: false,
    reactions: {},
    timestamp: new Date().toISOString()
  };
  fbPut('tasks/' + secret_() + '/notes/' + nextIndex_(data.notes), note);
  logHistory_(data, 'add_note', { noteId: note.id, noteText: text.slice(0, 24) + (text.length > 24 ? '...' : ''), user: who || 'Shared', via: via || 'script' });
  return note;
}

function sendNudgeRemote(text, who, via) {
  var data = loadData_();
  return logHistory_(data, 'nudge', { nudgeText: text, user: who, via: via || 'script' });
}

function pendingTasks_(data) {
  return toEntries_(data.tasks).map(function (e) { return e.value; }).filter(function (t) { return !t.completed; });
}

function normalizeText_(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}
