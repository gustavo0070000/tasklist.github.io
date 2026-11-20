// IFTTT Webhook Morning Summary Integration + WhatsApp Formatted Summary Builder

export function getIftttConfig() {
  const key = localStorage.getItem('tasklist_ifttt_key') || '';
  const event = localStorage.getItem('tasklist_ifttt_event') || 'tasklist_summary';
  return { key, event };
}

export function saveIftttConfig(key, event) {
  localStorage.setItem('tasklist_ifttt_key', key);
  localStorage.setItem('tasklist_ifttt_event', event || 'tasklist_summary');
}

export function fireTestWebhook(data, currentUser) {
  const { key, event } = getIftttConfig();
  if (!key) return Promise.reject('Chave IFTTT não configurada.');

  const textSummary = buildTextSummary(data);
  const today = new Date().toLocaleDateString('pt-BR');

  return triggerWebhook(key, event, {
    value1: `Teste de ${currentUser} - ${today}`,
    value2: textSummary,
    value3: window.location.href
  });
}

// Lazy Cron: Checks if summary was sent today. If not and time is >= 6 AM, send it
export function checkAndTriggerMorningSummary(data, updateDbCallback) {
  const { key, event } = getIftttConfig();
  if (!key) return;

  const now = new Date();
  if (now.getHours() < 6) return;

  const todayDateStr = now.toISOString().split('T')[0];
  if (data.lastSummarySent === todayDateStr) return;

  data.lastSummarySent = todayDateStr;
  updateDbCallback(data)
    .then(() => {
      const textSummary = buildTextSummary(data);
      const todayFormatted = now.toLocaleDateString('pt-BR');

      return triggerWebhook(key, event, {
        value1: `Resumo Matinal - ${todayFormatted}`,
        value2: textSummary,
        value3: window.location.href
      });
    })
    .catch(err => console.error('Failed to send IFTTT summary webhook:', err));
}

// WhatsApp-friendly checklist summary grouped by Gustavo, Isabella & Ambos
export function buildWhatsAppSummary(tasks, headerLabel = 'LISTA DE TAREFAS') {
  const list = Array.isArray(tasks) ? tasks : [];
  const done = list.filter(t => t.completed).length;
  const total = list.length;

  const formatGroup = (title, ownerKey) => {
    const groupTasks = list.filter(t => (t.owner || 'Shared') === ownerKey);
    if (groupTasks.length === 0) return `*${title}*\n(Sem tarefas)\n`;
    const lines = groupTasks
      .map(t => {
        const mark = t.completed ? '✅' : '⬜';
        const deadlineStr = t.deadline ? ` _(até ${formatShortDate(t.deadline)})_` : '';
        return `${mark} ${t.title}${deadlineStr}`;
      })
      .join('\n');
    return `*${title}*\n${lines}\n`;
  };

  return (
    `📋 *${headerLabel} (${done}/${total})*\n\n` +
    formatGroup('👦🏻 GUSTAVO', 'Gus') + '\n' +
    formatGroup('👩🏻 ISABELLA', 'Isa') + '\n' +
    formatGroup('💛 AMBOS', 'Shared')
  );
}

function buildTextSummary(data) {
  if (!data || !data.tasks || data.tasks.length === 0) {
    return 'Nenhuma tarefa cadastrada no momento. Bom dia! 🌸';
  }

  const openTasks = data.tasks.filter(t => !t.completed);
  if (openTasks.length === 0) {
    return 'Todas as tarefas foram concluídas! Vocês estão livres hoje! 🎉';
  }

  let text = `Vocês têm ${openTasks.length} tarefas pendentes:\n\n`;

  const gusTasks = openTasks.filter(t => t.owner === 'Gus');
  const isaTasks = openTasks.filter(t => t.owner === 'Isa');
  const sharedTasks = openTasks.filter(t => t.owner === 'Shared' || !t.owner);

  if (sharedTasks.length > 0) {
    text += '💛 Ambos:\n';
    sharedTasks.forEach(t => {
      text += ` - ${t.title}${t.deadline ? ' (Limite: ' + formatShortDate(t.deadline) + ')' : ''}\n`;
    });
    text += '\n';
  }

  if (gusTasks.length > 0) {
    text += '👦🏻 Gustavo:\n';
    gusTasks.forEach(t => {
      text += ` - ${t.title}${t.deadline ? ' (Limite: ' + formatShortDate(t.deadline) + ')' : ''}\n`;
    });
    text += '\n';
  }

  if (isaTasks.length > 0) {
    text += '👩🏻 Isabella:\n';
    isaTasks.forEach(t => {
      text += ` - ${t.title}${t.deadline ? ' (Limite: ' + formatShortDate(t.deadline) + ')' : ''}\n`;
    });
    text += '\n';
  }

  return text;
}

function formatShortDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function triggerWebhook(key, eventName, payload) {
  const url = `https://maker.ifttt.com/trigger/${eventName}/with/key/${key}`;

  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    mode: 'cors'
  })
    .then(response => {
      if (!response.ok && response.status !== 0) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return 'success';
    })
    .catch(() => {
      console.warn('IFTTT CORS issue, retrying with no-cors mode...');
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'no-cors'
      }).then(() => 'success');
    });
}
