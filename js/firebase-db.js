// Firebase Realtime Database & Offline Local Storage Layer for Tasklist
// 100% backward compatible with existing Firebase RTDB schema at tasks/{secretKey}

const LOCAL_MODE_KEY = 'tasklist_local_mode';
const LOCAL_DATA_KEY = 'tasklist_local_data_v1';

let dbRef = null;
let connectedRef = null;
let currentConfig = null;
let isInitialized = false;
let localListeners = [];

// Convert Firebase RTDB snapshot objects/nulls safely into JS arrays
function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === 'object') return Object.values(val).filter(Boolean);
  return [];
}

// Normalize database structure so every view has guaranteed valid arrays
export function normalizeData(raw) {
  const base = raw && typeof raw === 'object' ? raw : getEmptyTemplate();
  const groups = toArray(base.groups);
  const lists = toArray(base.lists);

  if (groups.length === 0) {
    groups.push({ id: 'g-geral', name: 'Geral', createdAt: new Date().toISOString() });
  }
  if (lists.length === 0) {
    lists.push({
      id: 'l-geral',
      name: 'Casa & Rotina',
      groupId: groups[0].id,
      owner: 'Shared',
      createdAt: new Date().toISOString()
    });
  }

  const tasks = toArray(base.tasks).map(t => ({
    ...t,
    owner: t.owner || 'Shared',
    priority: t.priority || 'Medium',
    recurrence: t.recurrence || 'none',
    subtasks: toArray(t.subtasks),
    comments: toArray(t.comments)
  }));

  return {
    version: base.version || 1,
    lastUpdated: base.lastUpdated || new Date().toISOString(),
    lastUpdatedBy: base.lastUpdatedBy || 'System',
    lastSummarySent: base.lastSummarySent || null,
    groups,
    lists,
    tasks,
    projects: toArray(base.projects),
    notes: toArray(base.notes),
    wishlist: toArray(base.wishlist),
    history: toArray(base.history)
  };
}

// --- Configuration Helpers ---

export function getSavedConfig() {
  const configStr = localStorage.getItem('tasklist_firebase_config');
  const secretKey = localStorage.getItem('tasklist_secret_key');
  const currentUser = localStorage.getItem('tasklist_current_user') || 'Gus';

  if (!configStr || !secretKey) return null;

  try {
    return {
      firebaseConfig: JSON.parse(configStr),
      secretKey,
      currentUser
    };
  } catch (e) {
    console.error('Error parsing saved config:', e);
    return null;
  }
}

export function saveConfig(firebaseConfig, secretKey, currentUser) {
  localStorage.setItem('tasklist_firebase_config', JSON.stringify(firebaseConfig));
  localStorage.setItem('tasklist_secret_key', secretKey);
  localStorage.setItem('tasklist_current_user', currentUser || 'Gus');
  localStorage.removeItem(LOCAL_MODE_KEY);
}

export function clearConfig() {
  localStorage.removeItem('tasklist_firebase_config');
  localStorage.removeItem('tasklist_secret_key');
  localStorage.removeItem(LOCAL_MODE_KEY);
  dbRef = null;
  isInitialized = false;
  currentConfig = null;
}

export function getCurrentUser() {
  return localStorage.getItem('tasklist_current_user') || 'Gus';
}

export function setCurrentUser(user) {
  localStorage.setItem('tasklist_current_user', user);
  if (currentConfig) {
    currentConfig.currentUser = user;
  }
}

// --- Local / Offline Mode Support ---

export function isLocalMode() {
  return !getSavedConfig() && localStorage.getItem(LOCAL_MODE_KEY) === 'true';
}

export function enableLocalMode(user = 'Gus') {
  localStorage.setItem(LOCAL_MODE_KEY, 'true');
  localStorage.setItem('tasklist_current_user', user);
  if (!localStorage.getItem(LOCAL_DATA_KEY)) {
    localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(getStarterLocalTemplate()));
  }
}

export function disableLocalMode() {
  localStorage.removeItem(LOCAL_MODE_KEY);
}

export function getLocalDataSnapshot() {
  try {
    const raw = localStorage.getItem(LOCAL_DATA_KEY);
    if (raw) return normalizeData(JSON.parse(raw));
  } catch (e) {
    console.warn('Could not read local data:', e);
  }
  return getStarterLocalTemplate();
}

export function resetLocalDataToStarter() {
  const starter = getStarterLocalTemplate();
  localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(starter));
  localListeners.forEach(cb => cb(starter));
  return starter;
}

// --- Firebase Realtime Initialization ---

