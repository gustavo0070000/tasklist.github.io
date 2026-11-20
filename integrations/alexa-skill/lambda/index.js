// ============================================================================
// Skill "nossa lista" — tasklist Gustavo & Isabella
// ----------------------------------------------------------------------------
// "Alexa, abre nossa lista"                         -> Modo Painel em tela cheia
// "Alexa, pede pra nossa lista adicionar lavar louça pro Gustavo"
// "Alexa, pede pra nossa lista comprar leite"       -> lista Mercado
// "Alexa, pergunta pra nossa lista o que tem pra hoje"
// "Alexa, pede pra nossa lista marcar lavar louça como feita"
// "Alexa, pede pra nossa lista deixar um recado ..."
// "Alexa, pede pra nossa lista mandar um beijo pra Isa"
//
// Sem dependências (Alexa-hosted ou AWS Lambda Node 18+). O painel é aberto com
// a Alexa Web API (Alexa.Presentation.HTML) — uso pessoal em modo de
// desenvolvimento; a Amazon só publica skills dessa API que sejam jogos.
// ============================================================================

const config = require('./config');
const fb = require('./firebase');

const OWNER_NAMES = { Gus: 'Gustavo', Isa: 'Isabella', Shared: 'vocês dois' };

// ---------------------------------------------------------------------------
// Utilitários de resposta
// ---------------------------------------------------------------------------

