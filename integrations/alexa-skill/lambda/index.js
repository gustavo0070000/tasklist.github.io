// ============================================================================
// Skill "nossa lista" — tasklist Gustavo & Isabella
// ----------------------------------------------------------------------------
// Compatível com Echo Show 15 (painel visual interativo via APL) E Echo Dot
// (comandos de voz sem tela).
//
// "Alexa, abre nossa lista"                         -> Painel na Echo Show / resumo na Echo Dot
// "Alexa, pede pra nossa lista adicionar lavar louça pro Gustavo"
// "Alexa, pede pra nossa lista comprar leite"       -> lista Mercado
// "Alexa, pergunta pra nossa lista o que tem pra hoje"
// "Alexa, pede pra nossa lista marcar lavar louça como feita"
// "Alexa, pede pra nossa lista deixar um recado ..."
// "Alexa, pede pra nossa lista mandar um beijo pra Isa"
//
// Sem dependências externas (Alexa-hosted ou AWS Lambda Node 18+).
// Usa Alexa Presentation Language (APL) — funciona em TODOS os dispositivos
// Echo (com e sem tela), sem o erro "não é compatível com este dispositivo"
// causado pela Alexa Web API for Games.
// ============================================================================

const config = require('./config');
const fb = require('./firebase');

const OWNER_NAMES = { Gus: 'Gustavo', Isa: 'Isabella', Shared: 'vocês dois' };
const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const APL_TOKEN = 'tasklist-dashboard-apl';

// ---------------------------------------------------------------------------
// Utilitários de resposta e detecção de dispositivo
// ---------------------------------------------------------------------------