export function initFirebase() {
  const config = getSavedConfig();
  if (!config) {
    isInitialized = false;
    return false;
  }

  try {
    if (!window.firebase) {
      console.error('Firebase SDK is not loaded. Make sure script tags are in index.html');
      return false;
    }

    // Re-use existing app or re-initialize if database URL changed
    if (firebase.apps.length === 0) {
      firebase.initializeApp(config.firebaseConfig);
    }

    const db = firebase.database();
    dbRef = db.ref('tasks/' + config.secretKey);
    connectedRef = db.ref('.info/connected');
    isInitialized = true;
    currentConfig = config;
    return true;
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    isInitialized = false;
    return false;
  }
}

export function listenToConnectionStatus(callback) {
  if (isLocalMode()) {
    callback('local');
    return () => {};
  }
  if (!connectedRef) {
    callback('offline');
    return () => {};
  }
  const handler = snap => {
    callback(snap.val() === true ? 'online' : 'reconnecting');
  };
  connectedRef.on('value', handler);
  return () => connectedRef && connectedRef.off('value', handler);
}

export function listenToData(callback) {
  if (isLocalMode()) {
    const data = getLocalDataSnapshot();
    localListeners.push(callback);
    // Defer slightly for consistent async lifecycle
    setTimeout(() => callback(data), 0);
    return () => {
      localListeners = localListeners.filter(fn => fn !== callback);
    };
  }

  if (!isInitialized && !initFirebase()) {
    return () => {};
  }

  const listener = dbRef.on(
    'value',
    snapshot => {
      const val = snapshot.val();
      if (val) {
        callback(normalizeData(val));
      } else {
        callback(getEmptyTemplate());
      }
    },
    error => {
      console.error('Firebase read error:', error);
    }
  );

  return () => dbRef && dbRef.off('value', listener);
}

export function updateDatabase(data) {
  const cleanData = JSON.parse(JSON.stringify(data));
  cleanData.lastUpdated = new Date().toISOString();
  cleanData.lastUpdatedBy = getCurrentUser();

  if (isLocalMode()) {
    try {
      localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(cleanData));
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  }

  if (!isInitialized && !initFirebase()) {
    return Promise.reject(new Error('Firebase não inicializado'));
  }

  return dbRef.set(cleanData);
}

export function logAction(data, actionType, details) {
  const history = data.history || [];

  const newLog = {
    id: 'log-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    user: getCurrentUser(),
    action: actionType,
    timestamp: new Date().toISOString(),
    ...details
  };

  data.history = [newLog, ...history].slice(0, 50);
  return newLog;
}

// Empty template for brand-new Firebase databases
export function getEmptyTemplate() {
  const now = new Date().toISOString();
  return {
    version: 1,
    lastUpdated: now,
    lastUpdatedBy: 'System',
    lastSummarySent: null,
    groups: [
      { id: 'g-geral', name: 'Geral', createdAt: now }
    ],
    lists: [
      { id: 'l-geral', name: 'Casa & Rotina', groupId: 'g-geral', owner: 'Shared', createdAt: now }
    ],
    tasks: [],
    projects: [],
    notes: [],
    wishlist: [],
    history: []
  };
}

