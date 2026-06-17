// Notifications management module for Tasklist

let lastLoggedId = null;
let notificationSound = null;
let lastKnownReactions = {}; // logId -> stringified reactions

// Initialize notifications state
export function initNotifications(initialHistory) {
  // Store the ID of the most recent log so we don't notify on startup
  if (initialHistory && initialHistory.length > 0) {
    lastLoggedId = initialHistory[0].id;
    
    // Populate initial reactions to avoid notifying on start
    initialHistory.forEach(log => {
      lastKnownReactions[log.id] = JSON.stringify(log.reactions || {});
    });
  }
  
  // Preload sound
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      notificationSound = new AudioContext();
    }
  } catch (e) {
    console.warn("Web Audio API not supported:", e);
  }
}

// Request permission to send notifications
export function requestPermission() {
  if (!('Notification' in window)) {
    console.log("This browser does not support notifications.");
    return Promise.resolve('unsupported');
  }
  
  return Notification.requestPermission().then(permission => {
    console.log("Notification permission:", permission);
    return permission;
  });
}

// Play a sweet, soft zen chime (Synthesized via Web Audio API)
export function playZenChime() {
  if (!notificationSound) return;
  
  try {
    const ctx = notificationSound;
    // Resume context if suspended (browser security policies)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    // Zen chime frequencies (E5 and B5)
    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
    
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1.2);
  } catch (e) {
    console.error("Failed to play notification chime:", e);
  }
}

// Display a browser Notification and play sound
export function showNotification(title, body) {
  playZenChime();
  
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }
  
  try {
    const options = {
      body: body,
      icon: 'assets/icon-192.png',
      badge: 'assets/favicon.png',
      vibrate: [100, 50, 100],
      tag: 'tasklist-alert'
    };
    
    // Try showing it via service worker first (best for PWA)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(title, options);
      });
    } else {
      new Notification(title, options);
    }
  } catch (e) {
    console.error("Error displaying notification:", e);
  }
}

// Check history logs for new activities by the OTHER user
export function checkNewActivities(history, currentUser) {
  if (!history || history.length === 0) return;
  
  const latestLog = history[0];
  
  // If lastLoggedId is null, it means we are initializing
  if (lastLoggedId === null) {
    lastLoggedId = latestLog.id;
    return;
  }
  
  // If we see a new log and it wasn't made by the current user
  if (latestLog.id !== lastLoggedId) {
    // Collect all new logs since lastLoggedId
    const newLogs = [];
    for (const log of history) {
      if (log.id === lastLoggedId) break;
      newLogs.push(log);
    }
    
    // Update the lastLoggedId tracker
    lastLoggedId = latestLog.id;
    
    // Notify for logs done by other users
    const externalLogs = newLogs.filter(log => log.user !== currentUser);
    if (externalLogs.length > 0) {
      // Notify for the latest one
      const logToNotify = externalLogs[0];
      const title = "Tasklist de Gus & Isa";
      let body = "";
      
      switch (logToNotify.action) {
        case 'add_task':
          body = `${logToNotify.user} adicionou: "${logToNotify.taskTitle}" na lista "${logToNotify.listName}"`;
          break;
        case 'complete_task':
          body = `${logToNotify.user} concluiu: "${logToNotify.taskTitle}"`;
          break;
        case 'uncomplete_task':
          body = `${logToNotify.user} desmarcou: "${logToNotify.taskTitle}"`;
          break;
        case 'delete_task':
          body = `${logToNotify.user} removeu a tarefa: "${logToNotify.taskTitle}"`;
          break;
        case 'add_list':
          body = `${logToNotify.user} criou a lista: "${logToNotify.listName}"`;
          break;
        case 'delete_list':
          body = `${logToNotify.user} excluiu a lista: "${logToNotify.listName}"`;
          break;
        default:
          body = `${logToNotify.user} atualizou a lista de tarefas.`;
      }
      
      showNotification(title, body);
    }
  }
}

// Check for new emoji reactions by the OTHER user
export function checkNewReactions(history, currentUser) {
  if (!history) return;
  
  const isFirstRun = Object.keys(lastKnownReactions).length === 0;
  
  history.forEach(log => {
    const logId = log.id;
    const reactions = log.reactions || {};
    const stringified = JSON.stringify(reactions);
    
    if (isFirstRun) {
      lastKnownReactions[logId] = stringified;
      return;
    }
    
    const previous = lastKnownReactions[logId];
    if (previous !== stringified) {
      // Find new reactions not made by current user
      Object.keys(reactions).forEach(user => {
        if (user !== currentUser) {
          const prevReactions = previous ? JSON.parse(previous) : {};
          if (!prevReactions[user]) {
            // New reaction detected!
            const emoji = reactions[user];
            let description = "uma atividade";
            if (log.action === 'complete_task') {
              description = `você concluir "${log.taskTitle}"`;
            } else if (log.action === 'add_task') {
              description = `você adicionar "${log.taskTitle}"`;
            }
            
            showNotification(
              "Agradecimento recebido! ❤️", 
              `${user} enviou um ${emoji} por ${description}!`
            );
          }
        }
      });
      lastKnownReactions[logId] = stringified;
    }
  });
}