function escapeSsml(text) {
  return String(text || '').replace(/&/g, 'e').replace(/[<>"]/g, '');
}

function respond({ speech = null, reprompt = null, directives = [], endSession, attributes = {} }) {
  const response = {};
  if (speech) response.outputSpeech = { type: 'SSML', ssml: `<speak>${escapeSsml(speech)}</speak>` };
  if (reprompt) response.reprompt = { outputSpeech: { type: 'SSML', ssml: `<speak>${escapeSsml(reprompt)}</speak>` } };
  if (directives.length) response.directives = directives;
  // undefined = mantém a sessão (e o painel) sem abrir o microfone
  if (endSession !== undefined) response.shouldEndSession = endSession;
  return { version: '1.0', sessionAttributes: attributes, response };
}

function supportsHtml(event) {
  const ifaces = (((event.context || {}).System || {}).device || {}).supportedInterfaces || {};
  return Boolean(ifaces['Alexa.Presentation.HTML']);
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
    const nowLocal = new Date(Date.now() + offsetMinutes() * 60000);
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

function offsetMinutes() {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(config.UTC_OFFSET || '-03:00');
  if (!m) return -180;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

function localDateKey(date) {
  const d = new Date(date.getTime() + offsetMinutes() * 60000);
  return d.toISOString().slice(0, 10);
}

function localTime(date) {
  const d = new Date(date.getTime() + offsetMinutes() * 60000);
  const h = d.getUTCHours();
  const min = d.getUTCMinutes();
  return min === 0 ? `${h} horas` : `${h} e ${String(min).padStart(2, '0')}`;
}

function listJoin(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Intents
// ---------------------------------------------------------------------------

async function todaySpeech() {
  const [data, events] = await Promise.all([fb.loadData(), fb.loadCalendar().catch(() => [])]);
  const today = localDateKey(new Date());
  const todaysEvents = events.filter(ev => (ev.allDay
    ? ev.start <= today && (ev.end > today || ev.end === ev.start)
    : localDateKey(new Date(ev.start)) === today))
    .sort((a, b) => (a.allDay === b.allDay ? (a.start < b.start ? -1 : 1) : (a.allDay ? -1 : 1)));

  const pending = fb.entries(data.tasks).map(e => e.value).filter(t => !t.completed);
  const dueToday = pending.filter(t => t.deadline && localDateKey(new Date(t.deadline)) <= today);

  let speech = '';
  if (todaysEvents.length === 0) speech += 'Hoje não tem nenhum compromisso na agenda. ';
  else {
    speech += `Na agenda de hoje: ${listJoin(todaysEvents.slice(0, 5).map(ev => {
      const who = { Gus: ', do Gustavo', Isa: ', da Isabella', Shared: '' }[ev.owner] || '';
      return ev.allDay ? `${ev.title}${who}` : `${ev.title} às ${localTime(new Date(ev.start))}${who}`;
    }))}. `;
  }

  if (dueToday.length === 0) {
    speech += pending.length > 0
      ? `Nenhuma tarefa com prazo pra hoje, mas tem ${pending.length} pendente${pending.length === 1 ? '' : 's'} no total.`
      : 'E nenhuma tarefa pendente. Aproveitem!';
  } else {
    const byOwner = ['Gus', 'Isa', 'Shared'].map(o => [o, dueToday.filter(t => (t.owner || 'Shared') === o)]).filter(([, l]) => l.length);
    speech += `Tarefas pra hoje: ${byOwner.map(([o, l]) => {
      const label = o === 'Shared' ? 'para os dois' : `para ${OWNER_NAMES[o] === 'Gustavo' ? 'o Gustavo' : 'a Isabella'}`;
      return `${label}, ${listJoin(l.slice(0, 4).map(t => t.title))}`;
    }).join('; ')}.`;
  }
  return speech;
}

async function handleIntent(event, attrs) {
  const name = event.request.intent.name;
  const panelOpen = Boolean(attrs.panelOpen);
  // Com o painel aberto, a sessão continua; em comando avulso, encerra.
  const finish = (speech, toast) => respond({
    speech,
    directives: panelOpen && toast ? [toastDirective(toast)] : [],
    endSession: panelOpen ? undefined : true,
    attributes: attrs
  });

  switch (name) {
    case 'AdicionarTarefaIntent': {
      const raw = slotValue(event, 'tarefa');
      if (!raw) return respond({ speech: 'O que eu devo adicionar?', reprompt: 'Diga, por exemplo: adicionar lavar a louça pro Gustavo.', endSession: false, attributes: attrs });
      const info = parseTask(raw);
      await fb.addTask(info);
      const quem = { Shared: 'pra vocês dois', Gus: 'pro Gustavo', Isa: 'pra Isabella' }[info.owner];
      return finish(`Pronto! Anotei ${info.title} ${quem}${info.deadline ? (/amanh/i.test(raw) ? ', para amanhã' : ', para hoje') : ''}.`, `🎙️ Alexa adicionou “${info.title}”`);
    }
    case 'MercadoIntent': {
      const item = slotValue(event, 'item');
      if (!item) return respond({ speech: 'O que precisa comprar?', endSession: false, attributes: attrs });
      const title = item.charAt(0).toUpperCase() + item.slice(1);
      const { list } = await fb.addTask({ title, owner: 'Shared', listHint: 'mercado', emoji: '🛒' });
      return finish(`Coloquei ${item} na lista ${list.name}.`, `🛒 ${title} na lista ${list.name}`);
    }
    case 'HojeIntent':
      return finish(await todaySpeech());
    case 'ConcluirTarefaIntent': {
      const q = slotValue(event, 'tarefa');
      if (!q) return respond({ speech: 'Qual tarefa vocês terminaram?', endSession: false, attributes: attrs });
      const result = await fb.completeTask(q);
      if (result.task) return finish(`Boa! Marquei ${result.task.title} como feita.`, `✅ “${result.task.title}” concluída`);
      if (result.found.length === 0) return finish(`Não achei nenhuma tarefa pendente parecida com ${q}.`);
      return finish(`Achei ${result.found.length} tarefas parecidas: ${listJoin(result.found.slice(0, 3).map(t => t.title))}. Fala o nome mais completo.`);
    }
    case 'RecadoIntent': {
      const text = slotValue(event, 'recado');
      if (!text) return respond({ speech: 'Qual é o recado?', endSession: false, attributes: attrs });
      await fb.addNote(text.charAt(0).toUpperCase() + text.slice(1));
      return finish('Recado fixado no mural!', '💌 Novo recado no mural');
    }
    case 'CarinhoIntent': {
      const para = slotValue(event, 'pessoa');
      const de = para === 'Gus' ? 'Isa' : 'Gus';
      const tipo = slotValue(event, 'carinho') || 'beijo';
      const textos = { beijo: '😘 Um beijo!', abraco: '🤗 Um abraço apertado!', 'te amo': '❤️ Te amo muito!', saudade: '🥰 Saudade!' };
      await fb.sendNudge(de, textos[fb.normalize(tipo)] || `💌 ${tipo}`);
      return finish(`Mandei ${para === 'Gus' ? 'pro Gustavo' : 'pra Isabella'}!`);
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
        endSession: panelOpen ? undefined : false,
        attributes: attrs
      });
  }
}

function launch(event, attrs) {
  if (supportsHtml(event)) {
    return respond({
      speech: 'Abrindo a lista de vocês.',
      directives: [startPanelDirective()],
      attributes: { ...attrs, panelOpen: true }
    });
  }
  return todaySpeech().then(speech => respond({ speech: `${speech} Quer adicionar alguma coisa?`, reprompt: 'Quer adicionar alguma tarefa?', endSession: false, attributes: attrs }));
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
      case 'Alexa.Presentation.HTML.Message':
        // keepalive do painel: responde em silêncio e mantém a sessão
        return respond({ attributes: { ...attrs, panelOpen: true } });
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