function escapeSsml(text) {
  return String(text || '').replace(/&/g, 'e').replace(/[<>"]/g, '');
}

function respond({ speech = null, reprompt = null, directives = [], endSession, attributes = {} }) {
  const response = {};
  if (speech) response.outputSpeech = { type: 'SSML', ssml: `<speak>${escapeSsml(speech)}</speak>` };
  if (reprompt) response.reprompt = { outputSpeech: { type: 'SSML', ssml: `<speak>${escapeSsml(reprompt)}</speak>` } };
  if (directives.length) response.directives = directives;
  // undefined = mantém a sessão (e a tela APL) aberta sem reabrir o microfone
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

function localNow() {
  return new Date(Date.now() + offsetMinutes() * 60000);
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

function localClock(date) {
  const d = new Date(date.getTime() + offsetMinutes() * 60000);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function localDateLabel() {
  const d = localNow();
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]}`;
}

function listJoin(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Carregamento de snapshot + Painel visual APL (Echo Show 15 / Echo Show)
// ---------------------------------------------------------------------------

async function loadSnapshot() {
  const [data, events, settings] = await Promise.all([
    fb.loadData().catch(() => ({})),
    fb.loadCalendar().catch(() => []),
    fb.loadSettings().catch(() => ({}))
  ]);

  const today = localDateKey(new Date());
  const todaysEvents = events
    .filter(ev => (ev.allDay
      ? ev.start <= today && (ev.end > today || ev.end === ev.start)
      : localDateKey(new Date(ev.start)) === today))
    .sort((a, b) => (a.allDay === b.allDay ? (a.start < b.start ? -1 : 1) : (a.allDay ? -1 : 1)));

  const allTasks = fb.entries(data.tasks).map(e => e.value);
  const pending = allTasks.filter(t => !t.completed);
  const completedCount = allTasks.length - pending.length;
  const dueToday = pending.filter(t => t.deadline && localDateKey(new Date(t.deadline)) <= today);

  const notes = fb.entries(data.notes)
    .map(e => e.value)
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

  return { data, events, todaysEvents, allTasks, pending, completedCount, dueToday, latestNote: notes[0] || null, settings };
}

function buildAplColumn(title, ownerKey, bgColor, tasks) {
  const items = tasks.slice(0, 7).map(t => ({
    type: 'TouchWrapper',
    width: '100%',
    onPress: {
      type: 'SendEvent',
      arguments: ['completeTask', t.id]
    },
    item: {
      type: 'Frame',
      width: '100%',
      backgroundColor: '#FFFFFFEB',
      borderColor: '#0F172A',
      borderWidth: '2dp',
      borderRadius: '12dp',
      paddingLeft: '12dp',
      paddingRight: '12dp',
      paddingTop: '10dp',
      paddingBottom: '10dp',
      marginBottom: '8dp',
      item: {
        type: 'Container',
        direction: 'row',
        alignItems: 'center',
        items: [
          {
            type: 'Frame',
            width: '22dp',
            height: '22dp',
            borderRadius: '6dp',
            borderColor: '#0F172A',
            borderWidth: '2dp',
            backgroundColor: '#FFFFFF',
            marginRight: '10dp'
          },
          {
            type: 'Text',
            text: `${t.emoji ? `${t.emoji} ` : ''}${t.title}`,
            color: '#0F172A',
            fontSize: '20dp',
            fontWeight: '700',
            maxLines: 2,
            grow: 1,
            shrink: 1
          }
        ]
      }
    }
  }));

  if (items.length === 0) {
    items.push({
      type: 'Text',
      text: 'Tudo em dia por aqui ✨',
      color: '#334155',
      fontSize: '18dp',
      fontWeight: '600',
      paddingTop: '12dp'
    });
  } else if (tasks.length > 7) {
    items.push({
      type: 'Text',
      text: `+ ${tasks.length - 7} tarefa(s) no app`,
      color: '#334155',
      fontSize: '16dp',
      fontWeight: '700',
      paddingTop: '4dp'
    });
  }

  return {
    type: 'Frame',
    grow: 1,
    basis: '0dp',
    height: '100%',
    backgroundColor: bgColor,
    borderColor: '#0F172A',
    borderWidth: '3dp',
    borderRadius: '18dp',
    padding: '14dp',
    marginLeft: ownerKey === 'Gus' ? '0dp' : '12dp',
    item: {
      type: 'Container',
      height: '100%',
      items: [
        {
          type: 'Container',
          direction: 'row',
          justifyContent: 'spaceBetween',
          alignItems: 'center',
          paddingBottom: '10dp',
          items: [
            {
              type: 'Text',
              text: title,
              color: '#0F172A',
              fontSize: '24dp',
              fontWeight: '800'
            },
            {
              type: 'Frame',
              backgroundColor: '#0F172A',
              borderRadius: '12dp',
              paddingLeft: '10dp',
              paddingRight: '10dp',
              paddingTop: '3dp',
              paddingBottom: '3dp',
              item: {
                type: 'Text',
                text: String(tasks.length),
                color: '#FFFFFF',
                fontSize: '18dp',
                fontWeight: '800'
              }
            }
          ]
        },
        {
          type: 'ScrollView',
          grow: 1,
          width: '100%',
          item: {
            type: 'Container',
            width: '100%',
            items
          }
        }
      ]
    }
  };
}

function buildAplDashboardDirective(snap, statusBanner = '') {
  const gusTasks = snap.pending.filter(t => t.owner === 'Gus');
  const isaTasks = snap.pending.filter(t => t.owner === 'Isa');
  const sharedTasks = snap.pending.filter(t => (t.owner || 'Shared') === 'Shared');
  const cityLabel = snap.settings && snap.settings.weather && snap.settings.weather.name ? ` · 📍 ${snap.settings.weather.name}` : '';

  const agendaItems = snap.todaysEvents.slice(0, 6).map(ev => {
    const hora = ev.allDay ? 'Dia todo' : localClock(new Date(ev.start));
    const badgeColor = ev.owner === 'Gus' ? '#C9F3E3' : (ev.owner === 'Isa' ? '#FFDFC4' : '#FFF3B0');
    const who = ev.owner === 'Gus' ? 'Gus' : (ev.owner === 'Isa' ? 'Isa' : 'Ambos');
    return {
      type: 'Frame',
      width: '100%',
      backgroundColor: '#252936',
      borderColor: '#3B4254',
      borderWidth: '2dp',
      borderRadius: '12dp',
      padding: '10dp',
      marginBottom: '8dp',
      item: {
        type: 'Container',
        direction: 'row',
        alignItems: 'center',
        items: [
          {
            type: 'Frame',
            backgroundColor: badgeColor,
            borderRadius: '8dp',
            paddingLeft: '8dp',
            paddingRight: '8dp',
            paddingTop: '4dp',
            paddingBottom: '4dp',
            marginRight: '10dp',
            item: {
              type: 'Text',
              text: hora,
              color: '#0F172A',
              fontSize: '16dp',
              fontWeight: '800'
            }
          },
          {
            type: 'Container',
            grow: 1,
            shrink: 1,
            items: [
              {
                type: 'Text',
                text: ev.title || '(sem título)',
                color: '#F8FAFC',
                fontSize: '18dp',
                fontWeight: '700',
                maxLines: 2
              },
              {
                type: 'Text',
                text: who,
                color: '#94A3B8',
                fontSize: '14dp',
                fontWeight: '600'
              }
            ]
          }
        ]
      }
    };
  });

  if (agendaItems.length === 0) {
    agendaItems.push({
      type: 'Text',
      text: 'Nenhum compromisso hoje 🌿',
      color: '#94A3B8',
      fontSize: '18dp',
      paddingTop: '8dp'
    });
  }

  const muralCard = {
    type: 'Frame',
    width: '100%',
    backgroundColor: '#FFF3B0',
    borderColor: '#0F172A',
    borderWidth: '2dp',
    borderRadius: '16dp',
    padding: '14dp',
    marginTop: '12dp',
    item: {
      type: 'Container',
      items: [
        {
          type: 'Text',
          text: '💌 MURAL DO CASAL',
          color: '#713F12',
          fontSize: '15dp',
          fontWeight: '800',
          paddingBottom: '4dp'
        },
        {
          type: 'Text',
          text: snap.latestNote ? snap.latestNote.text : 'Diga "Alexa, deixar um recado..." para fixar um bilhete aqui.',
          color: '#0F172A',
          fontSize: '19dp',
          fontWeight: '700',
          maxLines: 3
        }
      ]
    }
  };

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
          backgroundColor: '#181A20',
          paddingLeft: '24dp',
          paddingRight: '24dp',
          paddingTop: '18dp',
          paddingBottom: '16dp',
          items: [
            // Header
            {
              type: 'Container',
              direction: 'row',
              justifyContent: 'spaceBetween',
              alignItems: 'center',
              paddingBottom: '14dp',
              items: [
                {
                  type: 'Container',
                  items: [
                    {
                      type: 'Text',
                      text: '✨ Nossa Lista · Gustavo & Isabella',
                      color: '#F8FAFC',
                      fontSize: '28dp',
                      fontWeight: '800'
                    },
                    {
                      type: 'Text',
                      text: statusBanner || `${localDateLabel()}${cityLabel} · ${snap.pending.length} pendente(s) · ${snap.completedCount} concluída(s)`,
                      color: statusBanner ? '#FDE047' : '#94A3B8',
                      fontSize: '18dp',
                      fontWeight: '600',
                      paddingTop: '2dp'
                    }
                  ]
                },
                {
                  type: 'TouchWrapper',
                  onPress: {
                    type: 'SendEvent',
                    arguments: ['refresh']
                  },
                  item: {
                    type: 'Frame',
                    backgroundColor: '#F59E0B',
                    borderColor: '#0F172A',
                    borderWidth: '2dp',
                    borderRadius: '14dp',
                    paddingLeft: '18dp',
                    paddingRight: '18dp',
                    paddingTop: '10dp',
                    paddingBottom: '10dp',
                    item: {
                      type: 'Text',
                      text: '🔄 Atualizar',
                      color: '#0F172A',
                      fontSize: '18dp',
                      fontWeight: '800'
                    }
                  }
                }
              ]
            },
            // Main Body: Left Agenda+Mural | Right 3 Pastel Cards
            {
              type: 'Container',
              direction: 'row',
              grow: 1,
              width: '100%',
              items: [
                {
                  type: 'Container',
                  width: '28%',
                  height: '100%',
                  paddingRight: '14dp',
                  items: [
                    {
                      type: 'Frame',
                      grow: 1,
                      width: '100%',
                      backgroundColor: '#1E222D',
                      borderColor: '#334155',
                      borderWidth: '2dp',
                      borderRadius: '18dp',
                      padding: '14dp',
                      item: {
                        type: 'Container',
                        height: '100%',
                        items: [
                          {
                            type: 'Text',
                            text: `📅 Agenda de Hoje (${snap.todaysEvents.length})`,
                            color: '#FDE047',
                            fontSize: '21dp',
                            fontWeight: '800',
                            paddingBottom: '10dp'
                          },
                          {
                            type: 'ScrollView',
                            grow: 1,
                            width: '100%',
                            item: {
                              type: 'Container',
                              width: '100%',
                              items: agendaItems
                            }
                          }
                        ]
                      }
                    },
                    muralCard
                  ]
                },
                {
                  type: 'Container',
                  direction: 'row',
                  grow: 1,
                  height: '100%',
                  items: [
                    buildAplColumn('👦🏻 Gustavo', 'Gus', '#C9F3E3', gusTasks),
                    buildAplColumn('👩🏻 Isabella', 'Isa', '#FFDFC4', isaTasks),
                    buildAplColumn('💛 Ambos', 'Shared', '#FFF3B0', sharedTasks)
                  ]
                }
              ]
            },
            // Footer Tip
            {
              type: 'Text',
              text: 'Toque em qualquer tarefa para concluir · Diga: "Alexa, adicionar...", "comprar leite" ou "o que tem pra hoje"',
              color: '#64748B',
              fontSize: '15dp',
              fontWeight: '600',
              textAlign: 'center',
              paddingTop: '10dp'
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
  return buildTodaySpeech(await loadSnapshot());
}

// ---------------------------------------------------------------------------
// Intents e Eventos de Toque APL
// ---------------------------------------------------------------------------

async function handleIntent(event, attrs) {
  const name = event.request.intent.name;
  const hasApl = supportsApl(event);
  const panelOpen = Boolean(attrs.panelOpen);
  const htmlOpen = Boolean(attrs.htmlOpen);

  // Em dispositivos com tela (APL), atualiza o painel e mantém aberto; na Echo Dot, encerra após responder.
  const finish = async (speech, toast, refreshVisual = false) => {
    const directives = [];
    if (hasApl && (panelOpen || refreshVisual)) {
      const snap = await loadSnapshot();
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
      return finish(`Mandei ${para === 'Gus' ? 'pro Gustavo' : 'pra Isabella'}!`, `💛 Carinho enviado!`);
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
    const snap = await loadSnapshot();
    const banner = completed ? `✅ "${completed.title}" concluída!` : 'Lista atualizada!';
    return respond({
      speech: completed ? `Boa! ${completed.title} concluída.` : null,
      directives: supportsApl(event) ? [buildAplDashboardDirective(snap, banner)] : [],
      attributes: { ...attrs, panelOpen: true }
    });
  }

  // refresh padrão
  const snap = await loadSnapshot();
  return respond({
    directives: supportsApl(event) ? [buildAplDashboardDirective(snap, '🔄 Painel atualizado agora!')] : [],
    attributes: { ...attrs, panelOpen: true }
  });
}

async function launch(event, attrs) {
  if (supportsApl(event)) {
    const snap = await loadSnapshot();
    const resumoCurto = snap.todaysEvents.length > 0
      ? `Abrindo a lista de vocês. Hoje há ${snap.todaysEvents.length} compromisso${snap.todaysEvents.length === 1 ? '' : 's'} e ${snap.pending.length} tarefa${snap.pending.length === 1 ? '' : 's'} pendente${snap.pending.length === 1 ? '' : 's'}.`
      : `Abrindo a lista de vocês. ${snap.pending.length} tarefa${snap.pending.length === 1 ? '' : 's'} pendente${snap.pending.length === 1 ? '' : 's'}.`;
    return respond({
      speech: resumoCurto,
      directives: [buildAplDashboardDirective(snap)],
      attributes: { ...attrs, panelOpen: true }
    });
  }

  if (supportsHtml(event)) {
    return respond({
      speech: 'Abrindo a lista de vocês.',
      directives: [startPanelDirective()],
      attributes: { ...attrs, htmlOpen: true }
    });
  }

  // Echo Dot e dispositivos sem tela: lê agenda + tarefas e aguarda comando
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
        // keepalive legado do painel HTML: responde em silêncio e mantém a sessão
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
