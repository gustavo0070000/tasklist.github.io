// IFTTT Webhook Morning Summary Integration

// Get IFTTT configuration from localStorage
export function getIftttConfig() {
  const key = localStorage.getItem('tasklist_ifttt_key') || '';
  const event = localStorage.getItem('tasklist_ifttt_event') || 'tasklist_summary';
  return { key, event };
}

// Save IFTTT configuration
export function saveIftttConfig(key, event) {
  localStorage.setItem('tasklist_ifttt_key', key);
  localStorage.setItem('tasklist_ifttt_event', event || 'tasklist_summary');
}

// Fire a test webhook immediately
export function fireTestWebhook(data, currentUser) {
  const { key, event } = getIftttConfig();
  if (!key) return Promise.reject("Chave IFTTT não configurada.");
  
  const textSummary = buildTextSummary(data);
  const today = new Date().toLocaleDateString('pt-BR');
  
  return triggerWebhook(key, event, {
    value1: `Teste de ${currentUser} - ${today}`,
    value2: textSummary,
    value3: window.location.href
  });
}

// Lazy Cron: Checks if summary was sent today. If not and time is > 6 AM, send it!
export function checkAndTriggerMorningSummary(data, updateDbCallback) {
  const { key, event } = getIftttConfig();
  if (!key) return; // Not configured
  
  const now = new Date();
  const currentHour = now.getHours();
  
  // Only trigger after 6:00 AM
  if (currentHour < 6) return;
  
  // Date format: YYYY-MM-DD
  const todayDateStr = now.toISOString().split('T')[0];
  
  // If already sent today, skip
  if (data.lastSummarySent === todayDateStr) {
    return;
  }
  
  console.log("Lazy Cron: Triggering IFTTT morning summary webhook...");
  
  // Set flag immediately to avoid race conditions/double sends
  data.lastSummarySent = todayDateStr;
  updateDbCallback(data)
    .then(() => {
      const textSummary = buildTextSummary(data);
      const todayFormatted = now.toLocaleDateString('pt-BR');
      
      triggerWebhook(key, event, {
        value1: `Resumo Matinal - ${todayFormatted}`,
        value2: textSummary,
        value3: window.location.href
      }).then(() => {
        console.log("IFTTT morning summary triggered successfully!");
      }).catch(err => {
        console.error("Failed to send IFTTT summary webhook:", err);
      });
    })
    .catch(console.error);
}

// Helper: Format a clean text summary of today's tasks
function buildTextSummary(data) {
  if (!data || !data.tasks || data.tasks.length === 0) {
    return "Nenhuma tarefa cadastrada no momento. Bom dia! 🌸";
  }
  
  const openTasks = data.tasks.filter(t => !t.completed);
  if (openTasks.length === 0) {
    return "Todas as tarefas foram concluídas! Vocês estão livres hoje! 🎉";
  }
  
  let text = `Vocês têm ${openTasks.length} tarefas pendentes:\n\n`;
  
  // Group by owner
  const gusTasks = openTasks.filter(t => t.owner === 'Gus');
  const isaTasks = openTasks.filter(t => t.owner === 'Isa');
  const sharedTasks = openTasks.filter(t => t.owner === 'Shared' || !t.owner);
  
  if (sharedTasks.length > 0) {
    text += `👪 Compartilhadas:\n`;
    sharedTasks.forEach(t => {
      text += ` - ${t.title}${t.deadline ? ' (Limite: ' + formatShortDate(t.deadline) + ')' : ''}\n`;
    });
    text += `\n`;
  }
  
  if (gusTasks.length > 0) {
    text += `🧔 Gus:\n`;
    gusTasks.forEach(t => {
      text += ` - ${t.title}${t.deadline ? ' (Limite: ' + formatShortDate(t.deadline) + ')' : ''}\n`;
    });
    text += `\n`;
  }
  
  if (isaTasks.length > 0) {
    text += `👩 Isa:\n`;
    isaTasks.forEach(t => {
      text += ` - ${t.title}${t.deadline ? ' (Limite: ' + formatShortDate(t.deadline) + ')' : ''}\n`;
    });
    text += `\n`;
  }
  
  return text;
}

// Helper: format deadline date in a compact text
function formatShortDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  });
}

// Trigger standard IFTTT Maker Webhook
function triggerWebhook(key, eventName, payload) {
  const url = `https://maker.ifttt.com/trigger/${eventName}/with/key/${key}`;
  
  // Use no-cors mode if standard cors fails (IFTTT webhook triggers on fetch even with no-cors!)
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    mode: 'cors'
  }).then(response => {
    if (!response.ok && response.status !== 0) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return "success";
  }).catch(err => {
    // If standard fetch fails due to CORS, trigger via Image beacon fallback or try no-cors
    console.warn("IFTTT CORS issue, retrying with no-cors mode...");
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      mode: 'no-cors'
    }).then(() => "success");
  });
}