// Friendly starter template for Local / Demo Mode (inspired by Gustavo & Isabella's list)
export function getStarterLocalTemplate() {
  const now = new Date();
  const iso = now.toISOString();
  const todayEvening = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0).toISOString();
  const tomorrowNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 14, 0, 0).toISOString();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 15, 18, 0, 0).toISOString();

  return {
    version: 1,
    lastUpdated: iso,
    lastUpdatedBy: 'System',
    lastSummarySent: null,
    groups: [
      { id: 'g-geral', name: 'Nossa Casa', createdAt: iso }
    ],
    lists: [
      { id: 'l-casa', name: 'Organização da Casa', groupId: 'g-geral', owner: 'Shared', createdAt: iso },
      { id: 'l-mercado', name: 'Mercado', groupId: 'g-geral', owner: 'Shared', createdAt: iso }
    ],
    tasks: [
      {
        id: 't-g1', listId: 'l-casa', title: 'Forms do Google', owner: 'Gus', priority: 'Medium',
        recurrence: 'none', svgKey: 'forms', emoji: '📋', completed: false, completedBy: null,
        completedAt: null, createdBy: 'Gus', createdAt: iso, deadline: todayEvening, subtasks: [], comments: []
      },
      {
        id: 't-g2', listId: 'l-casa', title: 'Lavar louça', owner: 'Gus', priority: 'High',
        recurrence: 'daily', svgKey: 'dishes', emoji: '🍽️', completed: false, completedBy: null,
        completedAt: null, createdBy: 'Gus', createdAt: iso, deadline: todayEvening, subtasks: [], comments: []
      },
      {
        id: 't-g3', listId: 'l-casa', title: 'Limpar cozinha', owner: 'Gus', priority: 'Medium',
        recurrence: 'none', svgKey: 'kitchen', emoji: '🧹', completed: false, completedBy: null,
        completedAt: null, createdBy: 'Gus', createdAt: iso, deadline: null, subtasks: [], comments: []
      },
      {
        id: 't-i1', listId: 'l-casa', title: 'Atv. da faculdade', owner: 'Isa', priority: 'High',
        recurrence: 'none', svgKey: 'college', emoji: '📚', completed: false, completedBy: null,
        completedAt: null, createdBy: 'Isa', createdAt: iso, deadline: todayEvening, subtasks: [
          { id: 'st-1', title: 'Revisar slides da semana', completed: true },
          { id: 'st-2', title: 'Enviar atividade no portal', completed: false }
        ], comments: []
      },
      {
        id: 't-i2', listId: 'l-casa', title: 'Limpar banheiros', owner: 'Isa', priority: 'Medium',
        recurrence: 'weekly', svgKey: 'bathroom', emoji: '🫧', completed: false, completedBy: null,
        completedAt: null, createdBy: 'Isa', createdAt: iso, deadline: null, subtasks: [], comments: []
      },
      {
        id: 't-i3', listId: 'l-casa', title: 'Estender roupa', owner: 'Isa', priority: 'Low',
        recurrence: 'none', svgKey: 'laundry', emoji: '👕', completed: false, completedBy: null,
        completedAt: null, createdBy: 'Isa', createdAt: iso, deadline: null, subtasks: [], comments: []
      },
      {
        id: 't-a1', listId: 'l-casa', title: 'Bruce na casa', owner: 'Shared', priority: 'High',
        recurrence: 'none', svgKey: 'bruce', emoji: '🐶', completed: false, completedBy: null,
        completedAt: null, createdBy: 'Gus', createdAt: iso, deadline: tomorrowNoon, subtasks: [], comments: [
          { id: 'c-1', user: 'Isa', text: 'Não esquecer o petisco favorito dele!', timestamp: iso }
        ]
      },
      {
        id: 't-a2', listId: 'l-casa', title: 'Fazer sorvete', owner: 'Shared', priority: 'Low',
        recurrence: 'none', svgKey: 'iceCream', emoji: '🍦', completed: false, completedBy: null,
        completedAt: null, createdBy: 'Isa', createdAt: iso, deadline: null, subtasks: [], comments: []
      },
      {
        id: 't-a3', listId: 'l-casa', title: 'Guardar roupas', owner: 'Shared', priority: 'Medium',
        recurrence: 'none', svgKey: 'wardrobe', emoji: '🧥', completed: false, completedBy: null,
        completedAt: null, createdBy: 'Gus', createdAt: iso, deadline: null, subtasks: [], comments: []
      },
      {
        id: 't-m1', listId: 'l-mercado', title: 'Comprar leite, frutas e café', owner: 'Shared', priority: 'Medium',
        recurrence: 'weekly', svgKey: 'market', emoji: '🛒', completed: false, completedBy: null,
        completedAt: null, createdBy: 'Gus', createdAt: iso, deadline: tomorrowNoon, subtasks: [], comments: []
      }
    ],
    projects: [
      { id: 'p-demo1', name: 'Viagem de Férias ✈️', targetDate: nextMonth, createdAt: iso }
    ],
    notes: [
      {
        id: 'n-demo1',
        user: 'Isa',
        text: 'Quando terminarmos tudo hoje, tem sorvete com o Bruce! 🍦🐶💛',
        color: 'yellow',
        pinned: true,
        reactions: { Gus: '❤️' },
        timestamp: iso
      }
    ],
    wishlist: [
      {
        id: 'w-demo1',
        user: 'Shared',
        title: 'Cafeteira Espresso para a cozinha',
        link: '',
        notes: 'Cor preta ou inox',
        price: '',
        purchased: false,
        createdBy: 'Gus',
        timestamp: iso
      }
    ],
    history: [
      {
        id: 'log-init',
        user: 'Isa',
        action: 'add_note',
        noteId: 'n-demo1',
        noteText: 'Quando terminarmos...',
        timestamp: iso,
        reactions: { Gus: '❤️' }
      }
    ]
  };
}
