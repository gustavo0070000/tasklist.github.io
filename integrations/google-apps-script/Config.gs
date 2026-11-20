/**
 * ============================================================================
 *  TASKLIST — Gustavo & Isabella · Backend no Google Apps Script
 * ----------------------------------------------------------------------------
 *  Rode este projeto na conta Google do GUSTAVO (dono do projeto Firebase).
 *  Passo a passo completo em INTEGRACOES.md, na raiz do repositório.
 *
 *  Valores sensíveis (tokens do Telegram e do Voice Monkey) podem ficar aqui
 *  OU em "Configurações do projeto → Propriedades do script" com o mesmo nome
 *  — as propriedades têm prioridade. Não suba este arquivo preenchido no GitHub.
 * ============================================================================
 */
var CONFIG = {
  // --- Firebase (o mesmo do app) ---
  FIREBASE_URL: 'https://SEU-PROJETO-default-rtdb.firebaseio.com',
  FIREBASE_PROJECT_ID: 'seu-projeto',          // ID do projeto (para o push FCM)
  SECRET_KEY: 'sua-chave-secreta',             // a "Chave Secreta Compartilhada" do app

  APP_URL: 'https://gustavo0070000.github.io/tasklist.github.io/',
  TIMEZONE: 'America/Sao_Paulo',

  // --- Google Agenda ---
  // 'primary' = agenda principal de quem roda o script (Gustavo).
  // A Isa precisa compartilhar a agenda dela com o Gustavo
  // ("Ver todos os detalhes dos eventos") — use o e-mail dela aqui.
  CALENDARS: {
    Gus: 'primary',
    Isa: 'email-da-isa@gmail.com'
  },
  // Agendas extras que contam como "Ambos" (ex.: agenda compartilhada da casa)
  EXTRA_SHARED_CALENDARS: [],
  SYNC_DAYS_BACK: 7,
  SYNC_DAYS_AHEAD: 60,
  // Palavra que, na descrição do evento, esconde o título no app/painel
  PRIVATE_KEYWORD: '#privado',

  // Tarefas com prazo viram eventos nesta agenda (criada automaticamente)
  TASKS_TO_CALENDAR: true,
  TASKS_CALENDAR_NAME: 'Tarefas do Casal ✅',
  ISA_EMAIL_TO_SHARE_TASKS_CALENDAR: '',       // e-mail da Isa (compartilha a agenda de tarefas com ela)

  // --- Resumo matinal e lembretes ---
  MORNING_HOUR: 7,                             // hora local do resumo matinal
  DEADLINE_REMINDER_MINUTES: 30,               // push X min antes do prazo de uma tarefa

  // --- Telegram (opcional) ---
  // Crie o bot com o @BotFather e mande /id para ele para descobrir seu ID.
  TELEGRAM_BOT_TOKEN: '',
  TELEGRAM_USERS: { Gus: '', Isa: '' },        // IDs numéricos de cada um
  TELEGRAM_GROUP_CHAT_ID: '',                  // opcional: grupo do casal para o resumo
  TELEGRAM_NOTIFY_ACTIONS: ['nudge', 'add_note', 'add_task', 'complete_task'],

  // --- Echo falando em voz alta (Voice Monkey v3, opcional) ---
  // Plano grátis: 200 anúncios/mês — por isso só carinhos e resumo matinal.
  VOICE_MONKEY_TOKEN: '',
  VOICE_MONKEY_DEVICE: '',                     // ID do "Speaker" criado no Voice Monkey
  VOICE_MONKEY_VOICE: 'Camila',                // voz pt-BR da Alexa (Camila, Vitoria, Ricardo)
  VOICE_MONKEY_LANGUAGE: 'pt-BR',
  ANNOUNCE_NUDGES: true,
  ANNOUNCE_MORNING: true,
  ANNOUNCE_QUIET_HOURS: [22, 7]                // não falar entre 22h e 7h
};

function cfg(key) {
  var prop = PropertiesService.getScriptProperties().getProperty(key);
  if (prop !== null && prop !== '') {
    try { return JSON.parse(prop); } catch (e) { return prop; }
  }
  return CONFIG[key];
}

var OWNER_NAMES = { Gus: 'Gustavo', Isa: 'Isabella', Shared: 'Ambos' };
