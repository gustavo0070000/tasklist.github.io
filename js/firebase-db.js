// Firebase Database Integration for Tasklist

let dbRef = null;
let currentConfig = null;
let isInitialized = false;

// Load config from localStorage
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
    console.error("Error parsing saved config:", e);
    return null;
  }
}

// Save config to localStorage
export function saveConfig(firebaseConfig, secretKey, currentUser) {
  localStorage.setItem('tasklist_firebase_config', JSON.stringify(firebaseConfig));
  localStorage.setItem('tasklist_secret_key', secretKey);
  localStorage.setItem('tasklist_current_user', currentUser);
}

// Clear config
export function clearConfig() {
  localStorage.removeItem('tasklist_firebase_config');
  localStorage.removeItem('tasklist_secret_key');
  localStorage.removeItem('tasklist_current_user');
}

// Initialize Firebase dynamically
export function initFirebase() {
  const config = getSavedConfig();
  if (!config) {
    isInitialized = false;
    return false;
  }
  
  try {
    // Check if firebase is loaded on window
    if (!window.firebase) {
      console.error("Firebase SDK is not loaded. Make sure script tags are in index.html");
      return false;
    }
    
    // If already initialized, we don't initialize again but we might update reference
    if (firebase.apps.length === 0) {
      firebase.initializeApp(config.firebaseConfig);
    }
    
    const db = firebase.database();
    dbRef = db.ref('tasks/' + config.secretKey);
    isInitialized = true;
    currentConfig = config;
    return true;
  } catch (error) {
    console.error("Error initializing Firebase:", error);
    isInitialized = false;
    return false;
  }
}

// Listen to Realtime updates
export function listenToData(callback) {
  if (!isInitialized && !initFirebase()) {
    return () => {};
  }
  
  const listener = dbRef.on('value', snapshot => {
    const data = snapshot.val();
    if (data) {
      // Validate structure, ensure arrays exist
      data.groups = data.groups || [];
      data.lists = data.lists || [];
      data.tasks = data.tasks || [];
      data.history = data.history || [];
      callback(data);
    } else {
      // Return empty database template if no data exists yet
      callback(getEmptyTemplate());
    }
  }, error => {
    console.error("Firebase read error:", error);
  });
  
  // Return unsubscribe function
  return () => dbRef.off('value', listener);
}

// Push entire state to Firebase (used for edits)
export function updateDatabase(data) {
  if (!isInitialized && !initFirebase()) {
    return Promise.reject("Firebase not initialized");
  }
  
  data.lastUpdated = new Date().toISOString();
  data.lastUpdatedBy = currentConfig.currentUser;
  
  return dbRef.set(data);
}

// Log an action to the history array
export function logAction(data, actionType, details) {
  const history = data.history || [];
  
  const newLog = {
    id: 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
    user: currentConfig.currentUser,
    action: actionType, // 'add_task', 'complete_task', 'uncomplete_task', 'delete_task', etc.
    timestamp: new Date().toISOString(),
    ...details
  };
  
  // Keep only the last 50 entries
  const updatedHistory = [newLog, ...history].slice(0, 50);
  data.history = updatedHistory;
  
  return newLog;
}

// Default template for empty database
export function getEmptyTemplate() {
  return {
    version: 1,
    lastUpdated: new Date().toISOString(),
    lastUpdatedBy: "System",
    groups: [
      { id: "g-geral", name: "Geral", createdAt: new Date().toISOString() }
    ],
    lists: [
      { id: "l-geral", name: "Minhas Tarefas", groupId: "g-geral", owner: "Shared", createdAt: new Date().toISOString() }
    ],
    tasks: [],
    history: []
  };
}
