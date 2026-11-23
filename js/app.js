import * as db from './firebase-db.js';
import * as notifications from './notifications.js';
import * as ifttt from './ifttt-webhook.js';
import * as agenda from './agenda.js';
import * as weather from './weather.js';
import * as push from './push.js';
import {
  GUS_AVATAR_SVG,
  ISA_AVATAR_SVG,
  AMBOS_AVATAR_SVG,
  EMOJI_PRESETS,
  ALL_EMOJIS,
  detectSvgKeyFromTitle,
  renderTaskIcon
} from './illustrations.js';
import {
  isSoundEnabled,
  setSoundEnabled,
  playSound,
  launchConfetti,
  resizeConfettiCanvas,
  showToast,
  initConfirmModal,
  confirmAction
} from './effects.js';

// ============================================================================
// APPLICATION STATE
// ============================================================================

const appState = {
  dbData: null,
  activeListId: 'all',          // 'all' | 'today' | specific list ID
  activeFilter: 'all',          // 'all' | 'today' | 'date' | 'list'
  activeTab: 'dashboard',       // 'dashboard' | 'tasks' | 'calendar' | 'projects' | 'notes' | 'wishlist' | 'stats'
  currentUser: 'Gus',           // 'Gus' | 'Isa'
  secretKey: '',
  syncStatus: 'connecting',     // 'online' | 'reconnecting' | 'local' | 'offline'
  currentMonth: new Date(),
  selectedDate: null,           // Calendar -> Tasks date filter
  selectedCalendarDay: new Date(),
  expandedTaskId: null,
  quickFilter: 'none',          // 'none' | 'mine' | 'urgent'
  ownerFilter: 'all',           // 'all' | 'Gus' | 'Isa' | 'Shared'
  statusFilter: 'all',          // 'all' | 'pending' | 'done'
  searchQuery: '',
  sortBy: 'newest',             // 'newest' | 'deadline' | 'priority' | 'alpha'
  tasksViewMode: localStorage.getItem('tasklist_view_mode') || 'board', // 'board' | 'list'
  openInlineForms: { Gus: false, Isa: false, Shared: false },
  selectedInlineEmojis: { Gus: '📋', Isa: '📚', Shared: '💛' },
  selectedQuickAddEmoji: '✨',
  draggedTaskId: null,
  calendar: { updatedAt: null, events: [] },   // Google Agenda (nó calendar/{chave})
  calendarError: null,
  settings: {},                                 // Configurações compartilhadas (nó settings/{chave})
  settingsError: null,
  weather: null,
  pendingShare: null                            // Conteúdo recebido via "Compartilhar" do celular
};

let unsubscribeData = null;
let unsubscribeConn = null;
let unsubscribeCalendar = null;
let unsubscribeSettings = null;
let weatherTimer = null;
let lastIsMobile = window.innerWidth <= 860;
let pendingSyncRender = false;

const focusTimer = {
  durationSec: 25 * 60,
  remainingSec: 25 * 60,
  running: false,
  intervalId: null,
  taskId: null,
  taskTitle: null
};

const COUPLE_ROUTINES = [
  {
    id: 'faxina',
    title: '🧹 Faxina de Fim de Semana',
    tasks: [
      { title: 'Limpar banheiros', owner: 'Isa', priority: 'High', emoji: '🫧', svgKey: 'bathroom' },
      { title: 'Limpar cozinha e fogão', owner: 'Gus', priority: 'High', emoji: '🧹', svgKey: 'kitchen' },
      { title: 'Trocar roupas de cama', owner: 'Shared', priority: 'Medium', emoji: '🛏️', svgKey: 'home' },
      { title: 'Tirar o lixo e recicláveis', owner: 'Gus', priority: 'Medium', emoji: '🗑️', svgKey: 'trash' }
    ]
  },
  {
    id: 'mercado',
    title: '🛒 Compras da Semana',
    tasks: [
      { title: 'Conferir geladeira e despensa', owner: 'Shared', priority: 'Medium', emoji: '📋', svgKey: 'forms' },
      { title: 'Comprar frutas, verduras e pão', owner: 'Shared', priority: 'High', emoji: '🛒', svgKey: 'market' },
      { title: 'Repor produtos de limpeza', owner: 'Isa', priority: 'Low', emoji: '🫧', svgKey: 'bathroom' }
    ]
  },
  {
    id: 'noite',
    title: '🌙 Rotina da Noite',
    tasks: [
      { title: 'Lavar louça do jantar', owner: 'Gus', priority: 'Medium', emoji: '🍽️', svgKey: 'dishes' },
      { title: 'Guardar roupas espalhadas', owner: 'Shared', priority: 'Low', emoji: '🧥', svgKey: 'wardrobe' },
      { title: 'Cuidar do Bruce antes de dormir', owner: 'Shared', priority: 'High', emoji: '🐶', svgKey: 'bruce' }
    ]
  },
  {
    id: 'viagem',
    title: '✈️ Checklist de Viagem',
    tasks: [
      { title: 'Separar documentos e reservas', owner: 'Gus', priority: 'High', emoji: '📋', svgKey: 'forms' },
      { title: 'Arrumar malas e necessaire', owner: 'Isa', priority: 'High', emoji: '🧥', svgKey: 'wardrobe' },
      { title: 'Carregadores, fones e remédios', owner: 'Shared', priority: 'Medium', emoji: '🔌', svgKey: null },
      { title: 'Combinar cuidados com o Bruce', owner: 'Shared', priority: 'High', emoji: '🐶', svgKey: 'bruce' }
    ]
  }
];

// ============================================================================
// DOM REFERENCES
// ============================================================================

const el = {
  // Shell & Sidebar
  sidebar: document.getElementById('sidebar'),
  sidebarOverlay: document.getElementById('sidebarOverlay'),
  btnToggleMenu: document.getElementById('btnToggleMenu'),
  btnCloseSidebarMobile: document.getElementById('btnCloseSidebarMobile'),
  btnHeaderBack: document.getElementById('btnHeaderBack'),
  listsContainer: document.getElementById('listsContainer'),
  badgeCountAll: document.getElementById('badgeCountAll'),
  currentUserBadge: document.getElementById('currentUserBadge'),
  btnOpenSettings: document.getElementById('btnOpenSettings'),
  btnOpenAddListModal: document.getElementById('btnOpenAddListModal'),

  // Header Utilities
  activeListTitle: document.getElementById('activeListTitle'),
  activeListOwnerBadge: document.getElementById('activeListOwnerBadge'),
  syncStatusPill: document.getElementById('syncStatusPill'),
  syncStatusText: document.getElementById('syncStatusText'),
  btnToggleSound: document.getElementById('btnToggleSound'),
  soundIcon: document.getElementById('soundIcon'),
  btnToggleTheme: document.getElementById('btnToggleTheme'),
  themeIcon: document.getElementById('themeIcon'),
  themeLabel: document.getElementById('themeLabel'),
  btnCopySummary: document.getElementById('btnCopySummary'),
  btnToggleHistory: document.getElementById('btnToggleHistory'),

  // Activity Drawer
  activityDrawer: document.getElementById('activityDrawer'),
  drawerOverlay: document.getElementById('drawerOverlay'),
  btnCloseHistory: document.getElementById('btnCloseHistory'),
  historyList: document.getElementById('historyList'),

  // Mobile Bottom Nav
  mobileBottomNav: document.getElementById('mobileBottomNav'),
  bottomNavBadgeTasks: document.getElementById('bottomNavBadgeTasks'),
  bottomNavBtnMore: document.getElementById('bottomNavBtnMore'),

  // Main Container & Tab Views
  mainContent: document.getElementById('mainContent'),
  viewDashboard: document.getElementById('viewDashboard'),
  viewTasks: document.getElementById('viewTasks'),
  viewCalendar: document.getElementById('viewCalendar'),
  viewProjects: document.getElementById('viewProjects'),
  viewNotes: document.getElementById('viewNotes'),
  viewWishlist: document.getElementById('viewWishlist'),
  viewStats: document.getElementById('viewStats'),

  // Dashboard
  dashboardUserGreeting: document.getElementById('dashboardUserGreeting'),
  dashboardMotivation: document.getElementById('dashboardMotivation'),
  dashboardOverallCounter: document.getElementById('dashboardOverallCounter'),
  dashboardProgressBar: document.getElementById('dashboardProgressBar'),
  dashboardProgressSub: document.getElementById('dashboardProgressSub'),
  dashboardProgressCircle: document.getElementById('dashboardProgressCircle'),
  svgRingGus: document.getElementById('svgRingGus'),
  svgRingIsa: document.getElementById('svgRingIsa'),
  legendGusDone: document.getElementById('legendGusDone'),
  legendIsaDone: document.getElementById('legendIsaDone'),
  dashboardCoupleCards: document.getElementById('dashboardCoupleCards'),
  dashboardMuralPreviewContainer: document.getElementById('dashboardMuralPreviewContainer'),
  dashboardMuralPreview: document.getElementById('dashboardMuralPreview'),
  dashboardMuralAuthor: document.getElementById('dashboardMuralAuthor'),
  dashboardMuralText: document.getElementById('dashboardMuralText'),
  dashboardUrgentContainer: document.getElementById('dashboardUrgentContainer'),
  dashboardUrgentList: document.getElementById('dashboardUrgentList'),
  btnViewAllUrgent: document.getElementById('btnViewAllUrgent'),
  dashboardListsGrid: document.getElementById('dashboardListsGrid'),
  btnDashboardOpenAddList: document.getElementById('btnDashboardOpenAddList'),

  // Tasks View
  tasksMotivation: document.getElementById('tasksMotivation'),
  progressText: document.getElementById('progressText'),
  progressBarFill: document.getElementById('progressBarFill'),
  inputSearchTasks: document.getElementById('inputSearchTasks'),
  btnClearSearch: document.getElementById('btnClearSearch'),
  selectSortTasks: document.getElementById('selectSortTasks'),
  btnViewModeBoard: document.getElementById('btnViewModeBoard'),
  btnViewModeList: document.getElementById('btnViewModeList'),
  btnFilterMyTasks: document.getElementById('btnFilterMyTasks'),
  btnFilterUrgentTasks: document.getElementById('btnFilterUrgentTasks'),
  btnClearQuickFilters: document.getElementById('btnClearQuickFilters'),
  activeDateBanner: document.getElementById('activeDateBanner'),
  activeDateBannerText: document.getElementById('activeDateBannerText'),
  btnClearDateFilter: document.getElementById('btnClearDateFilter'),
  coupleBoardView: document.getElementById('coupleBoardView'),
  unifiedListView: document.getElementById('unifiedListView'),
  addTaskForm: document.getElementById('addTaskForm'),
  btnQuickEmojiToggle: document.getElementById('btnQuickEmojiToggle'),
  quickAddEmojiTray: document.getElementById('quickAddEmojiTray'),
  inputTaskTitle: document.getElementById('inputTaskTitle'),
  selectTaskOwner: document.getElementById('selectTaskOwner'),
  selectTaskPriority: document.getElementById('selectTaskPriority'),
  selectTaskRecurrence: document.getElementById('selectTaskRecurrence'),
  inputTaskDeadline: document.getElementById('inputTaskDeadline'),
  emptyStateView: document.getElementById('emptyStateView'),
  todoSection: document.getElementById('todoSection'),
  completedSection: document.getElementById('completedSection'),
  todoTaskList: document.getElementById('todoTaskList'),
  completedTaskList: document.getElementById('completedTaskList'),
  todoCount: document.getElementById('todoCount'),
  completedCount: document.getElementById('completedCount'),
  btnUncheckAll: document.getElementById('btnUncheckAll'),
  btnClearCompleted: document.getElementById('btnClearCompleted'),
  btnRestoreDefaults: document.getElementById('btnRestoreDefaults'),
  stickyTaskAddBar: document.getElementById('stickyTaskAddBar'),
  stickyAddTaskForm: document.getElementById('stickyAddTaskForm'),
  inputStickyTaskTitle: document.getElementById('inputStickyTaskTitle'),

  // Calendar View
  btnPrevMonth: document.getElementById('btnPrevMonth'),
  btnNextMonth: document.getElementById('btnNextMonth'),
  btnCalendarToday: document.getElementById('btnCalendarToday'),
  calendarMonthTitle: document.getElementById('calendarMonthTitle'),
  calendarGrid: document.getElementById('calendarGrid'),
  calendarDayPanel: document.getElementById('calendarDayPanel'),
  calendarDayPanelTitle: document.getElementById('calendarDayPanelTitle'),
  calendarDayPanelSub: document.getElementById('calendarDayPanelSub'),
  btnOpenDayInTasks: document.getElementById('btnOpenDayInTasks'),
  calendarDayTasksList: document.getElementById('calendarDayTasksList'),
  calendarDayAddForm: document.getElementById('calendarDayAddForm'),
  inputCalendarDayTask: document.getElementById('inputCalendarDayTask'),
  selectCalendarDayOwner: document.getElementById('selectCalendarDayOwner'),

  // Projects View
  btnOpenAddProjectModal: document.getElementById('btnOpenAddProjectModal'),
  projectsListContainer: document.getElementById('projectsListContainer'),
  addProjectModal: document.getElementById('addProjectModal'),
  btnCloseAddProjectModal: document.getElementById('btnCloseAddProjectModal'),
  btnCancelAddProject: document.getElementById('btnCancelAddProject'),
  btnSaveProject: document.getElementById('btnSaveProject'),
  inputProjectName: document.getElementById('inputProjectName'),
  inputProjectTargetDate: document.getElementById('inputProjectTargetDate'),

  // Mural & Nós View
  btnOpenAddNoteModal: document.getElementById('btnOpenAddNoteModal'),
  notesGrid: document.getElementById('notesGrid'),
  nosHistoryList: document.getElementById('nosHistoryList'),
  addNoteModal: document.getElementById('addNoteModal'),
  btnCloseAddNoteModal: document.getElementById('btnCloseAddNoteModal'),
  btnCancelAddNote: document.getElementById('btnCancelAddNote'),
  btnSaveNote: document.getElementById('btnSaveNote'),
  inputNoteText: document.getElementById('inputNoteText'),

  // Wishlist View
  btnOpenAddWishModal: document.getElementById('btnOpenAddWishModal'),
  wishlistGus: document.getElementById('wishlistGus'),
  wishlistIsa: document.getElementById('wishlistIsa'),
  wishlistShared: document.getElementById('wishlistShared'),
  wishCountGus: document.getElementById('wishCountGus'),
  wishCountIsa: document.getElementById('wishCountIsa'),
  wishCountShared: document.getElementById('wishCountShared'),
  addWishModal: document.getElementById('addWishModal'),
  btnCloseAddWishModal: document.getElementById('btnCloseAddWishModal'),
  btnCancelAddWish: document.getElementById('btnCancelAddWish'),
  btnSaveWish: document.getElementById('btnSaveWish'),
  inputWishTitle: document.getElementById('inputWishTitle'),
  inputWishPrice: document.getElementById('inputWishPrice'),
  inputWishLink: document.getElementById('inputWishLink'),
  inputWishNotes: document.getElementById('inputWishNotes'),

  // Stats View
  statsSummaryContainer: document.getElementById('statsSummaryContainer'),
  achievementsGrid: document.getElementById('achievementsGrid'),
  achievementsProgressBadge: document.getElementById('achievementsProgressBadge'),

  // Add List Modal
  addListModal: document.getElementById('addListModal'),
  btnCloseAddListModal: document.getElementById('btnCloseAddListModal'),
  btnCancelAddList: document.getElementById('btnCancelAddList'),
  btnSaveList: document.getElementById('btnSaveList'),
  inputListName: document.getElementById('inputListName'),
  selectListGroup: document.getElementById('selectListGroup'),
  newGroupNameGroup: document.getElementById('newGroupNameGroup'),
  inputNewGroupName: document.getElementById('inputNewGroupName'),

  // Settings Modal
  settingsModal: document.getElementById('settingsModal'),
  btnCloseSettingsModal: document.getElementById('btnCloseSettingsModal'),
  btnConfirmCloseSettings: document.getElementById('btnConfirmCloseSettings'),
  btnSwitchToGus: document.getElementById('btnSwitchToGus'),
  btnSwitchToIsa: document.getElementById('btnSwitchToIsa'),
  btnSetThemeDark: document.getElementById('btnSetThemeDark'),
  btnSetThemeLight: document.getElementById('btnSetThemeLight'),
  btnSetThemeAuto: document.getElementById('btnSetThemeAuto'),
  btnSettingsToggleSound: document.getElementById('btnSettingsToggleSound'),
  btnEnableNotifications: document.getElementById('btnEnableNotifications'),
  notificationStatusHint: document.getElementById('notificationStatusHint'),
  settingsInviteBlock: document.getElementById('settingsInviteBlock'),
  btnCopyInviteLink: document.getElementById('btnCopyInviteLink'),
  inviteQrCode: document.getElementById('inviteQrCode'),
  inviteQrCodeText: document.getElementById('inviteQrCodeText'),
  setupIftttKey: document.getElementById('setupIftttKey'),
  setupIftttEvent: document.getElementById('setupIftttEvent'),
  btnTestIfttt: document.getElementById('btnTestIfttt'),
  btnExportBackup: document.getElementById('btnExportBackup'),
  btnImportBackup: document.getElementById('btnImportBackup'),
  inputImportBackupFile: document.getElementById('inputImportBackupFile'),
  settingsConnectedDb: document.getElementById('settingsConnectedDb'),
  btnConnectFirebaseFromLocal: document.getElementById('btnConnectFirebaseFromLocal'),
  btnResetApp: document.getElementById('btnResetApp'),

  // Setup Overlay
  setupOverlay: document.getElementById('setupOverlay'),
  setupAvatarsPair: document.getElementById('setupAvatarsPair'),
  btnStartLocalMode: document.getElementById('btnStartLocalMode'),
  btnCopyFirebaseRules: document.getElementById('btnCopyFirebaseRules'),
  firebaseRulesSnippet: document.getElementById('firebaseRulesSnippet'),
  setupForm: document.getElementById('setupForm'),
  setupSecretKey: document.getElementById('setupSecretKey'),
  setupDbUrl: document.getElementById('setupDbUrl'),
  setupApiKey: document.getElementById('setupApiKey'),
  setupProjectId: document.getElementById('setupProjectId'),

  // Focus Timer, Streak, Global FAB, Quick-Add Modal & Routines Modal
  btnToggleFocusTimer: document.getElementById('btnToggleFocusTimer'),
  headerFocusBadge: document.getElementById('headerFocusBadge'),
  dashboardStreakBadge: document.getElementById('dashboardStreakBadge'),
  streakDaysCount: document.getElementById('streakDaysCount'),
  btnOpenRoutinesModal: document.getElementById('btnOpenRoutinesModal'),
  btnFabAddTask: document.getElementById('btnFabAddTask'),
  focusTimerWidget: document.getElementById('focusTimerWidget'),
  btnCloseFocusWidget: document.getElementById('btnCloseFocusWidget'),
  focusTaskLabel: document.getElementById('focusTaskLabel'),
  focusTimeDisplay: document.getElementById('focusTimeDisplay'),
  btnFocusStartPause: document.getElementById('btnFocusStartPause'),
  btnFocusReset: document.getElementById('btnFocusReset'),
  btnFocusCompleteTask: document.getElementById('btnFocusCompleteTask'),
  quickTaskModal: document.getElementById('quickTaskModal'),
  btnCloseQuickTaskModal: document.getElementById('btnCloseQuickTaskModal'),
  btnCancelQuickTask: document.getElementById('btnCancelQuickTask'),
  btnSaveQuickTask: document.getElementById('btnSaveQuickTask'),
  quickTaskModalForm: document.getElementById('quickTaskModalForm'),
  inputModalTaskTitle: document.getElementById('inputModalTaskTitle'),
  selectModalTaskList: document.getElementById('selectModalTaskList'),
  selectModalTaskPriority: document.getElementById('selectModalTaskPriority'),
  selectModalTaskRecurrence: document.getElementById('selectModalTaskRecurrence'),
  inputModalTaskDeadline: document.getElementById('inputModalTaskDeadline'),
  routinesModal: document.getElementById('routinesModal'),
  btnCloseRoutinesModal: document.getElementById('btnCloseRoutinesModal'),
  btnConfirmCloseRoutines: document.getElementById('btnConfirmCloseRoutines'),
  routinesListGrid: document.getElementById('routinesListGrid'),

  // Integrações: Agenda, Clima, Painel, Push
  dashboardAgendaList: document.getElementById('dashboardAgendaList'),
  dashboardAgendaHint: document.getElementById('dashboardAgendaHint'),
  dashboardWeatherChip: document.getElementById('dashboardWeatherChip'),
  btnDashboardOpenCalendar: document.getElementById('btnDashboardOpenCalendar'),
  calendarDayEventsList: document.getElementById('calendarDayEventsList'),
  btnCopyPainelLink: document.getElementById('btnCopyPainelLink'),
  weatherCityForm: document.getElementById('weatherCityForm'),
  inputWeatherCity: document.getElementById('inputWeatherCity'),
  btnSearchWeatherCity: document.getElementById('btnSearchWeatherCity'),
  weatherCityResults: document.getElementById('weatherCityResults'),
  weatherCityCurrent: document.getElementById('weatherCityCurrent'),
  calendarSyncStatus: document.getElementById('calendarSyncStatus'),
  btnEnablePush: document.getElementById('btnEnablePush'),
  pushStatusHint: document.getElementById('pushStatusHint'),
  setupPushSenderId: document.getElementById('setupPushSenderId'),
  setupPushAppId: document.getElementById('setupPushAppId'),
  setupPushVapid: document.getElementById('setupPushVapid'),
  btnSavePushConfig: document.getElementById('btnSavePushConfig')
};

// ============================================================================
// UTILITIES & HELPERS
// ============================================================================

function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

function ownerDisplayName(owner) {
  if (owner === 'Gus') return 'Gustavo';
  if (owner === 'Isa') return 'Isabella';
  return 'Ambos';
}

function ownerShortName(owner) {
  if (owner === 'Gus') return 'Gustavo';
  if (owner === 'Isa') return 'Isabella';
  return 'Ambos';
}

function copyTextSafe(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  }
  return fallbackCopy(text);
}

function fallbackCopy(text) {
  return new Promise((resolve, reject) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      resolve();
    } catch (e) {
      reject(e);
    } finally {
      document.body.removeChild(textarea);
    }
  });
}

function toLocalDatetimeInputValue(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

function formatDeadline(isoString) {
  if (!isoString) return { text: '', className: '' };
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return { text: '', className: '' };
  const now = new Date();
  const isOverdue = date < now;
  const formatted = date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });

  if (isOverdue) {
    return { text: `⚠️ Atrasada · ${formatted}`, className: 'deadline-overdue' };
  }
  const diffHours = (date - now) / (1000 * 60 * 60);
  if (diffHours <= 24) {
    return { text: `⏳ Urgente · ${formatted}`, className: 'deadline-urgent' };
  }
  return { text: `⏰ ${formatted}`, className: '' };
}

function getMotivationMessage(done, total) {
  if (total === 0) return 'Adicione novas tarefas clicando no botão "+" em cada cartão! ✨';
  const pct = Math.round((done / total) * 100);
  if (pct === 0) return 'Bora começar! Marque as caixinhas conforme forem terminando ✨';
  if (pct < 50) return 'Ótimo começo! Continuem nesse ritmo 💪';
  if (pct < 100) return 'Mais da metade concluída! Falta pouquinho 🚀';
  return 'Parabéns! Todas as tarefas concluídas! Hora do sorvete com o Bruce! 🍦🐶💛';
}

function getSmartListIcon(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('mercado') || n.includes('compra') || n.includes('feira')) return '🛒';
  if (n.includes('casa') || n.includes('limpeza') || n.includes('rotina') || n.includes('organiza')) return '🏠';
  if (n.includes('trabalho') || n.includes('estud') || n.includes('facul')) return '📚';
  if (n.includes('viagem') || n.includes('férias') || n.includes('ferias') || n.includes('mala')) return '✈️';
  if (n.includes('pet') || n.includes('bruce') || n.includes('cachorro')) return '🐶';
  if (n.includes('finan') || n.includes('conta') || n.includes('pagar')) return '💰';
  return '📋';
}

function closeMobileSidebar() {
  el.sidebar.classList.remove('open');
  el.sidebarOverlay.classList.remove('open');
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  el.activityDrawer.classList.remove('open');
  el.drawerOverlay.classList.remove('open');
  closeMobileSidebar();
}

// ============================================================================
// THEME & SOUND CONTROLLERS
// ============================================================================

function initTheme() {
  const saved = localStorage.getItem('tasklist_theme') || 'dark';
  applyTheme(saved, false);

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if ((localStorage.getItem('tasklist_theme') || 'dark') === 'auto') {
        applyTheme('auto', false);
      }
    });
  }
}

function applyTheme(theme, save = true) {
  if (save) localStorage.setItem('tasklist_theme', theme);

  let isLight = false;
  if (theme === 'light') {
    isLight = true;
  } else if (theme === 'dark') {
    isLight = false;
  } else {
    isLight = window.matchMedia && !window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  if (isLight) {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute('content', isLight ? '#f7f4eb' : '#181a20');

  if (el.themeIcon) el.themeIcon.textContent = isLight ? '🌙' : '☀️';
  if (el.themeLabel) el.themeLabel.textContent = isLight ? 'Quadro' : 'Claro';

  const currentSaved = localStorage.getItem('tasklist_theme') || 'dark';
  if (el.btnSetThemeDark) el.btnSetThemeDark.classList.toggle('active', currentSaved === 'dark');
  if (el.btnSetThemeLight) el.btnSetThemeLight.classList.toggle('active', currentSaved === 'light');
  if (el.btnSetThemeAuto) el.btnSetThemeAuto.classList.toggle('active', currentSaved === 'auto');
}

function updateSoundUI() {
  const on = isSoundEnabled();
  if (el.soundIcon) el.soundIcon.textContent = on ? '🔊' : '🔇';
  if (el.btnSettingsToggleSound) {
    el.btnSettingsToggleSound.textContent = on ? '🔊 Efeitos Sonoros: Ativados' : '🔇 Efeitos Sonoros: Silenciados';
  }
}

function updateSyncStatusUI(status) {
  appState.syncStatus = status;
  if (!el.syncStatusPill || !el.syncStatusText) return;
  el.syncStatusPill.dataset.status = status;

  if (status === 'online') {
    el.syncStatusText.textContent = 'Sincronizado (Firebase)';
  } else if (status === 'local') {
    el.syncStatusText.textContent = 'Salvo localmente';
  } else if (status === 'reconnecting') {
    el.syncStatusText.textContent = 'Reconectando...';
  } else {
    el.syncStatusText.textContent = 'Offline';
  }
}

// ============================================================================
// INITIALIZATION & CONNECTION LIFECYCLE
// ============================================================================

function init() {
  resizeConfettiCanvas();
  initConfirmModal();
  initTheme();
  updateSoundUI();
  renderQuickAddEmojiTray();
  renderSetupAvatars();
  setupEventListeners();
  consumeShareTarget();
  checkConfiguration();
}

function renderSetupAvatars() {
  if (!el.setupAvatarsPair) return;
  el.setupAvatarsPair.innerHTML = `
    <div class="setup-avatar-box gus">${GUS_AVATAR_SVG}</div>
    <span style="font-size: 1.4rem;">💛</span>
    <div class="setup-avatar-box isa">${ISA_AVATAR_SVG}</div>
  `;
}

function teardownListeners() {
  if (unsubscribeData) { unsubscribeData(); unsubscribeData = null; }
  if (unsubscribeConn) { unsubscribeConn(); unsubscribeConn = null; }
  if (unsubscribeCalendar) { unsubscribeCalendar(); unsubscribeCalendar = null; }
  if (unsubscribeSettings) { unsubscribeSettings(); unsubscribeSettings = null; }
}

// Assina os nós de integração (agenda + configurações compartilhadas)
function subscribeIntegrations() {
  appState.calendarError = null;
  appState.settingsError = null;
  unsubscribeCalendar = db.listenToCalendar(
    cal => {
      appState.calendarError = null;
      appState.calendar = cal;
      if (appState.dbData && !isTypingInDynamicInput()) renderApp();
      updateSettingsModalUI();
    },
    err => {
      appState.calendarError = (err && (err.code || err.message)) || 'PERMISSION_DENIED';
      updateSettingsModalUI();
    }
  );
  unsubscribeSettings = db.listenToSettings(
    settings => {
      appState.settingsError = null;
      const prevLoc = JSON.stringify((appState.settings || {}).weather || null);
      appState.settings = settings || {};
      if (JSON.stringify(appState.settings.weather || null) !== prevLoc) refreshWeather(true);
      updateSettingsModalUI();
    },
    err => {
      appState.settingsError = (err && (err.code || err.message)) || 'PERMISSION_DENIED';
      updateSettingsModalUI();
    }
  );
}

function refreshWeather(force = false) {
  const loc = appState.settings && appState.settings.weather;
  if (!loc) {
    appState.weather = null;
    renderWeatherChip();
    return;
  }
  weather.fetchWeather(loc, { force })
    .then(w => { appState.weather = w; renderWeatherChip(); })
    .catch(err => console.warn('Clima indisponível:', err));
  if (!weatherTimer) weatherTimer = setInterval(() => refreshWeather(false), 20 * 60 * 1000);
}

function renderWeatherChip() {
  if (!el.dashboardWeatherChip) return;
  const w = appState.weather;
  if (!w) {
    el.dashboardWeatherChip.style.display = 'none';
    return;
  }
  el.dashboardWeatherChip.style.display = 'inline-flex';
  el.dashboardWeatherChip.title = `${w.label} em ${w.name} — sensação ${w.feels}°`;
  el.dashboardWeatherChip.innerHTML = `<span>${w.icon}</span><strong>${w.temp}°</strong>${w.rainAlert ? `<span class="weather-chip-rain">${escapeHTML(w.rainAlert)}</span>` : ''}`;
}

// ---------------------------------------------------------------------------
// Web Share Target: "Compartilhar → tasklist" no celular
//  - link (ex.: produto) -> abre "Novo Desejo" já preenchido
//  - texto              -> abre "Nova Tarefa Rápida" já preenchida
// ---------------------------------------------------------------------------
function consumeShareTarget() {
  const params = new URLSearchParams(window.location.search);
  const title = params.get('share_title') || '';
  const text = params.get('share_text') || '';
  let url = params.get('share_url') || '';
  if (!title && !text && !url) return;

  // Muitos apps mandam o link dentro do texto
  if (!url) {
    const m = text.match(/https?:\/\/\S+/);
    if (m) url = m[0];
  }
  const cleanText = text.replace(url, '').trim();
  appState.pendingShare = { title: title || cleanText, text: cleanText, url };
  window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
}

function applyPendingShare() {
  const share = appState.pendingShare;
  if (!share || !appState.dbData) return;
  appState.pendingShare = null;

  if (share.url) {
    appState.activeTab = 'wishlist';
    renderApp();
    el.inputWishTitle.value = (share.title || '').slice(0, 120);
    el.inputWishLink.value = share.url;
    el.inputWishNotes.value = share.text && share.text !== share.title ? share.text.slice(0, 200) : '';
    el.addWishModal.classList.add('open');
    showToast('Link recebido! Confira e salve na Lista de Desejos 🎁');
  } else {
    el.btnFabAddTask.click();
    el.inputModalTaskTitle.value = (share.title || share.text).slice(0, 140);
  }
}

function generatePainelLink() {
  const config = db.getSavedConfig();
  const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '') + 'painel.html';
  if (!config) return base;
  const payload = { firebaseConfig: config.firebaseConfig, secretKey: config.secretKey };
  const base64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  return base + '?config=' + encodeURIComponent(base64);
}

function checkConfiguration() {
  handleIncomingInvite();
  teardownListeners();

  const config = db.getSavedConfig();
  if (config) {
    appState.currentUser = config.currentUser;
    appState.secretKey = config.secretKey;
    el.setupOverlay.classList.remove('open');
    el.activeListTitle.textContent = 'Sincronizando...';
    updateSyncStatusUI('reconnecting');

    const ok = db.initFirebase();
    if (ok) {
      unsubscribeConn = db.listenToConnectionStatus(updateSyncStatusUI);
      unsubscribeData = db.listenToData(handleDataSync);
      subscribeIntegrations();
      updateSettingsModalUI();
    } else {
      showToast('Erro ao iniciar Firebase. Verifique suas credenciais.', 'error');
      showSetupScreen();
    }
  } else if (db.isLocalMode()) {
    appState.currentUser = db.getCurrentUser();
    el.setupOverlay.classList.remove('open');
    updateSyncStatusUI('local');
    unsubscribeData = db.listenToData(handleDataSync);
    subscribeIntegrations();
    updateSettingsModalUI();
  } else {
    showSetupScreen();
  }
}

function showSetupScreen() {
  teardownListeners();
  el.setupOverlay.classList.add('open');
  el.mainContent.style.display = 'none';
}

function isTypingInDynamicInput() {
  const active = document.activeElement;
  if (!active) return false;
  const tag = (active.tagName || '').toLowerCase();
  if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') return false;
  return Boolean(
    active.closest('#coupleBoardView, #unifiedListView, #projectsListContainer, #calendarDayPanel')
  );
}

function handleDataSync(freshData) {
  const normalized = db.normalizeData(freshData);

  if (appState.dbData) {
    notifications.checkNewActivities(normalized.history, appState.currentUser);
  } else {
    notifications.initNotifications(normalized.history);
  }

  appState.dbData = normalized;

  if (normalized.history) {
    notifications.checkNewReactions(normalized.history, appState.currentUser);
  }

  if (!db.isLocalMode()) {
    ifttt.checkAndTriggerMorningSummary(normalized, db.updateDatabase);
  }

  el.mainContent.style.display = 'flex';
  if (isTypingInDynamicInput()) {
    pendingSyncRender = true;
  } else {
    pendingSyncRender = false;
    renderApp();
  }
  if (appState.pendingShare) applyPendingShare();
}

function saveDataAndRender(data) {
  checkRecurrenceAndClone(data);
  pendingSyncRender = false;
  renderApp();
  db.updateDatabase(data).catch(err => {
    showToast('Erro ao salvar no Firebase! Verifique as regras de segurança.', 'error');
    console.error('Firebase write error:', err);
  });
}

function updateResponsiveHeaderChrome() {
  const isMobile = window.innerWidth <= 860;
  const inSpecificList = appState.activeTab === 'tasks' && appState.activeFilter === 'list';

  if (el.btnHeaderBack && el.btnToggleMenu) {
    if (isMobile && inSpecificList) {
      el.btnHeaderBack.style.display = 'inline-flex';
      el.btnToggleMenu.style.display = 'none';
    } else {
      el.btnHeaderBack.style.display = 'none';
      el.btnToggleMenu.style.display = isMobile ? 'inline-flex' : 'none';
    }
  }

  if (el.stickyTaskAddBar) {
    el.stickyTaskAddBar.classList.toggle('active', isMobile && appState.activeTab === 'tasks' && appState.tasksViewMode === 'list');
  }
}

// ============================================================================
// MASTER RENDER ORCHESTRATOR
// ============================================================================

function renderApp() {
  if (!appState.dbData) return;

  renderProfileBadge();
  renderSidebar();
  renderHistory();

  // Hide all views
  [
    el.viewDashboard, el.viewTasks, el.viewCalendar,
    el.viewProjects, el.viewNotes, el.viewWishlist, el.viewStats
  ].forEach(v => { if (v) v.style.display = 'none'; });

  if (el.stickyTaskAddBar) el.stickyTaskAddBar.classList.remove('active');

  // Mobile Context Header Back/Menu Logic
  updateResponsiveHeaderChrome();

  // Update Sidebar Tab Active State
  document.querySelectorAll('.sidebar .nav-item[data-nav-tab]').forEach(link => {
    const tab = link.getAttribute('data-nav-tab');
    const isActive = tab === appState.activeTab && !(appState.activeTab === 'tasks' && appState.activeFilter === 'list');
    link.classList.toggle('active', isActive);
  });

  // Update Mobile Bottom Nav Active State + Pending Badge
  if (el.mobileBottomNav) {
    el.mobileBottomNav.querySelectorAll('.bottom-nav-item[data-tab]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === appState.activeTab);
    });
    const pendingCount = appState.dbData.tasks.filter(t => !t.completed).length;
    if (el.bottomNavBadgeTasks) {
      el.bottomNavBadgeTasks.textContent = pendingCount;
      el.bottomNavBadgeTasks.style.display = pendingCount > 0 ? 'flex' : 'none';
    }
  }

  // Update Header Context & Render Active View
  const tabHeaderMeta = {
    dashboard: 'Resumo do Dia',
    calendar: 'Calendário do Casal',
    projects: 'Projetos & Sonhos',
    notes: 'Mural & Nós',
    wishlist: 'Lista de Desejos',
    stats: 'Conquistas & Estatísticas'
  };

  if (appState.activeTab !== 'tasks') {
    el.activeListTitle.textContent = tabHeaderMeta[appState.activeTab] || 'tasklist';
    el.activeListOwnerBadge.style.display = 'none';
  }

  switch (appState.activeTab) {
    case 'dashboard':
      el.viewDashboard.style.display = 'flex';
      renderDashboard();
      break;
    case 'tasks':
      el.viewTasks.style.display = 'flex';
      renderTasks();
      break;
    case 'calendar':
      el.viewCalendar.style.display = 'flex';
      renderCalendar();
      break;
    case 'projects':
      el.viewProjects.style.display = 'flex';
      renderProjects();
      break;
    case 'notes':
      el.viewNotes.style.display = 'flex';
      renderNotes();
      break;
    case 'wishlist':
      el.viewWishlist.style.display = 'flex';
      renderWishlist();
      break;
    case 'stats':
      el.viewStats.style.display = 'flex';
      renderStats();
      break;
  }
}

// ============================================================================
// SIDEBAR & PROFILE BADGE
// ============================================================================

function renderProfileBadge() {
  const isGus = appState.currentUser === 'Gus';
  const name = isGus ? 'Gustavo' : 'Isabella';
  const other = isGus ? 'Isabella' : 'Gustavo';
  const avatarSvg = isGus ? GUS_AVATAR_SVG : ISA_AVATAR_SVG;

  el.currentUserBadge.innerHTML = `
    <div class="mini-avatar-wrap ${isGus ? 'gus' : 'isa'}">${avatarSvg}</div>
    <div class="user-pill-info">
      <span class="user-pill-name">${name}</span>
      <span class="user-pill-hint">Trocar para ${other} ⇄</span>
    </div>
  `;
}

function renderSidebar() {
  const data = appState.dbData;
  const openTasks = data.tasks.filter(t => !t.completed);
  el.badgeCountAll.textContent = openTasks.length;

  let html = '';
  data.groups.forEach(group => {
    const groupLists = data.lists.filter(l => l.groupId === group.id);
    if (groupLists.length === 0) return;

    html += `<div class="list-group-header">${escapeHTML(group.name)}</div><ul class="nav-list">`;
    groupLists.forEach(list => {
      const isSelected = appState.activeTab === 'tasks' && appState.activeFilter === 'list' && appState.activeListId === list.id;
      const listOpenCount = openTasks.filter(t => t.listId === list.id).length;
      const dotClass = list.owner === 'Gus' ? 'dot-gus' : list.owner === 'Isa' ? 'dot-isa' : 'dot-shared';

      html += `
        <li>
          <a href="#" class="nav-item ${isSelected ? 'active' : ''}" data-list-id="${list.id}">
            <span class="nav-item-owner-dot ${dotClass}"></span>
            <span class="nav-item-label">${escapeHTML(list.name)}</span>
            ${listOpenCount > 0 ? `<span class="nav-item-badge">${listOpenCount}</span>` : ''}
            <button type="button" class="btn-delete-list" data-list-id="${list.id}" title="Excluir lista" aria-label="Excluir lista ${escapeHTML(list.name)}">✕</button>
          </a>
        </li>
      `;
    });
    html += `</ul>`;
  });

  el.listsContainer.innerHTML = html;

  el.listsContainer.querySelectorAll('.nav-item[data-list-id]').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.closest('.btn-delete-list')) return;
      e.preventDefault();
      appState.activeTab = 'tasks';
      appState.activeListId = item.getAttribute('data-list-id');
      appState.activeFilter = 'list';
      closeMobileSidebar();
      renderApp();
    });
  });

  el.listsContainer.querySelectorAll('.btn-delete-list').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();
      handleDeleteList(btn.getAttribute('data-list-id'));
    });
  });
}

// ============================================================================
// VIEW 0: DASHBOARD (RESUMO DO DIA)
// ============================================================================

function computeCoupleStreak(tasks) {
  const daysSet = new Set();
  tasks.forEach(t => {
    if (t.completed && t.completedAt) {
      const d = new Date(t.completedAt);
      if (!isNaN(d.getTime())) {
        daysSet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
      }
    }
  });
  if (daysSet.size === 0) return 0;

  let streak = 0;
  const cursor = new Date();
  // Start checking today; if none completed today yet, allow streak continuing from yesterday
  const todayKey = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
  if (!daysSet.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (true) {
    const k = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
    if (!daysSet.has(k)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function renderDashboard() {
  const data = appState.dbData;
  const isGus = appState.currentUser === 'Gus';
  el.dashboardUserGreeting.textContent = `Olá, ${isGus ? 'Gustavo' : 'Isabella'}! Organização da Casa`;

  const allTasks = data.tasks;
  const allCompleted = allTasks.filter(t => t.completed);
  const totalCount = allTasks.length;
  const doneCount = allCompleted.length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // Couple Streak Badge
  const streak = computeCoupleStreak(allTasks);
  if (el.dashboardStreakBadge && el.streakDaysCount) {
    if (streak > 0) {
      el.dashboardStreakBadge.style.display = 'inline-flex';
      el.dashboardStreakBadge.innerHTML = `🔥 <strong id="streakDaysCount">${streak}</strong> ${streak === 1 ? 'dia' : 'dias'}`;
    } else {
      el.dashboardStreakBadge.style.display = 'none';
    }
  }

  // Overall progress bar & motivation
  el.dashboardMotivation.textContent = getMotivationMessage(doneCount, totalCount);
  el.dashboardOverallCounter.textContent = `${doneCount} / ${totalCount} concluída${totalCount === 1 ? '' : 's'} (${pct}%)`;
  el.dashboardProgressBar.style.width = `${pct}%`;

  // Dual Couple Progress Ring (uses today's tasks if any exist, otherwise all tasks)
  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const todayTasks = allTasks.filter(t => t.deadline && new Date(t.deadline) <= todayEnd);
  const ringBase = todayTasks.length > 0 ? todayTasks : allTasks;
  const ringDone = ringBase.filter(t => t.completed);
  const ringTotal = ringBase.length;
  const ringPct = ringTotal > 0 ? Math.round((ringDone.length / ringTotal) * 100) : 0;

  const gusDone = ringDone.filter(t => t.completedBy === 'Gus' || (!t.completedBy && t.owner === 'Gus')).length;
  const isaDone = ringDone.filter(t => t.completedBy === 'Isa' || (!t.completedBy && t.owner === 'Isa')).length;

  el.legendGusDone.textContent = gusDone;
  el.legendIsaDone.textContent = isaDone;
  el.dashboardProgressCircle.innerHTML = `<span>${ringPct}%</span><span class="dual-ring-scope">${todayTasks.length > 0 ? 'Hoje' : 'Geral'}</span>`;

  // SVG Ring circumference for r=33: 2 * PI * 33 ≈ 207.35
  const circ = 207.35;
  if (ringTotal > 0) {
    const gusLen = (gusDone / ringTotal) * circ;
    const isaLen = (isaDone / ringTotal) * circ;
    el.svgRingGus.style.opacity = gusDone > 0 ? '1' : '0';
    el.svgRingGus.style.strokeDasharray = `${gusLen} ${circ}`;
    el.svgRingGus.style.strokeDashoffset = '0';

    el.svgRingIsa.style.opacity = isaDone > 0 ? '1' : '0';
    el.svgRingIsa.style.strokeDasharray = `${isaLen} ${circ}`;
    el.svgRingIsa.style.strokeDashoffset = `${-gusLen}`;
  } else {
    el.svgRingGus.style.opacity = '0';
    el.svgRingIsa.style.opacity = '0';
    el.svgRingGus.style.strokeDasharray = `0 ${circ}`;
    el.svgRingIsa.style.strokeDasharray = `0 ${circ}`;
  }

  if (todayTasks.length > 0) {
    const pendingToday = todayTasks.filter(t => !t.completed).length;
    el.dashboardProgressSub.textContent = pendingToday > 0
      ? `${pendingToday} tarefa${pendingToday === 1 ? '' : 's'} com prazo até hoje`
      : 'Todas as tarefas de hoje concluídas! 🎉';
  } else {
    const generalPending = allTasks.filter(t => !t.completed).length;
    el.dashboardProgressSub.textContent = generalPending > 0
      ? `${generalPending} tarefa${generalPending === 1 ? '' : 's'} pendente${generalPending === 1 ? '' : 's'} no total`
      : 'Nenhuma tarefa pendente! Aproveitem! 🌸';
  }

  // 3-Person Quick Breakdown Cards (Gustavo, Isabella, Ambos)
  const ownersConfig = [
    { key: 'Gus', label: 'GUSTAVO', cls: 'gus', avatar: GUS_AVATAR_SVG },
    { key: 'Isa', label: 'ISABELLA', cls: 'isa', avatar: ISA_AVATAR_SVG },
    { key: 'Shared', label: 'AMBOS', cls: 'shared', avatar: AMBOS_AVATAR_SVG }
  ];

  el.dashboardCoupleCards.innerHTML = ownersConfig.map(o => {
    const list = allTasks.filter(t => (t.owner || 'Shared') === o.key);
    const done = list.filter(t => t.completed).length;
    const total = list.length;
    const oPct = total > 0 ? Math.round((done / total) * 100) : 0;
    return `
      <button type="button" class="couple-mini-card ${o.cls}" data-jump-owner="${o.key}">
        <div class="couple-mini-top">
          <div class="couple-mini-avatar">${o.avatar}</div>
          <div>
            <div class="couple-mini-name">${o.label} ${total > 0 && done === total ? '🎉' : ''}</div>
            <div class="couple-mini-count">${done} de ${total} concluída${total === 1 ? '' : 's'}</div>
          </div>
        </div>
        <div class="couple-mini-bar-track">
          <div class="couple-mini-bar-fill" style="width: ${oPct}%"></div>
        </div>
      </button>
    `;
  }).join('');

  el.dashboardCoupleCards.querySelectorAll('[data-jump-owner]').forEach(card => {
    card.addEventListener('click', () => {
      appState.activeTab = 'tasks';
      appState.activeFilter = 'all';
      appState.activeListId = 'all';
      appState.ownerFilter = card.getAttribute('data-jump-owner');
      appState.tasksViewMode = 'board';
      renderApp();
    });
  });

  renderDashboardAgenda();
  renderWeatherChip();

  // Latest Mural Note Preview (prioritize pinned, then latest)
  const notes = [...(data.notes || [])];
  if (notes.length > 0) {
    const pinned = notes.filter(n => n.pinned);
    const featured = pinned.length > 0
      ? pinned.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]
      : notes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    el.dashboardMuralPreviewContainer.style.display = 'block';
    el.dashboardMuralAuthor.textContent = `De ${ownerDisplayName(featured.user)}`;
    el.dashboardMuralText.textContent = `"${featured.text}"`;
  } else {
    el.dashboardMuralPreviewContainer.style.display = 'none';
  }

  // Urgent / Overdue Highlight Tasks
  const urgentTasks = allTasks.filter(t => {
    if (t.completed || !t.deadline) return false;
    const d = new Date(t.deadline);
    return d < now || (d - now) / (1000 * 60 * 60) <= 12;
  }).sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  if (urgentTasks.length > 0) {
    el.dashboardUrgentContainer.style.display = 'flex';
    el.dashboardUrgentList.innerHTML = urgentTasks.slice(0, 4).map(task => {
      const d = new Date(task.deadline);
      const isOverdue = d < now;
      const timeStr = d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      const ownerCls = task.owner === 'Gus' ? 'gus' : task.owner === 'Isa' ? 'isa' : 'shared';

      return `
        <div class="urgent-card ${isOverdue ? 'overdue' : 'soon'}" data-task-id="${task.id}">
          <button type="button" class="tactile-checkbox urgent-quick-check" data-task-id="${task.id}" aria-label="Concluir ${escapeHTML(task.title)}"></button>
          <div class="urgent-card-body" data-open-task="${task.id}">
            <div class="urgent-card-meta">
              <span class="urgent-badge ${isOverdue ? '' : 'soon'}">${isOverdue ? '⚠️ ATRASADA' : '⏳ URGENTE'}</span>
              <span class="panel-sub">${timeStr}</span>
            </div>
            <div class="urgent-card-title">${escapeHTML(task.title)}</div>
          </div>
          <span class="owner-pill ${ownerCls}">${ownerShortName(task.owner)}</span>
        </div>
      `;
    }).join('');

    el.dashboardUrgentList.querySelectorAll('.urgent-quick-check').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        toggleTaskCompletion(btn.getAttribute('data-task-id'), true);
      });
    });

    el.dashboardUrgentList.querySelectorAll('[data-open-task]').forEach(body => {
      body.addEventListener('click', () => {
        const taskId = body.getAttribute('data-open-task');
        const task = data.tasks.find(t => t.id === taskId);
        if (task) {
          appState.activeTab = 'tasks';
          appState.activeListId = task.listId;
          appState.activeFilter = 'list';
          appState.ownerFilter = 'all';
          appState.expandedTaskId = taskId;
          renderApp();
        }
      });
    });
  } else {
    el.dashboardUrgentContainer.style.display = 'none';
  }

  // My Lists Grid
  el.dashboardListsGrid.innerHTML = data.lists.map(list => {
    const listAll = allTasks.filter(t => t.listId === list.id);
    const listDone = listAll.filter(t => t.completed).length;
    const listPending = listAll.length - listDone;
    const lPct = listAll.length > 0 ? Math.round((listDone / listAll.length) * 100) : 0;
    const ownerCls = list.owner === 'Gus' ? 'gus' : list.owner === 'Isa' ? 'isa' : 'shared';

    return `
      <div class="dashboard-list-card" data-list-id="${list.id}">
        <div class="dashboard-list-top">
          <div class="list-card-icon ${ownerCls}">${getSmartListIcon(list.name)}</div>
          <div>
            <div class="list-card-name">${escapeHTML(list.name)}</div>
            <div class="list-card-sub">${listPending === 0 ? 'Tudo feito! ✨' : `${listPending} pendente${listPending === 1 ? '' : 's'}`} · ${lPct}%</div>
          </div>
        </div>
        <div class="list-card-bar">
          <div class="list-card-bar-fill" style="width: ${lPct}%"></div>
        </div>
      </div>
    `;
  }).join('');

  el.dashboardListsGrid.querySelectorAll('.dashboard-list-card').forEach(card => {
    card.addEventListener('click', () => {
      appState.activeTab = 'tasks';
      appState.activeListId = card.getAttribute('data-list-id');
      appState.activeFilter = 'list';
      appState.ownerFilter = 'all';
      renderApp();
    });
  });
}

// Agenda de Hoje (Resumo): eventos do Google Agenda + tarefas com prazo hoje
function renderAgendaItemsHTML(items) {
  return items.map(item => {
    const meta = agenda.ownerMeta(item.owner);
    if (item.kind === 'event') {
      return `
        <div class="agenda-item event ${meta.cls}">
          <span class="agenda-time">${escapeHTML(item.timeLabel)}${item.endLabel ? `<small>até ${escapeHTML(item.endLabel)}</small>` : ''}</span>
          <span class="agenda-marker ${meta.cls}" aria-hidden="true"></span>
          <div class="agenda-body">
            <span class="agenda-title">${escapeHTML(item.title)}</span>
            ${item.location ? `<span class="agenda-sub">📍 ${escapeHTML(item.location)}</span>` : ''}
          </div>
          <span class="owner-pill ${meta.cls}">${meta.name}</span>
        </div>`;
    }
    return `
      <div class="agenda-item task ${item.completed ? 'done' : ''}">
        <span class="agenda-time">${escapeHTML(item.timeLabel)}</span>
        <button type="button" class="tactile-checkbox agenda-task-check ${item.completed ? 'checked' : ''}" data-task-id="${item.id}" aria-label="Concluir ${escapeHTML(item.title)}">
          ${item.completed ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
        </button>
        <div class="agenda-body">
          <span class="agenda-title">${escapeHTML(item.title)}</span>
          <span class="agenda-sub">Tarefa</span>
        </div>
        <span class="owner-pill ${meta.cls}">${meta.name}</span>
      </div>`;
  }).join('');
}

function bindAgendaTaskChecks(container) {
  container.querySelectorAll('.agenda-task-check').forEach(btn => {
    btn.addEventListener('click', () => {
      toggleTaskCompletion(btn.getAttribute('data-task-id'), !btn.classList.contains('checked'));
    });
  });
}

function renderDashboardAgenda() {
  if (!el.dashboardAgendaList) return;
  const today = new Date();
  const events = appState.calendar.events || [];
  const items = agenda.buildDayAgenda(appState.dbData.tasks, events, today);

  if (items.length === 0) {
    const next = agenda.upcomingDays(appState.dbData.tasks, events, today, 3)[0];
    el.dashboardAgendaList.innerHTML = `
      <p class="agenda-empty">Nada marcado para hoje 🌿${next ? ` Próximo: <strong>${agenda.dayLabel(next.day)}</strong> — ${escapeHTML(next.items[0].title)}` : ''}</p>`;
  } else {
    el.dashboardAgendaList.innerHTML = renderAgendaItemsHTML(items);
    bindAgendaTaskChecks(el.dashboardAgendaList);
  }

  if (el.dashboardAgendaHint) {
    el.dashboardAgendaHint.textContent = appState.calendar.updatedAt
      ? `Google Agenda sincronizado ${agenda.relativeSyncLabel(appState.calendar.updatedAt)}`
      : 'Conecte o Google Agenda de vocês dois (Configurações → Google Agenda).';
  }
}

// ============================================================================
// VIEW 1: TAREFAS (COUPLE BOARD + UNIFIED LIST)
// ============================================================================

function getBaseScopeTasks() {
  const data = appState.dbData;
  let tasks = [...data.tasks];
  let title = 'Todas as Tarefas';
  let listOwner = 'Shared';

  if (appState.activeFilter === 'today') {
    title = 'Com Prazos Limites';
    tasks = tasks.filter(t => t.deadline);
  } else if (appState.activeFilter === 'date' && appState.selectedDate) {
    const d = appState.selectedDate;
    title = `Tarefas · ${d.toLocaleDateString('pt-BR')}`;
    tasks = tasks.filter(t => {
      if (!t.deadline) return false;
      const td = new Date(t.deadline);
      return td.getFullYear() === d.getFullYear() &&
             td.getMonth() === d.getMonth() &&
             td.getDate() === d.getDate();
    });
  } else if (appState.activeFilter === 'list') {
    const activeList = data.lists.find(l => l.id === appState.activeListId);
    if (activeList) {
      title = activeList.name;
      listOwner = activeList.owner || 'Shared';
      tasks = tasks.filter(t => t.listId === activeList.id);
    } else {
      appState.activeFilter = 'all';
      appState.activeListId = 'all';
    }
  }

  return { tasks, title, listOwner };
}

function applyTaskFiltersAndSort(baseTasks) {
  let result = [...baseTasks];

  // Quick filter
  if (appState.quickFilter === 'mine') {
    result = result.filter(t => t.owner === appState.currentUser);
  } else if (appState.quickFilter === 'urgent') {
    const now = new Date();
    result = result.filter(t => {
      if (!t.deadline || t.completed) return false;
      const d = new Date(t.deadline);
      return d < now || (d - now) / (1000 * 60 * 60) <= 12;
    });
  }

  // Search query (searches title, subtasks, and comments)
  const q = appState.searchQuery.trim().toLowerCase();
  if (q) {
    result = result.filter(t => {
      if ((t.title || '').toLowerCase().includes(q)) return true;
      if ((t.subtasks || []).some(st => (st.title || '').toLowerCase().includes(q))) return true;
      if ((t.comments || []).some(c => (c.text || '').toLowerCase().includes(q))) return true;
      return false;
    });
  }

  // Sort
  const prioWeight = { High: 3, Medium: 2, Low: 1 };
  result.sort((a, b) => {
    if (appState.sortBy === 'deadline') {
      if (!a.deadline && !b.deadline) return new Date(b.createdAt) - new Date(a.createdAt);
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline) - new Date(b.deadline);
    }
    if (appState.sortBy === 'priority') {
      const diff = (prioWeight[b.priority] || 2) - (prioWeight[a.priority] || 2);
      if (diff !== 0) return diff;
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
    if (appState.sortBy === 'alpha') {
      return (a.title || '').localeCompare(b.title || '', 'pt-BR');
    }
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return result;
}

function renderTasks() {
  const { tasks: scopeTasks, title, listOwner } = getBaseScopeTasks();

  // Header title & owner badge
  el.activeListTitle.textContent = title;
  el.activeListOwnerBadge.style.display = 'inline-block';
  if (listOwner === 'Gus') {
    el.activeListOwnerBadge.textContent = 'Lista de Gustavo';
    el.activeListOwnerBadge.className = 'owner-pill gus';
  } else if (listOwner === 'Isa') {
    el.activeListOwnerBadge.textContent = 'Lista de Isabella';
    el.activeListOwnerBadge.className = 'owner-pill isa';
  } else {
    el.activeListOwnerBadge.textContent = appState.activeFilter === 'list' ? 'Lista Compartilhada' : 'Casal';
    el.activeListOwnerBadge.className = 'owner-pill shared';
  }

  // Active Date Banner
  if (appState.activeFilter === 'date' && appState.selectedDate) {
    el.activeDateBanner.style.display = 'flex';
    el.activeDateBannerText.textContent = `📅 Filtrando tarefas de ${appState.selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}`;
  } else {
    el.activeDateBanner.style.display = 'none';
  }

  // Sync toolbar UI states
  el.btnViewModeBoard.classList.toggle('active', appState.tasksViewMode === 'board');
  el.btnViewModeList.classList.toggle('active', appState.tasksViewMode === 'list');
  el.selectSortTasks.value = appState.sortBy;
  el.btnClearSearch.style.display = appState.searchQuery ? 'inline-flex' : 'none';

  document.querySelectorAll('.owner-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-owner-filter') === appState.ownerFilter);
  });
  document.querySelectorAll('.status-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-status-filter') === appState.statusFilter);
  });

  el.btnFilterMyTasks.classList.toggle('active', appState.quickFilter === 'mine');
  el.btnFilterUrgentTasks.classList.toggle('active', appState.quickFilter === 'urgent');
  const hasAnyFilter = appState.quickFilter !== 'none' || appState.ownerFilter !== 'all' ||
                       appState.statusFilter !== 'all' || appState.searchQuery !== '' ||
                       appState.activeFilter === 'date';
  el.btnClearQuickFilters.style.display = hasAnyFilter ? 'inline-flex' : 'none';

  // Local mode restore button visibility
  if (el.btnRestoreDefaults) {
    el.btnRestoreDefaults.style.display = db.isLocalMode() ? 'inline-flex' : 'none';
  }

  // Mobile sticky bottom quick-add bar
  const isMobile = window.innerWidth <= 860;
  if (el.stickyTaskAddBar) {
    el.stickyTaskAddBar.classList.toggle('active', isMobile && appState.tasksViewMode === 'list');
  }

  // Overall progress strip
  const filteredTasks = applyTaskFiltersAndSort(scopeTasks);
  const doneCount = scopeTasks.filter(t => t.completed).length;
  const totalCount = scopeTasks.length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  el.progressText.textContent = `${doneCount}/${totalCount} (${pct}%)`;
  el.progressBarFill.style.width = `${pct}%`;
  el.tasksMotivation.textContent = getMotivationMessage(doneCount, totalCount);

  // Switch between Couple Board Mode and Unified List Mode
  if (appState.tasksViewMode === 'board') {
    el.coupleBoardView.style.display = 'grid';
    el.unifiedListView.style.display = 'none';
    renderCoupleBoard(filteredTasks, scopeTasks);
  } else {
    el.coupleBoardView.style.display = 'none';
    el.unifiedListView.style.display = 'block';
    renderUnifiedList(filteredTasks);
  }
}

function renderCoupleBoard(filteredTasks, scopeTasks) {
  const owners = [
    { key: 'Gus', title: 'GUSTAVO', cls: 'owner-gus', avatar: GUS_AVATAR_SVG, placeholder: 'Ex: Tirar o lixo...' },
    { key: 'Isa', title: 'ISABELLA', cls: 'owner-isa', avatar: ISA_AVATAR_SVG, placeholder: 'Ex: Organizar cadernos...' },
    { key: 'Shared', title: 'AMBOS', cls: 'owner-shared', avatar: AMBOS_AVATAR_SVG, placeholder: 'Ex: Passear com o Bruce...' }
  ];

  const visibleOwners = appState.ownerFilter === 'all'
    ? owners
    : owners.filter(o => o.key === appState.ownerFilter);

  el.coupleBoardView.classList.toggle('single-owner', visibleOwners.length === 1);

  el.coupleBoardView.innerHTML = visibleOwners.map(o => {
    const allOwnerScope = scopeTasks.filter(t => (t.owner || 'Shared') === o.key);
    const doneOwner = allOwnerScope.filter(t => t.completed).length;
    const totalOwner = allOwnerScope.length;
    const ownerPct = totalOwner > 0 ? Math.round((doneOwner / totalOwner) * 100) : 0;

    // Apply status filter to tasks shown inside card
    const cardTasks = filteredTasks
      .filter(t => (t.owner || 'Shared') === o.key)
      .filter(t => {
        if (appState.statusFilter === 'pending') return !t.completed;
        if (appState.statusFilter === 'done') return t.completed;
        return true;
      });

    // Pending first, completed at bottom inside each card for ultra-clean scanning
    const orderedCardTasks = [
      ...cardTasks.filter(t => !t.completed),
      ...cardTasks.filter(t => t.completed)
    ];

    const isFormOpen = appState.openInlineForms[o.key];
    const selectedEmoji = appState.selectedInlineEmojis[o.key] || EMOJI_PRESETS[o.key][0];

    const emojiButtonsHtml = EMOJI_PRESETS[o.key].map(em => `
      <button type="button" class="emoji-opt ${selectedEmoji === em ? 'selected' : ''}" data-inline-emoji="${em}" data-owner="${o.key}">${em}</button>
    `).join('');

    let emptyMsg = 'Nenhuma tarefa cadastrada. Clique no "+" acima!';
    if (appState.searchQuery) emptyMsg = 'Nenhuma tarefa encontrada nessa busca.';
    else if (appState.statusFilter === 'pending') emptyMsg = 'Nenhuma tarefa pendente por aqui! 🎉';
    else if (appState.statusFilter === 'done') emptyMsg = 'Nenhuma tarefa concluída ainda.';

    const itemsHtml = orderedCardTasks.length > 0
      ? orderedCardTasks.map(t => renderTaskItemHTML(t, true)).join('')
      : `<li class="board-empty-box">${emptyMsg}</li>`;

    return `
      <section class="couple-card ${o.cls}" data-drop-owner="${o.key}">
        <div class="couple-card-header">
          <div class="couple-card-identity">
            <div class="couple-card-avatar">${o.avatar}</div>
            <div>
              <div class="couple-card-title-row">
                <h2 class="couple-card-title">${o.title}</h2>
                ${totalOwner > 0 && doneOwner === totalOwner ? '<span class="badge-100">100% 🎉</span>' : ''}
              </div>
              <p class="couple-card-counter">${doneOwner} de ${totalOwner} concluída${totalOwner === 1 ? '' : 's'}</p>
            </div>
          </div>
          <button type="button" class="btn-card-add" data-toggle-inline="${o.key}" title="Adicionar tarefa para ${o.title}" aria-label="Adicionar tarefa para ${o.title}">
            ${isFormOpen ? '−' : '+'}
          </button>
        </div>

        <div class="couple-card-progress">
          <div class="couple-card-progress-fill" style="width: ${ownerPct}%"></div>
        </div>

        <form class="inline-add-form ${isFormOpen ? '' : 'hidden'}" data-inline-form="${o.key}" onsubmit="return false;">
          <label class="inline-add-label">Nova tarefa para ${ownerDisplayName(o.key)}</label>
          <div class="inline-add-row">
            <input type="text" class="inline-add-input" data-inline-input="${o.key}" maxlength="100" placeholder="${o.placeholder}" autocomplete="off">
            <button type="submit" class="btn-inline-save">Salvar</button>
          </div>
          <div class="inline-extras-row">
            <select class="inline-mini-select" data-inline-priority="${o.key}" aria-label="Prioridade">
              <option value="Medium">🟡 Média</option>
              <option value="High">🔴 Alta</option>
              <option value="Low">🟢 Baixa</option>
            </select>
            <input type="datetime-local" class="inline-mini-date" data-inline-deadline="${o.key}" aria-label="Prazo">
          </div>
          <div class="emoji-picker-row">
            <span class="emoji-picker-label">Ícone:</span>
            ${emojiButtonsHtml}
          </div>
        </form>

        <ul class="couple-task-list">
          ${itemsHtml}
        </ul>
      </section>
    `;
  }).join('');

  bindCoupleBoardListeners();
  bindTaskItemListeners(el.coupleBoardView);
}

function bindCoupleBoardListeners() {
  // Toggle inline add forms without destroying DOM (preserves mobile keyboard focus!)
  el.coupleBoardView.querySelectorAll('[data-toggle-inline]').forEach(btn => {
    btn.addEventListener('click', () => {
      const owner = btn.getAttribute('data-toggle-inline');
      const nextOpen = !appState.openInlineForms[owner];
      appState.openInlineForms[owner] = nextOpen;
      const form = el.coupleBoardView.querySelector(`[data-inline-form="${owner}"]`);
      if (form) {
        form.classList.toggle('hidden', !nextOpen);
        btn.textContent = nextOpen ? '−' : '+';
        if (nextOpen) {
          const inp = form.querySelector(`[data-inline-input="${owner}"]`);
          if (inp) inp.focus();
        }
      }
    });
  });

  // Inline emoji selection
  el.coupleBoardView.querySelectorAll('[data-inline-emoji]').forEach(btn => {
    btn.addEventListener('click', () => {
      const owner = btn.getAttribute('data-owner');
      const emoji = btn.getAttribute('data-inline-emoji');
      appState.selectedInlineEmojis[owner] = emoji;
      btn.parentElement.querySelectorAll('.emoji-opt').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  // Inline add task submit
  el.coupleBoardView.querySelectorAll('[data-inline-form]').forEach(form => {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const owner = form.getAttribute('data-inline-form');
      const input = form.querySelector(`[data-inline-input="${owner}"]`);
      const prioSel = form.querySelector(`[data-inline-priority="${owner}"]`);
      const dateInp = form.querySelector(`[data-inline-deadline="${owner}"]`);
      const title = (input.value || '').trim();
      if (!title) {
        showToast('Digite o nome da tarefa primeiro ✍️');
        input.focus();
        return;
      }

      const autoSvg = detectSvgKeyFromTitle(title);
      appState.openInlineForms[owner] = false;
      createTask({
        title,
        owner,
        priority: prioSel ? prioSel.value : 'Medium',
        deadline: dateInp && dateInp.value ? new Date(dateInp.value).toISOString() : null,
        recurrence: 'none',
        emoji: appState.selectedInlineEmojis[owner] || '✨',
        svgKey: autoSvg
      });
    });
  });

  // Drag & Drop between Owner Cards
  el.coupleBoardView.querySelectorAll('[data-drop-owner]').forEach(card => {
    card.addEventListener('dragover', e => {
      e.preventDefault();
      card.classList.add('drag-over');
    });
    card.addEventListener('dragleave', e => {
      if (!card.contains(e.relatedTarget)) {
        card.classList.remove('drag-over');
      }
    });
    card.addEventListener('drop', e => {
      e.preventDefault();
      card.classList.remove('drag-over');
      const targetOwner = card.getAttribute('data-drop-owner');
      const taskId = appState.draggedTaskId || e.dataTransfer.getData('text/plain');
      if (taskId && targetOwner) {
        reassignTaskOwner(taskId, targetOwner);
      }
      appState.draggedTaskId = null;
    });
  });
}

function renderUnifiedList(filteredTasks) {
  let listTasks = filteredTasks;
  if (appState.ownerFilter !== 'all') {
    listTasks = listTasks.filter(t => (t.owner || 'Shared') === appState.ownerFilter);
  }
  if (appState.statusFilter === 'pending') {
    listTasks = listTasks.filter(t => !t.completed);
  } else if (appState.statusFilter === 'done') {
    listTasks = listTasks.filter(t => t.completed);
  }

  const todoList = listTasks.filter(t => !t.completed);
  const doneList = listTasks.filter(t => t.completed);

  el.todoCount.textContent = todoList.length;
  el.completedCount.textContent = doneList.length;

  if (listTasks.length === 0) {
    el.emptyStateView.style.display = 'flex';
    el.todoSection.style.display = 'none';
    el.completedSection.style.display = 'none';
    return;
  }

  el.emptyStateView.style.display = 'none';
  el.todoSection.style.display = todoList.length > 0 ? 'flex' : 'none';
  el.completedSection.style.display = doneList.length > 0 ? 'flex' : 'none';

  el.todoTaskList.innerHTML = todoList.map(t => renderTaskItemHTML(t, false)).join('');
  el.completedTaskList.innerHTML = doneList.map(t => renderTaskItemHTML(t, false)).join('');

  bindTaskItemListeners(el.unifiedListView);
}

function renderTaskItemHTML(task, isBoardMode) {
  const isCompleted = !!task.completed;
  const isExpanded = task.id === appState.expandedTaskId;
  const deadlineInfo = formatDeadline(task.deadline);
  const subtasks = task.subtasks || [];
  const comments = task.comments || [];
  const subDone = subtasks.filter(s => s.completed).length;

  const ownerCls = task.owner === 'Gus' ? 'gus' : task.owner === 'Isa' ? 'isa' : 'shared';
  const listObj = appState.dbData.lists.find(l => l.id === task.listId);
  const showListPill = appState.activeFilter !== 'list' && listObj && appState.dbData.lists.length > 1;

  // Compact metadata chips
  const chips = [];
  if (!isBoardMode) {
    chips.push(`<span class="meta-chip owner-${ownerCls}">${ownerDisplayName(task.owner)}</span>`);
  }
  if (task.priority === 'High') {
    chips.push(`<span class="meta-chip prio-high">🔴 Alta</span>`);
  } else if (task.priority === 'Low') {
    chips.push(`<span class="meta-chip prio-low">🟢 Baixa</span>`);
  }
  if (deadlineInfo.text) {
    chips.push(`<span class="meta-chip ${deadlineInfo.className}">${deadlineInfo.text}</span>`);
  }
  if (task.recurrence && task.recurrence !== 'none') {
    const recLabels = { daily: 'Diária', weekly: 'Semanal', monthly: 'Mensal' };
    chips.push(`<span class="meta-chip">🔁 ${recLabels[task.recurrence] || task.recurrence}</span>`);
  }
  if (subtasks.length > 0) {
    chips.push(`<span class="meta-chip">☑ ${subDone}/${subtasks.length}</span>`);
  }
  if (comments.length > 0) {
    chips.push(`<span class="meta-chip">💬 ${comments.length}</span>`);
  }
  if (showListPill) {
    chips.push(`<span class="meta-chip">${getSmartListIcon(listObj.name)} ${escapeHTML(listObj.name)}</span>`);
  }
  if (isCompleted && task.completedBy) {
    chips.push(`<span class="meta-chip">✓ por ${ownerDisplayName(task.completedBy)}</span>`);
  }

  // Expanded details panel
  let expandedHtml = '';
  if (isExpanded) {
    const listOptions = appState.dbData.lists.map(l =>
      `<option value="${l.id}" ${l.id === task.listId ? 'selected' : ''}>${escapeHTML(l.name)}</option>`
    ).join('');

    const subtasksHtml = subtasks.length > 0
      ? subtasks.map(st => `
          <div class="subtask-row ${st.completed ? 'done' : ''}">
            <input type="checkbox" class="subtask-checkbox" data-subtask-id="${st.id}" ${st.completed ? 'checked' : ''}>
            <span class="subtask-label">${escapeHTML(st.title)}</span>
            <button type="button" class="task-mini-btn delete btn-delete-subtask" data-subtask-id="${st.id}" title="Remover item">✕</button>
          </div>
        `).join('')
      : '<p class="panel-sub" style="font-style: italic;">Nenhum item no checklist.</p>';

    const commentsHtml = comments.length > 0
      ? comments.map(c => {
          const tStr = new Date(c.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          return `
            <div class="comment-bubble">
              <span><strong>${ownerDisplayName(c.user)}:</strong> ${escapeHTML(c.text)}</span>
              <span class="comment-time">${tStr}</span>
            </div>
          `;
        }).join('')
      : '<p class="panel-sub" style="font-style: italic;">Sem comentários ainda.</p>';

    const emojiChoices = ALL_EMOJIS.slice(0, 12).map(em => `
      <button type="button" class="emoji-opt ${task.emoji === em && !task.svgKey ? 'selected' : ''}" data-change-task-emoji="${em}">${em}</button>
    `).join('');

    expandedHtml = `
      <div class="task-expanded-panel">
        <div class="expanded-quick-actions">
          <div class="expanded-owner-pills" role="group" aria-label="Trocar responsável rapidamente">
            <button type="button" class="owner-quick-btn gus ${task.owner === 'Gus' ? 'active' : ''}" data-quick-owner="Gus">👦🏻 Gustavo</button>
            <button type="button" class="owner-quick-btn isa ${task.owner === 'Isa' ? 'active' : ''}" data-quick-owner="Isa">👩🏻 Isabella</button>
            <button type="button" class="owner-quick-btn shared ${!task.owner || task.owner === 'Shared' ? 'active' : ''}" data-quick-owner="Shared">💛 Ambos</button>
          </div>
          <button type="button" class="btn-focus-task" data-focus-task-id="${task.id}">🍅 Focar</button>
        </div>

        <div class="expanded-title-edit-row">
          <input type="text" class="input-edit-task-title" value="${escapeHTML(task.title)}" aria-label="Editar título da tarefa">
          <button type="button" class="inline-sub-btn btn-save-task-title">Salvar título</button>
        </div>

        <div class="expanded-settings-grid">
          <div class="expanded-field">
            <label>Responsável</label>
            <select class="select-task-card-owner">
              <option value="Shared" ${task.owner === 'Shared' || !task.owner ? 'selected' : ''}>💛 Ambos</option>
              <option value="Gus" ${task.owner === 'Gus' ? 'selected' : ''}>👦🏻 Gustavo</option>
              <option value="Isa" ${task.owner === 'Isa' ? 'selected' : ''}>👩🏻 Isabella</option>
            </select>
          </div>
          <div class="expanded-field">
            <label>Prioridade</label>
            <select class="select-task-card-priority">
              <option value="High" ${task.priority === 'High' ? 'selected' : ''}>🔴 Alta</option>
              <option value="Medium" ${task.priority === 'Medium' || !task.priority ? 'selected' : ''}>🟡 Média</option>
              <option value="Low" ${task.priority === 'Low' ? 'selected' : ''}>🟢 Baixa</option>
            </select>
          </div>
          <div class="expanded-field">
            <label>Repetir</label>
            <select class="select-task-card-recurrence">
              <option value="none" ${!task.recurrence || task.recurrence === 'none' ? 'selected' : ''}>Não repetir</option>
              <option value="daily" ${task.recurrence === 'daily' ? 'selected' : ''}>Diariamente</option>
              <option value="weekly" ${task.recurrence === 'weekly' ? 'selected' : ''}>Semanalmente</option>
              <option value="monthly" ${task.recurrence === 'monthly' ? 'selected' : ''}>Mensalmente</option>
            </select>
          </div>
          <div class="expanded-field">
            <label>Lista</label>
            <select class="select-task-card-list">${listOptions}</select>
          </div>
          <div class="expanded-field">
            <label>Prazo Limite</label>
            <input type="datetime-local" class="input-task-card-deadline" value="${toLocalDatetimeInputValue(task.deadline)}">
          </div>
        </div>

        <div class="emoji-picker-row">
          <span class="emoji-picker-label">Ícone:</span>
          ${emojiChoices}
        </div>

        <div class="expanded-sub-block">
          <div class="expanded-block-title">
            <span>☑ Checklist de Sub-tarefas</span>
            <span>${subDone}/${subtasks.length}</span>
          </div>
          ${subtasksHtml}
          <div class="inline-sub-form">
            <input type="text" class="inline-sub-input input-subtask-add" placeholder="Adicionar sub-tarefa...">
            <button type="button" class="inline-sub-btn btn-subtask-add-submit">+</button>
          </div>
        </div>

        <div class="expanded-sub-block">
          <div class="expanded-block-title">
            <span>💬 Chat / Comentários</span>
            <span>${comments.length}</span>
          </div>
          ${commentsHtml}
          <div class="inline-sub-form">
            <input type="text" class="inline-sub-input input-comment" placeholder="Escrever recado nessa tarefa...">
            <button type="button" class="inline-sub-btn btn-comment-send">Enviar</button>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <li class="task-item ${isCompleted ? 'completed' : ''} ${!isBoardMode ? `owner-ribbon-${ownerCls}` : ''}"
        data-task-id="${task.id}"
        draggable="${isBoardMode && !isExpanded ? 'true' : 'false'}">
      <div class="task-item-main">
        <button type="button"
                class="tactile-checkbox ${isCompleted ? 'checked' : ''}"
                role="checkbox"
                aria-checked="${isCompleted}"
                aria-label="Marcar tarefa ${escapeHTML(task.title)}">
          ${isCompleted ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
        </button>

        <div class="task-item-content" title="Clique para ver detalhes, sub-tarefas e comentários">
          <div class="task-item-title">${escapeHTML(task.title)}</div>
          ${chips.length > 0 ? `<div class="task-meta-chips">${chips.join('')}</div>` : ''}
        </div>

        <div class="task-item-right">
          ${renderTaskIcon(task)}
          <button type="button" class="task-mini-btn btn-expand-task" title="Detalhes" aria-label="Expandir detalhes">
            ${isExpanded ? '▴' : '▾'}
          </button>
          <button type="button" class="task-mini-btn delete btn-delete-task" title="Remover tarefa" aria-label="Remover tarefa ${escapeHTML(task.title)}">✕</button>
        </div>
      </div>
      ${expandedHtml}
    </li>
  `;
}

function bindTaskItemListeners(container) {
  // Drag start for Board Mode
  container.querySelectorAll('.task-item[draggable="true"]').forEach(item => {
    item.addEventListener('dragstart', e => {
      const taskId = item.getAttribute('data-task-id');
      appState.draggedTaskId = taskId;
      e.dataTransfer.setData('text/plain', taskId);
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend', () => {
      appState.draggedTaskId = null;
      document.querySelectorAll('.couple-card.drag-over').forEach(c => c.classList.remove('drag-over'));
    });
  });

  // Tactile Checkbox Toggle
  container.querySelectorAll('.task-item .tactile-checkbox').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const item = btn.closest('.task-item');
      const taskId = item.getAttribute('data-task-id');
      const currentlyDone = btn.classList.contains('checked');
      toggleTaskCompletion(taskId, !currentlyDone);
    });
  });

  // Expand / Collapse on content click or chevron click
  container.querySelectorAll('.task-item-content, .btn-expand-task').forEach(trigger => {
    trigger.addEventListener('click', e => {
      e.stopPropagation();
      const item = trigger.closest('.task-item');
      const taskId = item.getAttribute('data-task-id');
      appState.expandedTaskId = appState.expandedTaskId === taskId ? null : taskId;
      renderTasks();
    });
  });

  // Delete Task
  container.querySelectorAll('.btn-delete-task').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const taskId = btn.closest('.task-item').getAttribute('data-task-id');
      handleDeleteTask(taskId);
    });
  });

  // Expanded panel controls
  container.querySelectorAll('.task-expanded-panel').forEach(panel => {
    panel.addEventListener('click', e => e.stopPropagation());
    const taskId = panel.closest('.task-item').getAttribute('data-task-id');

    // 1-Tap Owner Quick Switch (Mobile-friendly alternative to drag & drop)
    panel.querySelectorAll('[data-quick-owner]').forEach(ob => {
      ob.addEventListener('click', () => {
        reassignTaskOwner(taskId, ob.getAttribute('data-quick-owner'));
      });
    });

    // Launch Focus Timer for this specific task
    const focusBtn = panel.querySelector('.btn-focus-task');
    if (focusBtn) {
      focusBtn.addEventListener('click', () => {
        const task = appState.dbData.tasks.find(x => x.id === taskId);
        if (task) openFocusTimerForTask(task);
      });
    }

    // Inline Title Save
    const titleInput = panel.querySelector('.input-edit-task-title');
    const saveTitleBtn = panel.querySelector('.btn-save-task-title');
    const commitTitle = () => {
      const val = (titleInput.value || '').trim();
      if (val) updateTaskField(taskId, 'title', val, 'Título atualizado ✏️');
    };
    if (saveTitleBtn) saveTitleBtn.addEventListener('click', commitTitle);
    if (titleInput) {
      titleInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); commitTitle(); }
      });
    }

    // Settings selects & deadline
    const selOwner = panel.querySelector('.select-task-card-owner');
    const selPrio = panel.querySelector('.select-task-card-priority');
    const selRec = panel.querySelector('.select-task-card-recurrence');
    const selList = panel.querySelector('.select-task-card-list');
    const inpDead = panel.querySelector('.input-task-card-deadline');

    if (selOwner) selOwner.addEventListener('change', () => updateTaskField(taskId, 'owner', selOwner.value));
    if (selPrio) selPrio.addEventListener('change', () => updateTaskField(taskId, 'priority', selPrio.value));
    if (selRec) selRec.addEventListener('change', () => updateTaskField(taskId, 'recurrence', selRec.value));
    if (selList) selList.addEventListener('change', () => updateTaskField(taskId, 'listId', selList.value, 'Tarefa movida de lista 📁'));
    if (inpDead) {
      inpDead.addEventListener('change', () => {
        const iso = inpDead.value ? new Date(inpDead.value).toISOString() : null;
        updateTaskField(taskId, 'deadline', iso);
      });
    }

    // Change emoji
    panel.querySelectorAll('[data-change-task-emoji]').forEach(eb => {
      eb.addEventListener('click', () => {
        const data = appState.dbData;
        const t = data.tasks.find(x => x.id === taskId);
        if (!t) return;
        t.emoji = eb.getAttribute('data-change-task-emoji');
        t.svgKey = null;
        saveDataAndRender(data);
      });
    });

    // Subtasks
    panel.querySelectorAll('.subtask-checkbox').forEach(chk => {
      chk.addEventListener('change', () => {
        toggleSubtaskCompletion(taskId, chk.getAttribute('data-subtask-id'), chk.checked);
      });
    });
    panel.querySelectorAll('.btn-delete-subtask').forEach(btn => {
      btn.addEventListener('click', () => {
        handleDeleteSubtask(taskId, btn.getAttribute('data-subtask-id'));
      });
    });

    const subInput = panel.querySelector('.input-subtask-add');
    const subBtn = panel.querySelector('.btn-subtask-add-submit');
    const addSub = () => {
      const val = (subInput.value || '').trim();
      if (val) handleAddSubtask(taskId, val);
    };
    if (subBtn) subBtn.addEventListener('click', addSub);
    if (subInput) subInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } });

    // Comments
    const comInput = panel.querySelector('.input-comment');
    const comBtn = panel.querySelector('.btn-comment-send');
    const addCom = () => {
      const val = (comInput.value || '').trim();
      if (val) handleAddComment(taskId, val);
    };
    if (comBtn) comBtn.addEventListener('click', addCom);
    if (comInput) comInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addCom(); } });
  });
}

// ============================================================================
// TASK CRUD ACTIONS
// ============================================================================

function getDefaultTargetListId() {
  const data = appState.dbData;
  if (appState.activeFilter === 'list' && appState.activeListId) {
    if (data.lists.some(l => l.id === appState.activeListId)) {
      return appState.activeListId;
    }
  }
  return data.lists.length > 0 ? data.lists[0].id : 'l-geral';
}

function createTask({ title, owner = 'Shared', priority = 'Medium', deadline = null, recurrence = 'none', emoji = null, svgKey = null, listId = null, projectId = null }) {
  const data = appState.dbData;
  const targetListId = listId || getDefaultTargetListId();
  const resolvedSvg = svgKey !== undefined ? svgKey : detectSvgKeyFromTitle(title);

  const newTask = {
    id: 't-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    listId: targetListId,
    projectId: projectId || null,
    title: title.trim(),
    completed: false,
    completedBy: null,
    completedAt: null,
    createdBy: appState.currentUser,
    createdAt: new Date().toISOString(),
    deadline,
    owner,
    priority,
    recurrence,
    emoji: emoji || '✨',
    svgKey: resolvedSvg || null,
    subtasks: [],
    comments: []
  };

  data.tasks.push(newTask);

  const activeList = data.lists.find(l => l.id === targetListId);
  db.logAction(data, 'add_task', {
    taskId: newTask.id,
    taskTitle: newTask.title,
    listName: projectId ? 'Meta/Projeto' : (activeList ? activeList.name : 'Lista')
  });

  playSound('add');
  saveDataAndRender(data);
  showToast('Nova tarefa adicionada! ✨');
}

function toggleTaskCompletion(taskId, isChecked) {
  const data = appState.dbData;
  const task = data.tasks.find(t => t.id === taskId);
  if (!task) return;

  task.completed = isChecked;
  task.completedBy = isChecked ? appState.currentUser : null;
  task.completedAt = isChecked ? new Date().toISOString() : null;

  db.logAction(data, isChecked ? 'complete_task' : 'uncomplete_task', {
    taskId: task.id,
    taskTitle: task.title
  });

  if (isChecked) {
    const scope = getBaseScopeTasks().tasks;
    const ownerTasks = scope.filter(t => (t.owner || 'Shared') === (task.owner || 'Shared'));
    const ownerAllDone = ownerTasks.length > 0 && ownerTasks.every(t => t.completed);
    const allDone = scope.length > 0 && scope.every(t => t.completed);

    // Check if linked project hit 100%
    let projectComplete = false;
    if (task.projectId) {
      const pTasks = data.tasks.filter(t => t.projectId === task.projectId);
      projectComplete = pTasks.length > 0 && pTasks.every(t => t.completed);
    }

    if (allDone) {
      playSound('celebrate');
      launchConfetti(110);
      showToast('Tudo concluído! Hora do sorvete com o Bruce! 🍦🐶💛');
    } else if (projectComplete) {
      playSound('celebrate');
      launchConfetti(75);
      showToast('Meta 100% concluída! Vocês arrasaram! 🚀🎉');
    } else if (ownerAllDone) {
      playSound('celebrate');
      launchConfetti(50);
      showToast(`Lista de ${ownerDisplayName(task.owner)} 100% concluída! 🎉`);
    } else {
      playSound('check');
      showToast(`"${task.title}" concluída! ✅`, {
        actionLabel: 'Desfazer',
        onAction: () => toggleTaskCompletion(taskId, false)
      });
    }
  } else {
    playSound('uncheck');
  }

  saveDataAndRender(data);
}

async function handleDeleteTask(taskId) {
  const data = appState.dbData;
  const idx = data.tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return;
  const task = data.tasks[idx];

  if (!task.completed) {
    const ok = await confirmAction({
      title: 'Remover tarefa?',
      description: `Deseja remover "${task.title}" da lista?`,
      confirmLabel: 'Remover',
      danger: true
    });
    if (!ok) return;
  }

  const backupTask = JSON.parse(JSON.stringify(task));
  db.logAction(data, 'delete_task', { taskId: task.id, taskTitle: task.title });
  data.tasks.splice(idx, 1);
  if (appState.expandedTaskId === taskId) appState.expandedTaskId = null;

  saveDataAndRender(data);
  showToast('Tarefa removida', {
    actionLabel: 'Desfazer',
    onAction: () => {
      appState.dbData.tasks.push(backupTask);
      saveDataAndRender(appState.dbData);
      showToast('Tarefa restaurada! ↩️');
    }
  });
}

function updateTaskField(taskId, field, value, toastMsg = null) {
  const data = appState.dbData;
  const task = data.tasks.find(t => t.id === taskId);
  if (!task) return;
  task[field] = value;
  saveDataAndRender(data);
  if (toastMsg) showToast(toastMsg);
}

function reassignTaskOwner(taskId, newOwner) {
  const data = appState.dbData;
  const task = data.tasks.find(t => t.id === taskId);
  if (!task || task.owner === newOwner) return;
  task.owner = newOwner;
  playSound('add');
  saveDataAndRender(data);
  showToast(`Movida para ${ownerDisplayName(newOwner)} ✨`);
}

function toggleSubtaskCompletion(taskId, subtaskId, isChecked) {
  const data = appState.dbData;
  const task = data.tasks.find(t => t.id === taskId);
  if (!task) return;
  const st = (task.subtasks || []).find(s => s.id === subtaskId);
  if (st) {
    st.completed = isChecked;
    playSound(isChecked ? 'check' : 'uncheck');
    saveDataAndRender(data);
  }
}

function handleDeleteSubtask(taskId, subtaskId) {
  const data = appState.dbData;
  const task = data.tasks.find(t => t.id === taskId);
  if (!task) return;
  task.subtasks = (task.subtasks || []).filter(s => s.id !== subtaskId);
  saveDataAndRender(data);
}

function handleAddSubtask(taskId, title) {
  const data = appState.dbData;
  const task = data.tasks.find(t => t.id === taskId);
  if (!task) return;
  task.subtasks = task.subtasks || [];
  task.subtasks.push({
    id: 'st-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
    title,
    completed: false
  });
  playSound('add');
  saveDataAndRender(data);
}

function handleAddComment(taskId, text) {
  const data = appState.dbData;
  const task = data.tasks.find(t => t.id === taskId);
  if (!task) return;
  task.comments = task.comments || [];
  task.comments.push({
    id: 'c-' + Date.now(),
    user: appState.currentUser,
    text,
    timestamp: new Date().toISOString()
  });
  playSound('add');
  saveDataAndRender(data);
}

// Silent Background Recurrence Cloner (FIXED: resets subtasks & advances deadline)
function checkRecurrenceAndClone(data) {
  if (!data || !data.tasks) return;
  const now = new Date();
  const snapshot = [...data.tasks];

  snapshot.forEach(task => {
    if (task.completed && task.recurrence && task.recurrence !== 'none') {
      const completedAt = task.completedAt ? new Date(task.completedAt) : new Date(task.createdAt);
      const diffDays = (now - completedAt) / (1000 * 60 * 60 * 24);
      let shouldClone = false;
      let nextDeadline = task.deadline ? new Date(task.deadline) : null;

      if (task.recurrence === 'daily' && diffDays >= 1) {
        shouldClone = true;
        if (nextDeadline) nextDeadline.setDate(nextDeadline.getDate() + 1);
      } else if (task.recurrence === 'weekly' && diffDays >= 7) {
        shouldClone = true;
        if (nextDeadline) nextDeadline.setDate(nextDeadline.getDate() + 7);
      } else if (task.recurrence === 'monthly' && diffDays >= 30) {
        shouldClone = true;
        if (nextDeadline) nextDeadline.setMonth(nextDeadline.getMonth() + 1);
      }

      if (shouldClone) {
        const originalRecurrence = task.recurrence;
        const cloned = {
          ...JSON.parse(JSON.stringify(task)),
          id: 't-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          completed: false,
          completedBy: null,
          completedAt: null,
          createdAt: now.toISOString(),
          deadline: nextDeadline ? nextDeadline.toISOString() : null,
          subtasks: (task.subtasks || []).map(st => ({ ...st, completed: false })),
          comments: [],
          lastRecurrentTrigger: now.toISOString()
        };
        task.recurrence = 'none';
        data.tasks.push(cloned);
        db.logAction(data, 'add_task', {
          taskId: cloned.id,
          taskTitle: `${cloned.title} (Recorrente)`,
          listName: 'Rotina Automática'
        });
      }
    }
  });
}

// ============================================================================
// VIEW 2: CALENDÁRIO + INLINE DAY AGENDA PANEL
// ============================================================================

function renderCalendar() {
  const data = appState.dbData;
  const year = appState.currentMonth.getFullYear();
  const month = appState.currentMonth.getMonth();
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  el.calendarMonthTitle.textContent = `${monthNames[month]} ${year}`;

  const headers = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  let html = headers.map(h => `<div class="calendar-day-header">${h}</div>`).join('');

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevTotalDays = new Date(year, month, 0).getDate();

  for (let i = firstDayIndex - 1; i >= 0; i--) {
    html += `<div class="calendar-cell other-month"><div class="calendar-date-number">${prevTotalDays - i}</div></div>`;
  }

  const today = new Date();
  const selDay = appState.selectedCalendarDay;

  for (let day = 1; day <= totalDays; day++) {
    const cellDate = new Date(year, month, day);
    const isToday = cellDate.toDateString() === today.toDateString();
    const isSelected = selDay && cellDate.toDateString() === selDay.toDateString();

    const dayTasks = data.tasks.filter(t => {
      if (!t.deadline) return false;
      const td = new Date(t.deadline);
      return td.getFullYear() === year && td.getMonth() === month && td.getDate() === day;
    });

    const dayEvents = agenda.eventsOnDay(appState.calendar.events, cellDate);

    let dotsHtml = '';
    if (dayTasks.length > 0 || dayEvents.length > 0) {
      const eventMarks = dayEvents.slice(0, 4).map(ev => {
        const meta = agenda.ownerMeta(ev.owner);
        return `<span class="calendar-event-bar" style="background:${meta.color}" title="📅 ${escapeHTML(ev.title)}">${escapeHTML(ev.title)}</span>`;
      }).join('');
      const extraEvents = dayEvents.length > 4 ? `<span class="calendar-event-more">+${dayEvents.length - 4}</span>` : '';
      const taskDots = dayTasks.slice(0, 8).map(t => {
        let bg = '#ffec99';
        if (t.owner === 'Gus') bg = '#aee8e4';
        if (t.owner === 'Isa') bg = '#ffc4b0';
        const op = t.completed ? 'opacity: 0.35;' : '';
        return `<span class="calendar-task-dot" style="background:${bg};${op}" title="${escapeHTML(t.title)}"></span>`;
      }).join('');
      dotsHtml = `<div class="calendar-events-stack">${eventMarks}${extraEvents}</div>`
        + (taskDots ? `<div class="calendar-tasks-indicator">${taskDots}</div>` : '');
    }

    html += `
      <div class="calendar-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-day="${day}">
        <div class="calendar-date-number">${day}</div>
        ${dotsHtml}
      </div>
    `;
  }

  const remaining = (7 - ((firstDayIndex + totalDays) % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    html += `<div class="calendar-cell other-month"><div class="calendar-date-number">${i}</div></div>`;
  }

  el.calendarGrid.innerHTML = html;

  el.calendarGrid.querySelectorAll('.calendar-cell:not(.other-month)').forEach(cell => {
    cell.addEventListener('click', () => {
      const dayNum = parseInt(cell.getAttribute('data-day'), 10);
      appState.selectedCalendarDay = new Date(year, month, dayNum);
      renderCalendar();
    });
  });

  renderCalendarDayPanel();
}

function renderCalendarDayPanel() {
  const d = appState.selectedCalendarDay;
  if (!d || !el.calendarDayPanel) return;

  el.calendarDayPanel.style.display = 'flex';
  const dateLabel = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  el.calendarDayPanelTitle.textContent = `📅 ${dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}`;

  const dayTasks = appState.dbData.tasks.filter(t => {
    if (!t.deadline) return false;
    const td = new Date(t.deadline);
    return td.getFullYear() === d.getFullYear() &&
           td.getMonth() === d.getMonth() &&
           td.getDate() === d.getDate();
  });

  const dayEvents = agenda.buildDayAgenda([], appState.calendar.events, d);
  if (el.calendarDayEventsList) {
    if (dayEvents.length > 0) {
      el.calendarDayEventsList.style.display = 'flex';
      el.calendarDayEventsList.innerHTML = renderAgendaItemsHTML(dayEvents);
    } else {
      el.calendarDayEventsList.style.display = 'none';
      el.calendarDayEventsList.innerHTML = '';
    }
  }

  const eventsLabel = dayEvents.length > 0 ? ` · ${dayEvents.length} compromisso${dayEvents.length === 1 ? '' : 's'} na agenda` : '';
  el.calendarDayPanelSub.textContent = (dayTasks.length === 0
    ? 'Nenhuma tarefa com prazo neste dia'
    : `${dayTasks.filter(t => t.completed).length} de ${dayTasks.length} concluída(s)`) + eventsLabel;

  if (dayTasks.length === 0) {
    el.calendarDayTasksList.innerHTML = '<p class="panel-sub" style="font-style:italic;">Dia livre! Adicione uma tarefa abaixo se quiser agendar algo.</p>';
  } else {
    el.calendarDayTasksList.innerHTML = dayTasks.map(t => {
      const timeStr = new Date(t.deadline).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const ownerCls = t.owner === 'Gus' ? 'gus' : t.owner === 'Isa' ? 'isa' : 'shared';
      return `
        <div class="project-task-row ${t.completed ? 'done' : ''}">
          <button type="button" class="tactile-checkbox cal-task-check ${t.completed ? 'checked' : ''}" data-task-id="${t.id}" style="width:24px;height:24px;">
            ${t.completed ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
          </button>
          <span class="pt-title">${escapeHTML(t.title)}</span>
          <span class="panel-sub">⏰ ${timeStr}</span>
          <span class="owner-pill ${ownerCls}">${ownerDisplayName(t.owner)}</span>
        </div>
      `;
    }).join('');

    el.calendarDayTasksList.querySelectorAll('.cal-task-check').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-task-id');
        toggleTaskCompletion(id, !btn.classList.contains('checked'));
      });
    });
  }
}

// ============================================================================
// VIEW 3: PROJETOS & GRANDES METAS
// ============================================================================

function renderProjects() {
  const data = appState.dbData;
  const projects = data.projects || [];

  if (projects.length === 0) {
    el.projectsListContainer.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">🚀</div>
        <h3 class="empty-state-title">Nenhuma grande meta ainda</h3>
        <p class="empty-state-desc">Criem um projeto para uma viagem, mudança ou sonho do casal!</p>
      </div>
    `;
    return;
  }

  el.projectsListContainer.innerHTML = projects.map(project => {
    const target = new Date(project.targetDate);
    const diffDays = Math.ceil((target - new Date()) / (1000 * 60 * 60 * 24));
    const countdownText = diffDays > 0
      ? `⏳ ${diffDays} dia${diffDays === 1 ? '' : 's'} restante${diffDays === 1 ? '' : 's'}`
      : (diffDays === 0 ? '🎯 É hoje!' : `⚠️ Atrasado há ${Math.abs(diffDays)} dia(s)`);

    const pTasks = data.tasks.filter(t => t.projectId === project.id);
    const done = pTasks.filter(t => t.completed).length;
    const total = pTasks.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    const tasksHtml = pTasks.length > 0
      ? pTasks.map(t => {
          const ownerCls = t.owner === 'Gus' ? 'gus' : t.owner === 'Isa' ? 'isa' : 'shared';
          return `
            <div class="project-task-row ${t.completed ? 'done' : ''}">
              <input type="checkbox" class="project-task-toggle" data-task-id="${t.id}" ${t.completed ? 'checked' : ''} style="width:16px;height:16px;accent-color:#10b981;cursor:pointer;">
              <span class="pt-title">${escapeHTML(t.title)}</span>
              <span class="owner-pill ${ownerCls}" style="font-size:0.62rem;">${ownerShortName(t.owner)}</span>
              <button type="button" class="task-mini-btn delete project-task-delete" data-task-id="${t.id}" title="Remover tarefa">✕</button>
            </div>
          `;
        }).join('')
      : '<p class="panel-sub" style="font-style:italic;">Nenhuma tarefa vinculada ainda.</p>';

    return `
      <article class="project-card" data-project-id="${project.id}">
        <div class="project-card-top">
          <span class="project-countdown-chip ${diffDays <= 7 ? 'urgent' : ''}">${countdownText}</span>
          <button type="button" class="task-mini-btn delete project-delete-btn" data-project-id="${project.id}" title="Excluir projeto">✕</button>
        </div>
        <h3 class="project-title">${escapeHTML(project.name)} ${total > 0 && done === total ? '🎉' : ''}</h3>
        <div>
          <div class="project-progress-label">
            <span>Progresso da Meta</span>
            <strong>${pct}% (${done}/${total})</strong>
          </div>
          <div class="project-bar-track">
            <div class="project-bar-fill" style="width:${pct}%"></div>
          </div>
        </div>
        <div class="project-tasks-list">${tasksHtml}</div>
        <form class="project-add-row" data-project-form="${project.id}" onsubmit="return false;">
          <input type="text" class="input-project-task-add" placeholder="Nova etapa da meta..." autocomplete="off">
          <select class="select-project-task-owner" aria-label="Responsável">
            <option value="Shared">💛</option>
            <option value="Gus">👦🏻</option>
            <option value="Isa">👩🏻</option>
          </select>
          <button type="submit" class="btn-tactile btn-amber-sm">+</button>
        </form>
      </article>
    `;
  }).join('');

  el.projectsListContainer.querySelectorAll('.project-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => handleDeleteProject(btn.getAttribute('data-project-id')));
  });
  el.projectsListContainer.querySelectorAll('.project-task-toggle').forEach(chk => {
    chk.addEventListener('change', () => toggleTaskCompletion(chk.getAttribute('data-task-id'), chk.checked));
  });
  el.projectsListContainer.querySelectorAll('.project-task-delete').forEach(btn => {
    btn.addEventListener('click', () => handleDeleteTask(btn.getAttribute('data-task-id')));
  });
  el.projectsListContainer.querySelectorAll('[data-project-form]').forEach(form => {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const projectId = form.getAttribute('data-project-form');
      const input = form.querySelector('.input-project-task-add');
      const ownerSel = form.querySelector('.select-project-task-owner');
      const title = (input.value || '').trim();
      if (!title) return;
      createTask({ title, owner: ownerSel.value, projectId });
      input.value = '';
    });
  });
}

function handleCreateProject() {
  const name = el.inputProjectName.value.trim();
  const targetVal = el.inputProjectTargetDate.value;
  if (!name || !targetVal) {
    showToast('Preencha o nome e a data-alvo do projeto ✍️');
    return;
  }

  const data = appState.dbData;
  const newProject = {
    id: 'p-' + Date.now(),
    name,
    targetDate: new Date(targetVal).toISOString(),
    createdAt: new Date().toISOString()
  };

  data.projects = data.projects || [];
  data.projects.push(newProject);
  db.logAction(data, 'add_project', { projectId: newProject.id, projectName: newProject.name });

  el.addProjectModal.classList.remove('open');
  playSound('add');
  saveDataAndRender(data);
  showToast('Nova meta criada! 🚀');
}

async function handleDeleteProject(projectId) {
  const data = appState.dbData;
  const project = (data.projects || []).find(p => p.id === projectId);
  if (!project) return;

  const ok = await confirmAction({
    title: 'Excluir projeto?',
    description: `Deseja remover a meta "${project.name}"? As tarefas vinculadas serão mantidas nas suas listas.`,
    confirmLabel: 'Excluir',
    danger: true
  });
  if (!ok) return;

  data.projects = data.projects.filter(p => p.id !== projectId);
  data.tasks.forEach(t => { if (t.projectId === projectId) delete t.projectId; });
  db.logAction(data, 'delete_project', { projectId, projectName: project.name });
  saveDataAndRender(data);
  showToast('Projeto removido');
}

// ============================================================================
// VIEW 4: MURAL & NÓS (STICKY NOTES + ACTIVITY FEED)
// ============================================================================

function renderNotes() {
  const data = appState.dbData;
  const notes = [...(data.notes || [])].sort((a, b) => {
    if (Boolean(b.pinned) !== Boolean(a.pinned)) return b.pinned ? 1 : -1;
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  if (notes.length === 0) {
    el.notesGrid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">💌</div>
        <h3 class="empty-state-title">Mural vazio</h3>
        <p class="empty-state-desc">Deixe um bilhetinho carinhoso ou um lembrete para o seu par!</p>
      </div>
    `;
    return;
  }

  const reactEmojis = ['❤️', '🥰', '😂', '👍'];

  el.notesGrid.innerHTML = notes.map((note, idx) => {
    const rot = note.pinned ? 0 : ((idx % 3) - 1) * 1.4;
    const dateStr = new Date(note.timestamp).toLocaleString('pt-BR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
    const reactions = note.reactions || {};

    const reactionsHtml = reactEmojis.map(em => {
      const active = reactions[appState.currentUser] === em;
      const count = Object.values(reactions).filter(v => v === em).length;
      return `<button type="button" class="note-react-btn ${active ? 'active' : ''}" data-note-id="${note.id}" data-emoji="${em}">${em}${count > 0 ? ` ${count}` : ''}</button>`;
    }).join('');

    return `
      <article class="note-card note-${note.color || 'yellow'}" style="transform: rotate(${rot}deg);">
        <div class="note-pin-row">
          <span class="note-pin-dot" title="${note.pinned ? 'Recado fixado' : ''}"></span>
          <div class="note-actions">
            <button type="button" class="note-action-btn ${note.pinned ? 'pinned' : ''}" data-pin-note="${note.id}" title="${note.pinned ? 'Desafixar' : 'Fixar no topo'}">📌</button>
            <button type="button" class="note-action-btn" data-delete-note="${note.id}" title="Remover recado">🗑️</button>
          </div>
        </div>
        <div class="note-text">${escapeHTML(note.text)}</div>
        <div class="note-reactions-row">${reactionsHtml}</div>
        <div class="note-footer">Por ${ownerDisplayName(note.user)} · ${dateStr}</div>
      </article>
    `;
  }).join('');

  el.notesGrid.querySelectorAll('[data-pin-note]').forEach(btn => {
    btn.addEventListener('click', () => {
      const note = appState.dbData.notes.find(n => n.id === btn.getAttribute('data-pin-note'));
      if (!note) return;
      note.pinned = !note.pinned;
      playSound('check');
      saveDataAndRender(appState.dbData);
      showToast(note.pinned ? 'Recado fixado no topo 📌' : 'Recado desafixado');
    });
  });

  el.notesGrid.querySelectorAll('[data-delete-note]').forEach(btn => {
    btn.addEventListener('click', () => handleDeleteNote(btn.getAttribute('data-delete-note')));
  });

  el.notesGrid.querySelectorAll('.note-react-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const note = appState.dbData.notes.find(n => n.id === btn.getAttribute('data-note-id'));
      if (!note) return;
      const emoji = btn.getAttribute('data-emoji');
      note.reactions = note.reactions || {};
      if (note.reactions[appState.currentUser] === emoji) {
        delete note.reactions[appState.currentUser];
      } else {
        note.reactions[appState.currentUser] = emoji;
        playSound('check');
      }
      saveDataAndRender(appState.dbData);
    });
  });
}

function handleCreateNote() {
  const text = el.inputNoteText.value.trim();
  if (!text) {
    showToast('Escreva um recado antes de fixar 💌');
    return;
  }

  const data = appState.dbData;
  const colorInput = document.querySelector('input[name="note_color"]:checked');
  const newNote = {
    id: 'n-' + Date.now(),
    user: appState.currentUser,
    text,
    color: colorInput ? colorInput.value : 'yellow',
    pinned: false,
    reactions: {},
    timestamp: new Date().toISOString()
  };

  data.notes = data.notes || [];
  data.notes.push(newNote);
  db.logAction(data, 'add_note', {
    noteId: newNote.id,
    noteText: text.slice(0, 24) + (text.length > 24 ? '...' : '')
  });

  el.inputNoteText.value = '';
  el.addNoteModal.classList.remove('open');
  playSound('add');
  saveDataAndRender(data);
  showToast('Recado fixado no mural! 💌');
}

async function handleDeleteNote(noteId) {
  const data = appState.dbData;
  const note = (data.notes || []).find(n => n.id === noteId);
  if (!note) return;

  const ok = await confirmAction({
    title: 'Remover recado?',
    description: 'Deseja retirar este bilhete do mural?',
    confirmLabel: 'Remover',
    danger: true
  });
  if (!ok) return;

  data.notes = data.notes.filter(n => n.id !== noteId);
  db.logAction(data, 'delete_note', { noteId, noteText: note.text.slice(0, 20) });
  saveDataAndRender(data);
  showToast('Recado removido');
}

// ============================================================================
// HISTORY FEED (DRAWER + NÓS VIEW)
// ============================================================================

function renderHistory() {
  const data = appState.dbData;
  if (!data) return;
  const logs = data.history || [];

  const emojis = ['❤️', '👍', '🎉', '😂'];
  const historyHtml = logs.map(log => {
    const markerCls = log.user === 'Gus' ? 'gus' : log.user === 'Isa' ? 'isa' : 'shared';
    const iconMap = {
      add_task: '➕', complete_task: '✓', uncomplete_task: '↩️', delete_task: '🗑️',
      add_list: '📁', delete_list: '✕', add_note: '💌', delete_note: '🗑️',
      add_wish: '🎁', delete_wish: '🗑️', add_project: '🚀', delete_project: '🗑️',
      undo_action: '↩️', nudge: '💌'
    };
    const icon = iconMap[log.action] || '✏️';
    const time = new Date(log.timestamp).toLocaleString('pt-BR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });

    let text = 'atualizou o aplicativo';
    if (log.action === 'add_task') text = `adicionou <strong>"${escapeHTML(log.taskTitle)}"</strong> em <em>${escapeHTML(log.listName || 'Lista')}</em>`;
    else if (log.action === 'complete_task') text = `concluiu <strong>"${escapeHTML(log.taskTitle)}"</strong>`;
    else if (log.action === 'uncomplete_task') text = `reabriu <strong>"${escapeHTML(log.taskTitle)}"</strong>`;
    else if (log.action === 'delete_task') text = `removeu <strong>"${escapeHTML(log.taskTitle)}"</strong>`;
    else if (log.action === 'add_list') text = `criou a lista <strong>"${escapeHTML(log.listName)}"</strong>`;
    else if (log.action === 'delete_list') text = `excluiu a lista <strong>"${escapeHTML(log.listName)}"</strong>`;
    else if (log.action === 'add_note') text = `deixou recado: <em>"${escapeHTML(log.noteText)}"</em>`;
    else if (log.action === 'delete_note') text = `removeu um recado do mural`;
    else if (log.action === 'add_wish') text = `adicionou desejo: <strong>"${escapeHTML(log.wishTitle)}"</strong>`;
    else if (log.action === 'delete_wish') text = `removeu desejo: <strong>"${escapeHTML(log.wishTitle)}"</strong>`;
    else if (log.action === 'add_project') text = `criou a meta <strong>"${escapeHTML(log.projectName)}"</strong>`;
    else if (log.action === 'delete_project') text = `removeu a meta <strong>"${escapeHTML(log.projectName)}"</strong>`;
    else if (log.action === 'undo_action') text = `desfez uma ação de <em>${ownerDisplayName(log.undoUser)}</em>`;
    else if (log.action === 'nudge') text = `enviou carinho: <strong>"${escapeHTML(log.nudgeText)}"</strong>`;

    const reactions = log.reactions || {};
    const reactionsHtml = emojis.map(emoji => {
      const active = reactions[appState.currentUser] === emoji;
      const count = Object.values(reactions).filter(v => v === emoji).length;
      return `<button type="button" class="btn-history-reaction ${active ? 'active' : ''}" data-log-id="${log.id}" data-emoji="${emoji}">${emoji}${count > 0 ? ` ${count}` : ''}</button>`;
    }).join('');

    const undoable = ['complete_task', 'add_task', 'add_list', 'add_note', 'add_wish'].includes(log.action);
    const undoBtn = undoable ? `<button type="button" class="btn-history-undo" data-log-id="${log.id}">[Desfazer]</button>` : '';

    return `
      <div class="history-item">
        <div class="history-top">
          <div class="history-marker ${markerCls}">${icon}</div>
          <div class="history-text">
            <strong>${ownerDisplayName(log.user)}</strong> ${text}
            <span class="history-time">${time}</span>
            ${undoBtn}
          </div>
        </div>
        <div class="history-reactions-row">${reactionsHtml}</div>
      </div>
    `;
  }).join('');

  const emptyHtml = '<p class="panel-sub" style="text-align:center; padding: 1.5rem 0;">Nenhuma atividade registrada ainda.</p>';

  [el.historyList, el.nosHistoryList].forEach(target => {
    if (!target) return;
    target.innerHTML = historyHtml || emptyHtml;
    target.querySelectorAll('.btn-history-reaction').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        handleHistoryReaction(btn.getAttribute('data-log-id'), btn.getAttribute('data-emoji'));
      });
    });
    target.querySelectorAll('.btn-history-undo').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        handleHistoryUndo(btn.getAttribute('data-log-id'));
      });
    });
  });
}

function handleHistoryReaction(logId, emoji) {
  const data = appState.dbData;
  const log = data.history.find(h => h.id === logId);
  if (!log) return;
  log.reactions = log.reactions || {};
  if (log.reactions[appState.currentUser] === emoji) {
    delete log.reactions[appState.currentUser];
  } else {
    log.reactions[appState.currentUser] = emoji;
    playSound('check');
  }
  saveDataAndRender(data);
}

function handleHistoryUndo(logId) {
  const data = appState.dbData;
  const idx = data.history.findIndex(h => h.id === logId);
  if (idx === -1) return;
  const log = data.history[idx];

  if (log.action === 'complete_task') {
    const t = data.tasks.find(x => x.id === log.taskId);
    if (t) { t.completed = false; t.completedBy = null; t.completedAt = null; }
  } else if (log.action === 'add_task') {
    data.tasks = data.tasks.filter(x => x.id !== log.taskId);
  } else if (log.action === 'add_list') {
    data.lists = data.lists.filter(l => l.id !== log.listId);
    data.tasks = data.tasks.filter(t => t.listId !== log.listId);
  } else if (log.action === 'add_note') {
    data.notes = (data.notes || []).filter(n => n.id !== log.noteId);
  } else if (log.action === 'add_wish') {
    data.wishlist = (data.wishlist || []).filter(w => w.id !== log.wishId);
  }

  data.history.splice(idx, 1);
  db.logAction(data, 'undo_action', { undoAction: log.action, undoUser: log.user });
  playSound('uncheck');
  saveDataAndRender(data);
  showToast('Ação desfeita! ↩️');
}

// ============================================================================
// VIEW 5: WISHLIST (LISTA DE DESEJOS)
// ============================================================================

function renderWishlist() {
  const wishes = appState.dbData.wishlist || [];
  const gusWishes = wishes.filter(w => w.user === 'Gus');
  const isaWishes = wishes.filter(w => w.user === 'Isa');
  const sharedWishes = wishes.filter(w => w.user === 'Shared' || !w.user);

  el.wishCountGus.textContent = gusWishes.length;
  el.wishCountIsa.textContent = isaWishes.length;
  el.wishCountShared.textContent = sharedWishes.length;

  const renderGroup = (grid, list) => {
    if (list.length === 0) {
      grid.innerHTML = '<div class="board-empty-box" style="grid-column: 1 / -1;">Nenhum desejo listado por aqui ainda.</div>';
      return;
    }

    const sorted = [...list].sort((a, b) => Number(!!a.purchased) - Number(!!b.purchased));
    grid.innerHTML = sorted.map(w => `
      <article class="wish-card ${w.purchased ? 'purchased' : ''}">
        <div class="wish-top">
          <h4 class="wish-title">${escapeHTML(w.title)}</h4>
          <button type="button" class="task-mini-btn delete wish-delete-btn" data-wish-id="${w.id}" title="Remover desejo">✕</button>
        </div>
        ${w.price ? `<span class="wish-price-pill">🏷️ ${escapeHTML(w.price)}</span>` : ''}
        ${w.notes ? `<p class="wish-notes">${escapeHTML(w.notes)}</p>` : ''}
        <div class="wish-footer">
          <div style="display:flex; gap:0.35rem; flex-wrap:wrap;">
            ${w.link ? `<a href="${escapeHTML(w.link)}" target="_blank" rel="noopener noreferrer" class="wish-link-btn">🔗 Ver link</a>` : ''}
            <button type="button" class="wish-purchased-btn ${w.purchased ? 'active' : ''}" data-toggle-wish="${w.id}">
              ${w.purchased ? '✅ Realizado!' : 'Marcar realizado'}
            </button>
          </div>
          <span style="font-size:0.68rem; font-weight:700; opacity:0.6;">Por ${ownerDisplayName(w.createdBy)}</span>
        </div>
      </article>
    `).join('');
  };

  renderGroup(el.wishlistGus, gusWishes);
  renderGroup(el.wishlistIsa, isaWishes);
  renderGroup(el.wishlistShared, sharedWishes);

  el.viewWishlist.querySelectorAll('.wish-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => handleDeleteWish(btn.getAttribute('data-wish-id')));
  });
  el.viewWishlist.querySelectorAll('[data-toggle-wish]').forEach(btn => {
    btn.addEventListener('click', () => {
      const wish = (appState.dbData.wishlist || []).find(w => w.id === btn.getAttribute('data-toggle-wish'));
      if (!wish) return;
      wish.purchased = !wish.purchased;
      if (wish.purchased) {
        playSound('celebrate');
        launchConfetti(55);
        showToast(`Desejo "${wish.title}" realizado! 🎁🎉`);
      } else {
        playSound('uncheck');
      }
      saveDataAndRender(appState.dbData);
    });
  });
}

function handleCreateWish() {
  const title = el.inputWishTitle.value.trim();
  if (!title) {
    showToast('Digite o nome do desejo primeiro 🎁');
    return;
  }

  const data = appState.dbData;
  const ownerInput = document.querySelector('input[name="wish_owner"]:checked');
  const newWish = {
    id: 'w-' + Date.now(),
    user: ownerInput ? ownerInput.value : 'Shared',
    title,
    price: el.inputWishPrice.value.trim(),
    link: el.inputWishLink.value.trim(),
    notes: el.inputWishNotes.value.trim(),
    purchased: false,
    createdBy: appState.currentUser,
    timestamp: new Date().toISOString()
  };

  data.wishlist = data.wishlist || [];
  data.wishlist.push(newWish);
  db.logAction(data, 'add_wish', { wishId: newWish.id, wishTitle: newWish.title });

  el.inputWishTitle.value = '';
  el.inputWishPrice.value = '';
  el.inputWishLink.value = '';
  el.inputWishNotes.value = '';
  el.addWishModal.classList.remove('open');
  playSound('add');
  saveDataAndRender(data);
  showToast('Desejo adicionado! 🎁');
}

async function handleDeleteWish(wishId) {
  const data = appState.dbData;
  const wish = (data.wishlist || []).find(w => w.id === wishId);
  if (!wish) return;

  const ok = await confirmAction({
    title: 'Remover desejo?',
    description: `Deseja remover "${wish.title}" da lista de desejos?`,
    confirmLabel: 'Remover',
    danger: true
  });
  if (!ok) return;

  data.wishlist = data.wishlist.filter(w => w.id !== wishId);
  db.logAction(data, 'delete_wish', { wishId, wishTitle: wish.title });
  saveDataAndRender(data);
  showToast('Desejo removido');
}

// ============================================================================
// VIEW 6: CONQUISTAS & ESTATÍSTICAS
// ============================================================================

function renderStats() {
  const data = appState.dbData;
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const completed = data.tasks.filter(t => t.completed);

  const gusTotal = completed.filter(t => t.completedBy === 'Gus' || (!t.completedBy && t.owner === 'Gus')).length;
  const isaTotal = completed.filter(t => t.completedBy === 'Isa' || (!t.completedBy && t.owner === 'Isa')).length;

  const weekly = completed.filter(t => t.completedAt && new Date(t.completedAt) >= oneWeekAgo);
  const gusWeekly = weekly.filter(t => t.completedBy === 'Gus').length;
  const isaWeekly = weekly.filter(t => t.completedBy === 'Isa').length;

  let championText = 'Empate técnico esta semana! ⚖️';
  if (gusWeekly > isaWeekly) championText = `Gustavo lidera a semana com ${gusWeekly} tarefa${gusWeekly === 1 ? '' : 's'}! 🏆`;
  else if (isaWeekly > gusWeekly) championText = `Isabella lidera a semana com ${isaWeekly} tarefa${isaWeekly === 1 ? '' : 's'}! 🏆`;

  const sumTotal = gusTotal + isaTotal;
  const gusShare = sumTotal > 0 ? Math.round((gusTotal / sumTotal) * 100) : 50;
  const isaShare = sumTotal > 0 ? 100 - gusShare : 50;

  // Build 7-day activity data
  const daysData = [];
  let maxDayCount = 1;
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const label = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    const dayCompleted = completed.filter(t => {
      if (!t.completedAt) return false;
      const cd = new Date(t.completedAt);
      return cd.getFullYear() === d.getFullYear() && cd.getMonth() === d.getMonth() && cd.getDate() === d.getDate();
    });
    const g = dayCompleted.filter(t => t.completedBy === 'Gus').length;
    const is = dayCompleted.filter(t => t.completedBy === 'Isa').length;
    if (g + is > maxDayCount) maxDayCount = g + is;
    daysData.push({ label, g, is, total: g + is });
  }

  const chartColsHtml = daysData.map(day => {
    const gPct = Math.round((day.g / maxDayCount) * 100);
    const iPct = Math.round((day.is / maxDayCount) * 100);
    return `
      <div class="chart-col" title="${day.label}: Gustavo ${day.g}, Isabella ${day.is}">
        <div class="chart-stack">
          ${day.is > 0 ? `<div class="chart-bar-seg isa" style="height:${Math.max(14, iPct)}%"></div>` : ''}
          ${day.g > 0 ? `<div class="chart-bar-seg gus" style="height:${Math.max(14, gPct)}%"></div>` : ''}
        </div>
        <span class="chart-day-label">${day.label}</span>
      </div>
    `;
  }).join('');

  el.statsSummaryContainer.innerHTML = `
    <div class="stats-champion-banner">
      <span class="stats-champion-kicker">🏆 Campeão de Produtividade da Semana</span>
      <h2 class="stats-champion-title">${championText}</h2>
    </div>

    <div class="stats-versus-grid">
      <div class="stats-partner-box gus">
        <div class="couple-mini-avatar" style="background:var(--gus-avatar);">${GUS_AVATAR_SVG}</div>
        <div>
          <div class="couple-mini-name" style="color:var(--gus-ink);">GUSTAVO</div>
          <div class="stats-big-num">${gusTotal}</div>
          <div class="stats-partner-meta">Total · ${gusWeekly} esta semana</div>
        </div>
      </div>

      <div class="stats-partner-box isa">
        <div class="couple-mini-avatar" style="background:var(--isa-avatar);">${ISA_AVATAR_SVG}</div>
        <div>
          <div class="couple-mini-name" style="color:var(--isa-ink);">ISABELLA</div>
          <div class="stats-big-num">${isaTotal}</div>
          <div class="stats-partner-meta">Total · ${isaWeekly} esta semana</div>
        </div>
      </div>
    </div>

    <div class="tug-bar-wrap">
      <div class="tug-bar-labels">
        <span>Gustavo (${gusShare}%)</span>
        <span>Equilíbrio do Casal</span>
        <span>Isabella (${isaShare}%)</span>
      </div>
      <div class="tug-bar-track">
        <div class="tug-gus" style="width:${gusShare}%"></div>
        <div class="tug-isa" style="width:${isaShare}%"></div>
      </div>
    </div>

    <div class="chart-7d-box">
      <div class="chart-7d-title">📊 Atividade dos Últimos 7 Dias</div>
      <div class="chart-7d-bars">${chartColsHtml}</div>
    </div>
  `;

  // Compute Achievements (7 original + 3 couple bonuses)
  const notesCount = (data.notes || []).length;
  const projectsCount = (data.projects || []).length;
  const listsCount = data.lists.length;
  const wishesFulfilled = (data.wishlist || []).filter(w => w.purchased).length;
  const subtasksCompleted = data.tasks.some(t => t.completed && (t.subtasks || []).length > 0 && t.subtasks.every(s => s.completed));
  const allTasksDoneNow = data.tasks.length > 0 && data.tasks.every(t => t.completed);

  let reactionsReceived = 0;
  (data.history || []).forEach(log => {
    if (log.user === appState.currentUser && log.reactions) {
      reactionsReceived += Object.keys(log.reactions).length;
    }
  });

  const userCompletions = completed.filter(t => t.completedBy === appState.currentUser).length;

  const achievements = [
    { title: 'Primeiros Passos', desc: 'Concluiu sua primeira tarefa', icon: '🌱', current: userCompletions, target: 1 },
    { title: 'Parceria Forte', desc: 'Concluiu 10 tarefas no app', icon: '🤝', current: userCompletions, target: 10 },
    { title: 'Super Produtivo', desc: 'Concluiu 30 tarefas no app', icon: '⚡', current: userCompletions, target: 30 },
    { title: 'Mestre da Organização', desc: 'Criou pelo menos 3 listas diferentes', icon: '🗂️', current: listsCount, target: 3 },
    { title: 'Mensageiro do Amor', desc: 'Deixou 2 recados no mural', icon: '💖', current: notesCount, target: 2 },
    { title: 'Sonhador do Casal', desc: 'Criou pelo menos 2 grandes metas', icon: '✈️', current: projectsCount, target: 2 },
    { title: 'Amor em Gestos', desc: 'Recebeu 3 reações do seu par', icon: '💝', current: reactionsReceived, target: 3 },
    { title: 'Equipe Imbatível', desc: 'Zerar 100% das tarefas cadastradas', icon: '🏆', current: allTasksDoneNow ? 1 : 0, target: 1 },
    { title: 'Detalhista', desc: 'Concluiu tarefa com checklist 100%', icon: '☑️', current: subtasksCompleted ? 1 : 0, target: 1 },
    { title: 'Sonho Realizado', desc: 'Realizou 1 item da Lista de Desejos', icon: '🎁', current: wishesFulfilled, target: 1 }
  ];

  const unlockedCount = achievements.filter(a => a.current >= a.target).length;
  el.achievementsProgressBadge.textContent = `${unlockedCount} / ${achievements.length} desbloqueadas`;

  el.achievementsGrid.innerHTML = achievements.map(ach => {
    const unlocked = ach.current >= ach.target;
    const pct = Math.min(100, Math.round((ach.current / ach.target) * 100));
    return `
      <div class="achievement-card ${unlocked ? 'unlocked' : 'locked'}">
        <div class="achievement-icon">${ach.icon}</div>
        <div class="achievement-info">
          <div class="achievement-title">${escapeHTML(ach.title)}</div>
          <div class="achievement-desc">${escapeHTML(ach.desc)}</div>
          <div class="achievement-bar-track">
            <div class="achievement-bar-fill" style="width:${pct}%"></div>
          </div>
          <span class="achievement-status">
            ${unlocked ? '🔓 Desbloqueada!' : `🔒 ${Math.min(ach.current, ach.target)} / ${ach.target}`}
          </span>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================================
// LIST MANAGEMENT, INVITES, PROFILE SWITCH & BACKUP
// ============================================================================

function populateGroupSelect() {
  const data = appState.dbData;
  if (!data) return;
  let html = data.groups.map(g => `<option value="${g.id}">${escapeHTML(g.name)}</option>`).join('');
  html += `<option value="" disabled>──────────</option><option value="NEW_GROUP">➕ Criar Novo Grupo...</option>`;
  el.selectListGroup.innerHTML = html;
  el.newGroupNameGroup.style.display = 'none';
}

function handleCreateList() {
  const listName = el.inputListName.value.trim();
  if (!listName) {
    showToast('Digite o nome da nova lista 📁');
    return;
  }

  const data = appState.dbData;
  let groupId = el.selectListGroup.value;

  if (groupId === 'NEW_GROUP') {
    const newGroupName = el.inputNewGroupName.value.trim();
    if (!newGroupName) {
      showToast('Digite o nome do novo grupo ✍️');
      return;
    }
    const newGroup = { id: 'g-' + Date.now(), name: newGroupName, createdAt: new Date().toISOString() };
    data.groups.push(newGroup);
    groupId = newGroup.id;
  }

  const ownerChecked = document.querySelector('input[name="list_owner"]:checked');
  const newList = {
    id: 'l-' + Date.now(),
    name: listName,
    groupId,
    owner: ownerChecked ? ownerChecked.value : 'Shared',
    createdAt: new Date().toISOString()
  };

  data.lists.push(newList);
  db.logAction(data, 'add_list', { listId: newList.id, listName: newList.name });

  el.addListModal.classList.remove('open');
  appState.activeTab = 'tasks';
  appState.activeListId = newList.id;
  appState.activeFilter = 'list';

  playSound('add');
  saveDataAndRender(data);
  showToast(`Lista "${newList.name}" criada! 📁`);
}

async function handleDeleteList(listId) {
  const data = appState.dbData;
  const list = data.lists.find(l => l.id === listId);
  if (!list) return;

  const ok = await confirmAction({
    title: `Excluir "${list.name}"?`,
    description: 'Excluir esta lista removerá também todas as tarefas dentro dela.',
    confirmLabel: 'Excluir Lista',
    danger: true
  });
  if (!ok) return;

  db.logAction(data, 'delete_list', { listId: list.id, listName: list.name });
  data.lists = data.lists.filter(l => l.id !== listId);
  data.tasks = data.tasks.filter(t => t.listId !== listId);

  if (appState.activeListId === listId) {
    appState.activeListId = 'all';
    appState.activeFilter = 'all';
  }

  saveDataAndRender(data);
  showToast(`Lista "${list.name}" excluída`);
}

function switchUserProfile(user) {
  appState.currentUser = user;
  db.setCurrentUser(user);
  const config = db.getSavedConfig();
  if (config) {
    db.saveConfig(config.firebaseConfig, config.secretKey, user);
  }
  playSound('check');
  updateSettingsModalUI();
  renderApp();
  showToast(`Perfil ativo: ${ownerDisplayName(user)}! 👋`);
}

function generateInviteLink() {
  const config = db.getSavedConfig();
  if (!config) return null;
  const payload = { firebaseConfig: config.firebaseConfig, secretKey: config.secretKey };
  const base64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  return window.location.origin + window.location.pathname + '?config=' + base64;
}

function handleIncomingInvite() {
  const params = new URLSearchParams(window.location.search);
  const configParam = params.get('config');
  if (!configParam) return;

  try {
    const decoded = JSON.parse(decodeURIComponent(escape(atob(configParam))));
    if (decoded.firebaseConfig && decoded.secretKey) {
      db.saveConfig(decoded.firebaseConfig, decoded.secretKey, 'Isa');
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      showToast('Convite conectado com sucesso! Bem-vinda, Isabella! 💛');
    }
  } catch (e) {
    console.error('Erro ao processar convite:', e);
    showToast('Link de convite inválido.', 'error');
  }
}

function updateSettingsModalUI() {
  const isGus = appState.currentUser === 'Gus';
  el.btnSwitchToGus.classList.toggle('active', isGus);
  el.btnSwitchToIsa.classList.toggle('active', !isGus);
  updateSoundUI();

  // Notification status hint
  const nStatus = notifications.getNotificationStatus();
  if (el.notificationStatusHint) {
    if (!nStatus.supported) el.notificationStatusHint.textContent = nStatus.reason;
    else if (nStatus.state === 'granted') el.notificationStatusHint.textContent = '✅ Notificações ativadas neste dispositivo.';
    else if (nStatus.state === 'denied') el.notificationStatusHint.textContent = '⚠️ Permissão negada nas configurações do navegador.';
    else el.notificationStatusHint.textContent = 'Receba avisos quando seu par concluir tarefas ou enviar reações.';
  }

  // Integrações
  const settings = appState.settings || {};
  if (el.weatherCityCurrent) {
    el.weatherCityCurrent.textContent = settings.weather
      ? `📍 Cidade atual: ${settings.weather.label || settings.weather.name}`
      : 'Nenhuma cidade definida.';
  }
  if (el.calendarSyncStatus) {
    const cal = appState.calendar || {};
    if (appState.calendarError) {
      el.calendarSyncStatus.textContent = '⚠️ Sem permissão no Firebase para ler calendar/. Atualize as Regras do Realtime Database (veja INTEGRACOES.md).';
    } else if (cal.updatedAt) {
      el.calendarSyncStatus.textContent = `✅ ${cal.events.length} compromissos sincronizados ${agenda.relativeSyncLabel(cal.updatedAt)}.`;
    } else {
      const cfgNow = db.getSavedConfig();
      const keyHint = cfgNow ? ` (chave ativa: "${cfgNow.secretKey}")` : '';
      el.calendarSyncStatus.textContent = `⏳ Aguardando o sincronizador (Google Apps Script) gravar os eventos${keyHint}.`;
    }
  }
  if (el.pushStatusHint) {
    const support = push.pushSupportStatus();
    if (!support.ok) el.pushStatusHint.textContent = support.reason;
    else if (!push.isPushConfigured(settings)) el.pushStatusHint.textContent = 'Preencha a configuração do Cloud Messaging abaixo (uma vez só).';
    else if (push.isPushEnabledHere(appState.currentUser)) el.pushStatusHint.textContent = `✅ Push ativo neste aparelho para ${ownerDisplayName(appState.currentUser)}.`;
    else el.pushStatusHint.textContent = 'Receba avisos mesmo com o app fechado (carinhos, tarefas, resumo matinal).';
    const p = settings.push || {};
    if (el.setupPushSenderId && document.activeElement !== el.setupPushSenderId) el.setupPushSenderId.value = p.messagingSenderId || '';
    if (el.setupPushAppId && document.activeElement !== el.setupPushAppId) el.setupPushAppId.value = p.appId || '';
    if (el.setupPushVapid && document.activeElement !== el.setupPushVapid) el.setupPushVapid.value = p.vapidKey || '';
  }

  const config = db.getSavedConfig();
  if (config) {
    el.settingsConnectedDb.textContent = `${config.firebaseConfig.databaseURL} · chave: ${config.secretKey}`;
    el.btnConnectFirebaseFromLocal.style.display = 'none';
    el.settingsInviteBlock.style.display = 'flex';
    el.btnResetApp.textContent = 'Desconectar Banco';

    const inviteUrl = generateInviteLink();
    if (inviteUrl) {
      el.inviteQrCode.src = 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' + encodeURIComponent(inviteUrl);
      el.inviteQrCode.style.display = 'block';
      el.inviteQrCodeText.style.display = 'block';
    }
  } else {
    el.settingsConnectedDb.textContent = 'Modo Local (salvo apenas neste navegador)';
    el.btnConnectFirebaseFromLocal.style.display = 'inline-flex';
    el.settingsInviteBlock.style.display = 'none';
    el.btnResetApp.textContent = 'Voltar à Tela Inicial';
  }
}

function renderQuickAddEmojiTray() {
  if (!el.quickAddEmojiTray) return;
  el.quickAddEmojiTray.innerHTML = ALL_EMOJIS.map(em => `
    <button type="button" class="emoji-opt ${appState.selectedQuickAddEmoji === em ? 'selected' : ''}" data-qa-emoji="${em}">${em}</button>
  `).join('');

  el.quickAddEmojiTray.querySelectorAll('[data-qa-emoji]').forEach(btn => {
    btn.addEventListener('click', () => {
      appState.selectedQuickAddEmoji = btn.getAttribute('data-qa-emoji');
      el.btnQuickEmojiToggle.textContent = appState.selectedQuickAddEmoji;
      el.quickAddEmojiTray.style.display = 'none';
      renderQuickAddEmojiTray();
    });
  });
}

// ============================================================================
// GLOBAL EVENT LISTENERS
// ============================================================================

function setupEventListeners() {
  // Mobile Sidebar Open/Close
  el.btnToggleMenu.addEventListener('click', () => {
    el.sidebar.classList.add('open');
    el.sidebarOverlay.classList.add('open');
  });
  el.btnCloseSidebarMobile.addEventListener('click', closeMobileSidebar);
  el.sidebarOverlay.addEventListener('click', closeMobileSidebar);

  // Back button on mobile list view
  el.btnHeaderBack.addEventListener('click', () => {
    appState.activeTab = 'dashboard';
    renderApp();
  });

  // Sidebar Navigation Tabs
  document.querySelectorAll('.sidebar .nav-item[data-nav-tab]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const tab = link.getAttribute('data-nav-tab');
      appState.activeTab = tab;
      if (tab === 'tasks') {
        appState.activeFilter = 'all';
        appState.activeListId = 'all';
      }
      closeMobileSidebar();
      renderApp();
    });
  });

  // Mobile Bottom Nav
  if (el.mobileBottomNav) {
    el.mobileBottomNav.querySelectorAll('.bottom-nav-item[data-tab]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        const tab = btn.getAttribute('data-tab');
        appState.activeTab = tab;
        if (tab === 'tasks') {
          appState.activeFilter = 'all';
          appState.activeListId = 'all';
        }
        closeMobileSidebar();
        renderApp();
      });
    });

    el.bottomNavBtnMore.addEventListener('click', e => {
      e.preventDefault();
      el.sidebar.classList.add('open');
      el.sidebarOverlay.classList.add('open');
    });
  }

  // Quick Profile Switch from Sidebar Footer
  el.currentUserBadge.addEventListener('click', () => {
    switchUserProfile(appState.currentUser === 'Gus' ? 'Isa' : 'Gus');
  });

  // Top Utility Buttons: Sound, Theme, Copy WhatsApp Summary, History Drawer
  el.btnToggleSound.addEventListener('click', () => {
    const next = !isSoundEnabled();
    setSoundEnabled(next);
    updateSoundUI();
    if (next) playSound('check');
    showToast(next ? 'Efeitos sonoros ativados 🔊' : 'Som silenciado 🔇');
  });

  el.btnToggleTheme.addEventListener('click', () => {
    const isCurrentlyLight = document.documentElement.getAttribute('data-theme') === 'light';
    applyTheme(isCurrentlyLight ? 'dark' : 'light', true);
    showToast(isCurrentlyLight ? 'Modo Quadro Escuro 🌙' : 'Modo Papel Claro ☀️');
  });

  el.btnCopySummary.addEventListener('click', () => {
    if (!appState.dbData) return;
    const { tasks, title } = appState.activeTab === 'tasks'
      ? getBaseScopeTasks()
      : { tasks: appState.dbData.tasks, title: 'LISTA DE TAREFAS' };
    const summary = ifttt.buildWhatsAppSummary(tasks, title.toUpperCase());
    copyTextSafe(summary)
      .then(() => {
        playSound('check');
        showToast('Resumo copiado! Pronto para colar no WhatsApp 📋');
      })
      .catch(() => showToast('Não foi possível copiar automaticamente', 'error'));
  });

  // Activity Drawer
  el.btnToggleHistory.addEventListener('click', () => {
    el.activityDrawer.classList.add('open');
    el.drawerOverlay.classList.add('open');
  });
  const closeDrawer = () => {
    el.activityDrawer.classList.remove('open');
    el.drawerOverlay.classList.remove('open');
  };
  el.btnCloseHistory.addEventListener('click', closeDrawer);
  el.drawerOverlay.addEventListener('click', closeDrawer);

  // Dashboard Shortcuts
  el.dashboardMuralPreview.addEventListener('click', () => {
    appState.activeTab = 'notes';
    renderApp();
  });
  el.btnViewAllUrgent.addEventListener('click', () => {
    appState.activeTab = 'tasks';
    appState.activeFilter = 'all';
    appState.activeListId = 'all';
    appState.quickFilter = 'urgent';
    renderApp();
  });

  // Tasks Toolbar: Search, Sort, View Mode, Person Filter, Status Filter, Quick Filters
  el.inputSearchTasks.addEventListener('input', () => {
    appState.searchQuery = el.inputSearchTasks.value;
    renderTasks();
  });
  el.btnClearSearch.addEventListener('click', () => {
    appState.searchQuery = '';
    el.inputSearchTasks.value = '';
    renderTasks();
    el.inputSearchTasks.focus();
  });
  el.selectSortTasks.addEventListener('change', () => {
    appState.sortBy = el.selectSortTasks.value;
    renderTasks();
  });

  [el.btnViewModeBoard, el.btnViewModeList].forEach(btn => {
    btn.addEventListener('click', () => {
      appState.tasksViewMode = btn.getAttribute('data-view-mode');
      localStorage.setItem('tasklist_view_mode', appState.tasksViewMode);
      renderTasks();
    });
  });

  document.querySelectorAll('.owner-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      appState.ownerFilter = btn.getAttribute('data-owner-filter');
      renderTasks();
    });
  });

  document.querySelectorAll('.status-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      appState.statusFilter = btn.getAttribute('data-status-filter');
      renderTasks();
    });
  });

  el.btnFilterMyTasks.addEventListener('click', () => {
    appState.quickFilter = appState.quickFilter === 'mine' ? 'none' : 'mine';
    renderTasks();
  });
  el.btnFilterUrgentTasks.addEventListener('click', () => {
    appState.quickFilter = appState.quickFilter === 'urgent' ? 'none' : 'urgent';
    renderTasks();
  });
  el.btnClearQuickFilters.addEventListener('click', () => {
    appState.quickFilter = 'none';
    appState.ownerFilter = 'all';
    appState.statusFilter = 'all';
    appState.searchQuery = '';
    el.inputSearchTasks.value = '';
    if (appState.activeFilter === 'date') {
      appState.activeFilter = 'all';
      appState.activeListId = 'all';
    }
    renderTasks();
  });
  el.btnClearDateFilter.addEventListener('click', () => {
    appState.activeFilter = 'all';
    appState.activeListId = 'all';
    renderTasks();
  });

  // Unified List Quick Add Form + Emoji Toggle + Quick Date Chips
  el.btnQuickEmojiToggle.addEventListener('click', () => {
    const visible = el.quickAddEmojiTray.style.display === 'flex';
    el.quickAddEmojiTray.style.display = visible ? 'none' : 'flex';
  });

  document.querySelectorAll('[data-quick-date]').forEach(chip => {
    chip.addEventListener('click', () => {
      const mode = chip.getAttribute('data-quick-date');
      const d = new Date();
      if (mode === 'tomorrow') d.setDate(d.getDate() + 1);
      d.setHours(18, 0, 0, 0);
      el.inputTaskDeadline.value = toLocalDatetimeInputValue(d.toISOString());
    });
  });

  el.addTaskForm.addEventListener('submit', e => {
    e.preventDefault();
    const title = el.inputTaskTitle.value.trim();
    if (!title) return;
    const deadline = el.inputTaskDeadline.value ? new Date(el.inputTaskDeadline.value).toISOString() : null;
    createTask({
      title,
      owner: el.selectTaskOwner.value,
      priority: el.selectTaskPriority.value,
      recurrence: el.selectTaskRecurrence.value,
      deadline,
      emoji: appState.selectedQuickAddEmoji,
      svgKey: appState.selectedQuickAddEmoji === '✨' ? detectSvgKeyFromTitle(title) : null
    });
    el.inputTaskTitle.value = '';
    el.inputTaskDeadline.value = '';
    el.selectTaskRecurrence.value = 'none';
  });

  // Mobile Sticky Bottom Add Form
  el.stickyAddTaskForm.addEventListener('submit', e => {
    e.preventDefault();
    const title = el.inputStickyTaskTitle.value.trim();
    if (!title) return;
    createTask({ title, owner: appState.ownerFilter !== 'all' ? appState.ownerFilter : 'Shared' });
    el.inputStickyTaskTitle.value = '';
  });

  // Tasks Footer Bulk Actions
  el.btnUncheckAll.addEventListener('click', async () => {
    const { tasks } = getBaseScopeTasks();
    const completed = tasks.filter(t => t.completed);
    if (completed.length === 0) {
      showToast('Nenhuma tarefa concluída para desmarcar');
      return;
    }
    const ok = await confirmAction({
      title: 'Desmarcar tarefas concluídas?',
      description: `As ${completed.length} caixinhas marcadas voltarão a ficar pendentes, mantendo todas as tarefas cadastradas.`,
      confirmLabel: 'Desmarcar Tudo'
    });
    if (!ok) return;

    completed.forEach(t => { t.completed = false; t.completedBy = null; t.completedAt = null; });
    playSound('uncheck');
    saveDataAndRender(appState.dbData);
    showToast('Todas as caixinhas foram desmarcadas!');
  });

  el.btnClearCompleted.addEventListener('click', async () => {
    const { tasks } = getBaseScopeTasks();
    const completedIds = new Set(tasks.filter(t => t.completed).map(t => t.id));
    if (completedIds.size === 0) {
      showToast('Nenhuma tarefa concluída para limpar');
      return;
    }
    const ok = await confirmAction({
      title: 'Limpar tarefas concluídas?',
      description: `Isso removerá permanentemente ${completedIds.size} tarefa(s) já concluída(s) desta visualização.`,
      confirmLabel: 'Limpar Concluídas',
      danger: true
    });
    if (!ok) return;

    appState.dbData.tasks = appState.dbData.tasks.filter(t => !completedIds.has(t.id));
    saveDataAndRender(appState.dbData);
    showToast(`${completedIds.size} tarefa(s) concluída(s) removida(s) 🧹`);
  });

  el.btnRestoreDefaults.addEventListener('click', async () => {
    const ok = await confirmAction({
      title: 'Restaurar lista de exemplo?',
      description: 'No Modo Local, isso restaurará as tarefas, mural e metas de exemplo de Gustavo & Isabella.',
      confirmLabel: 'Restaurar'
    });
    if (!ok) return;
    db.resetLocalDataToStarter();
    playSound('celebrate');
    showToast('Lista de exemplo restaurada! ✨');
  });

  // Calendar Navigation & Day Panel
  el.btnPrevMonth.addEventListener('click', () => {
    appState.currentMonth.setMonth(appState.currentMonth.getMonth() - 1);
    renderCalendar();
  });
  el.btnNextMonth.addEventListener('click', () => {
    appState.currentMonth.setMonth(appState.currentMonth.getMonth() + 1);
    renderCalendar();
  });
  el.btnCalendarToday.addEventListener('click', () => {
    appState.currentMonth = new Date();
    appState.selectedCalendarDay = new Date();
    renderCalendar();
  });
  el.btnOpenDayInTasks.addEventListener('click', () => {
    if (!appState.selectedCalendarDay) return;
    appState.activeTab = 'tasks';
    appState.activeFilter = 'date';
    appState.selectedDate = new Date(appState.selectedCalendarDay);
    renderApp();
  });
  el.calendarDayAddForm.addEventListener('submit', e => {
    e.preventDefault();
    const title = el.inputCalendarDayTask.value.trim();
    if (!title || !appState.selectedCalendarDay) return;
    const d = new Date(appState.selectedCalendarDay);
    d.setHours(18, 0, 0, 0);
    createTask({ title, owner: el.selectCalendarDayOwner.value, deadline: d.toISOString() });
    el.inputCalendarDayTask.value = '';
  });

  // Add List Modal
  const openAddList = () => {
    populateGroupSelect();
    el.inputListName.value = '';
    el.inputNewGroupName.value = '';
    el.addListModal.classList.add('open');
    setTimeout(() => el.inputListName.focus(), 40);
  };
  el.btnOpenAddListModal.addEventListener('click', openAddList);
  el.btnDashboardOpenAddList.addEventListener('click', openAddList);
  const closeAddList = () => el.addListModal.classList.remove('open');
  el.btnCloseAddListModal.addEventListener('click', closeAddList);
  el.btnCancelAddList.addEventListener('click', closeAddList);
  el.selectListGroup.addEventListener('change', () => {
    el.newGroupNameGroup.style.display = el.selectListGroup.value === 'NEW_GROUP' ? 'flex' : 'none';
  });
  el.btnSaveList.addEventListener('click', handleCreateList);

  // Add Project Modal
  el.btnOpenAddProjectModal.addEventListener('click', () => {
    el.inputProjectName.value = '';
    el.inputProjectTargetDate.value = '';
    el.addProjectModal.classList.add('open');
    setTimeout(() => el.inputProjectName.focus(), 40);
  });
  const closeAddProject = () => el.addProjectModal.classList.remove('open');
  el.btnCloseAddProjectModal.addEventListener('click', closeAddProject);
  el.btnCancelAddProject.addEventListener('click', closeAddProject);
  el.btnSaveProject.addEventListener('click', handleCreateProject);

  // Add Note Modal
  el.btnOpenAddNoteModal.addEventListener('click', () => {
    el.inputNoteText.value = '';
    el.addNoteModal.classList.add('open');
    setTimeout(() => el.inputNoteText.focus(), 40);
  });
  const closeAddNote = () => el.addNoteModal.classList.remove('open');
  el.btnCloseAddNoteModal.addEventListener('click', closeAddNote);
  el.btnCancelAddNote.addEventListener('click', closeAddNote);
  el.btnSaveNote.addEventListener('click', handleCreateNote);

  // Add Wish Modal
  el.btnOpenAddWishModal.addEventListener('click', () => {
    el.inputWishTitle.value = '';
    el.inputWishPrice.value = '';
    el.inputWishLink.value = '';
    el.inputWishNotes.value = '';
    el.addWishModal.classList.add('open');
    setTimeout(() => el.inputWishTitle.focus(), 40);
  });
  const closeAddWish = () => el.addWishModal.classList.remove('open');
  el.btnCloseAddWishModal.addEventListener('click', closeAddWish);
  el.btnCancelAddWish.addEventListener('click', closeAddWish);
  el.btnSaveWish.addEventListener('click', handleCreateWish);

  // Settings Modal
  el.btnOpenSettings.addEventListener('click', () => {
    closeMobileSidebar();
    updateSettingsModalUI();
    const iftttCfg = ifttt.getIftttConfig();
    el.setupIftttKey.value = iftttCfg.key;
    el.setupIftttEvent.value = iftttCfg.event;
    el.settingsModal.classList.add('open');
  });

  const saveAndCloseSettings = () => {
    ifttt.saveIftttConfig(el.setupIftttKey.value.trim(), el.setupIftttEvent.value.trim());
    el.settingsModal.classList.remove('open');
  };
  el.btnCloseSettingsModal.addEventListener('click', saveAndCloseSettings);
  el.btnConfirmCloseSettings.addEventListener('click', saveAndCloseSettings);

  el.btnSwitchToGus.addEventListener('click', () => switchUserProfile('Gus'));
  el.btnSwitchToIsa.addEventListener('click', () => switchUserProfile('Isa'));
  el.btnSetThemeDark.addEventListener('click', () => applyTheme('dark', true));
  el.btnSetThemeLight.addEventListener('click', () => applyTheme('light', true));
  el.btnSetThemeAuto.addEventListener('click', () => applyTheme('auto', true));
  el.btnSettingsToggleSound.addEventListener('click', () => {
    const next = !isSoundEnabled();
    setSoundEnabled(next);
    updateSoundUI();
    if (next) playSound('check');
  });

  el.btnEnableNotifications.addEventListener('click', () => {
    notifications.requestPermission().then(res => {
      updateSettingsModalUI();
      if (res === 'granted') {
        notifications.showNotification('Notificações Ativadas! 🔔', 'Vocês receberão alertas em tempo real.');
        showToast('Notificações ativadas com sucesso! 🔔');
      } else if (res === 'insecure') {
        showToast('Notificações requerem HTTPS (GitHub Pages).', 'error');
      } else if (res === 'unsupported') {
        showToast('Navegador sem suporte (no iOS, adicione à Tela de Início).', 'error');
      } else {
        showToast('Notificações bloqueadas nas configurações do navegador.', 'error');
      }
    });
  });

  el.btnCopyInviteLink.addEventListener('click', () => {
    const url = generateInviteLink();
    if (!url) {
      showToast('Conecte o Firebase primeiro para gerar um link de convite.');
      return;
    }
    copyTextSafe(url)
      .then(() => showToast('Link de convite copiado! Envie para o seu par 💛'))
      .catch(() => showToast('Erro ao copiar link', 'error'));
  });

  el.btnTestIfttt.addEventListener('click', () => {
    ifttt.saveIftttConfig(el.setupIftttKey.value.trim(), el.setupIftttEvent.value.trim());
    ifttt.fireTestWebhook(appState.dbData, appState.currentUser)
      .then(() => showToast('Webhook IFTTT disparado com sucesso! ☀️'))
      .catch(err => showToast('Erro no IFTTT: ' + err, 'error'));
  });

  // ---- Integrações: Painel, Clima, Push, Agenda ----
  el.btnCopyPainelLink.addEventListener('click', () => {
    if (!db.getSavedConfig()) {
      showToast('Conecte o Firebase primeiro: o painel da Echo precisa do banco em tempo real.', 'error');
      return;
    }
    copyTextSafe(generatePainelLink())
      .then(() => showToast('Link do Painel copiado! Cole na skill da Alexa 📺'))
      .catch(() => showToast('Erro ao copiar link', 'error'));
  });

  el.btnDashboardOpenCalendar.addEventListener('click', () => {
    appState.activeTab = 'calendar';
    appState.selectedCalendarDay = new Date();
    appState.currentMonth = new Date();
    renderApp();
  });

  let weatherSearchInFlight = false;
  const runWeatherCitySearch = () => {
    if (weatherSearchInFlight) return;
    const q = el.inputWeatherCity.value.trim();
    if (q.length < 2) {
      el.weatherCityResults.innerHTML = '<span class="settings-hint">Digite pelo menos 2 letras da cidade (ex: Curitiba).</span>';
      el.inputWeatherCity.focus();
      return;
    }
    weatherSearchInFlight = true;
    if (el.btnSearchWeatherCity) {
      el.btnSearchWeatherCity.disabled = true;
      el.btnSearchWeatherCity.textContent = 'Buscando...';
    }
    el.weatherCityResults.innerHTML = '<span class="settings-hint">Buscando cidades...</span>';
    weather.searchCity(q)
      .then(results => {
        if (results.length === 0) {
          el.weatherCityResults.innerHTML = '<span class="settings-hint">Nenhuma cidade encontrada. Tente digitar só o nome da cidade (ex: Curitiba).</span>';
          return;
        }
        el.weatherCityResults.innerHTML = results.map((r, i) =>
          `<button type="button" class="city-result-btn" data-city-idx="${i}">📍 ${escapeHTML(r.label)}</button>`).join('');
        el.weatherCityResults.querySelectorAll('[data-city-idx]').forEach(btn => {
          btn.addEventListener('click', () => {
            const r = results[Number(btn.getAttribute('data-city-idx'))];
            btn.disabled = true;
            db.updateSettings('weather', r)
              .then(() => {
                appState.settings = { ...(appState.settings || {}), weather: r };
                refreshWeather(true);
                updateSettingsModalUI();
                el.weatherCityResults.innerHTML = '';
                el.inputWeatherCity.value = '';
                showToast(`Clima configurado para ${r.name}! 🌦️`);
              })
              .catch(err => {
                btn.disabled = false;
                console.error('Erro ao salvar cidade:', err);
                el.weatherCityResults.innerHTML = '<span class="settings-hint">⚠️ Permissão negada no Firebase para salvar <code>settings/</code>. Publique as regras da seção 1 de INTEGRACOES.md.</span>';
                showToast('Erro ao salvar cidade. Atualize as regras do Firebase (settings).', 'error');
              });
          });
        });
      })
      .catch(err => {
        console.error('Erro ao buscar cidade:', err);
        el.weatherCityResults.innerHTML = `<span class="settings-hint">Erro ao buscar cidade (${escapeHTML(err && err.message ? err.message : 'sem conexão')}). Tente novamente.</span>`;
      })
      .finally(() => {
        weatherSearchInFlight = false;
        if (el.btnSearchWeatherCity) {
          el.btnSearchWeatherCity.disabled = false;
          el.btnSearchWeatherCity.textContent = 'Buscar';
        }
      });
  };

  if (el.weatherCityForm) {
    el.weatherCityForm.addEventListener('submit', e => {
      e.preventDefault();
      runWeatherCitySearch();
    });
  }
  if (el.btnSearchWeatherCity) {
    el.btnSearchWeatherCity.addEventListener('click', e => {
      e.preventDefault();
      runWeatherCitySearch();
    });
  }

  el.btnSavePushConfig.addEventListener('click', () => {
    const value = {
      messagingSenderId: el.setupPushSenderId.value.trim(),
      appId: el.setupPushAppId.value.trim(),
      vapidKey: el.setupPushVapid.value.trim()
    };
    if (!value.messagingSenderId || !value.appId || !value.vapidKey) {
      showToast('Preencha os três campos do Cloud Messaging.', 'error');
      return;
    }
    db.updateSettings('push', value)
      .then(() => showToast('Configuração de push salva para os dois aparelhos! 📲'))
      .catch(() => showToast('Erro ao salvar. Atualize as regras do Firebase (settings).', 'error'));
  });

  el.btnEnablePush.addEventListener('click', () => {
    el.btnEnablePush.disabled = true;
    push.enablePush(appState.settings, appState.currentUser)
      .then(() => {
        updateSettingsModalUI();
        showToast('Push ativado! Você será avisado mesmo com o app fechado 📲');
      })
      .catch(err => showToast(err.message || String(err), 'error'))
      .finally(() => { el.btnEnablePush.disabled = false; });
  });

  // JSON Backup Export & Import
  el.btnExportBackup.addEventListener('click', () => {
    if (!appState.dbData) return;
    const blob = new Blob([JSON.stringify(appState.dbData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tasklist-gus-isa-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup JSON baixado! 💾');
  });

  el.btnImportBackup.addEventListener('click', () => el.inputImportBackupFile.click());
  el.inputImportBackupFile.addEventListener('change', async () => {
    const file = el.inputImportBackupFile.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = db.normalizeData(JSON.parse(text));
      const ok = await confirmAction({
        title: 'Importar backup JSON?',
        description: `Substituir os dados atuais por este backup (${parsed.tasks.length} tarefas, ${parsed.lists.length} listas)?`,
        confirmLabel: 'Importar Backup'
      });
      if (ok) {
        appState.dbData = parsed;
        saveDataAndRender(parsed);
        showToast('Backup importado com sucesso! 🎉');
      }
    } catch (err) {
      showToast('Arquivo JSON inválido.', 'error');
    } finally {
      el.inputImportBackupFile.value = '';
    }
  });

  el.btnConnectFirebaseFromLocal.addEventListener('click', () => {
    el.settingsModal.classList.remove('open');
    showSetupScreen();
  });

  el.btnResetApp.addEventListener('click', async () => {
    const ok = await confirmAction({
      title: 'Desconectar dispositivo?',
      description: 'Você voltará para a tela inicial de configuração. Seus dados no Firebase permanecem intactos.',
      confirmLabel: 'Desconectar',
      danger: true
    });
    if (!ok) return;
    db.clearConfig();
    el.settingsModal.classList.remove('open');
    showSetupScreen();
  });

  // Setup Overlay Controls
  el.btnStartLocalMode.addEventListener('click', () => {
    const userRadio = document.querySelector('input[name="setup_user"]:checked');
    const user = userRadio ? userRadio.value : 'Gus';
    db.enableLocalMode(user);
    playSound('celebrate');
    checkConfiguration();
    showToast(`Bem-vindo(a), ${ownerDisplayName(user)}! Modo Local ativado ✨`);
  });

  el.btnCopyFirebaseRules.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    copyTextSafe(el.firebaseRulesSnippet.textContent)
      .then(() => showToast('Regras JSON copiadas! 📋'))
      .catch(() => showToast('Erro ao copiar regras', 'error'));
  });

  el.setupForm.addEventListener('submit', e => {
    e.preventDefault();
    const user = document.querySelector('input[name="setup_user"]:checked').value;
    const secret = el.setupSecretKey.value.trim().toLowerCase();
    const projectId = el.setupProjectId.value.trim();

    const firebaseConfig = {
      apiKey: el.setupApiKey.value.trim(),
      databaseURL: el.setupDbUrl.value.trim(),
      projectId,
      authDomain: `${projectId}.firebaseapp.com`,
      storageBucket: `${projectId}.appspot.com`
    };

    db.saveConfig(firebaseConfig, secret, user);
    checkConfiguration();
  });

  // Backdrop click closes modals
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    if (overlay.id === 'confirmModal') return; // handled in effects.js
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  // Quick 1-Tap Couple Nudges (Carinho) on Dashboard
  document.querySelectorAll('.nudge-pill[data-nudge]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!appState.dbData) return;
      const text = btn.getAttribute('data-nudge');
      db.logAction(appState.dbData, 'nudge', { nudgeText: text });
      playSound('check');
      saveDataAndRender(appState.dbData);
      const partner = appState.currentUser === 'Gus' ? 'Isabella' : 'Gustavo';
      showToast(`Carinho enviado para ${partner}: ${text}`);
    });
  });

  // Global Quick-Add FAB & Modal
  const openQuickTaskModal = () => {
    if (!appState.dbData) return;
    el.selectModalTaskList.innerHTML = appState.dbData.lists
      .map(l => `<option value="${l.id}" ${l.id === getDefaultTargetListId() ? 'selected' : ''}>${escapeHTML(l.name)}</option>`)
      .join('');
    el.inputModalTaskTitle.value = '';
    el.inputModalTaskDeadline.value = '';
    el.selectModalTaskPriority.value = 'Medium';
    el.selectModalTaskRecurrence.value = 'none';

    const preferredOwner = appState.ownerFilter !== 'all' ? appState.ownerFilter : 'Shared';
    const ownerRadio = document.querySelector(`input[name="modal_task_owner"][value="${preferredOwner}"]`);
    if (ownerRadio) ownerRadio.checked = true;

    el.quickTaskModal.classList.add('open');
    el.inputModalTaskTitle.focus();
  };

  const closeQuickTaskModal = () => el.quickTaskModal.classList.remove('open');

  const submitQuickTaskModal = () => {
    const title = el.inputModalTaskTitle.value.trim();
    if (!title) {
      showToast('Digite o nome da tarefa primeiro ✍️');
      el.inputModalTaskTitle.focus();
      return;
    }
    const ownerChecked = document.querySelector('input[name="modal_task_owner"]:checked');
    const deadlineVal = el.inputModalTaskDeadline.value;
    createTask({
      title,
      owner: ownerChecked ? ownerChecked.value : 'Shared',
      listId: el.selectModalTaskList.value,
      priority: el.selectModalTaskPriority.value,
      recurrence: el.selectModalTaskRecurrence.value,
      deadline: deadlineVal ? new Date(deadlineVal).toISOString() : null
    });
    closeQuickTaskModal();
  };

  if (el.btnFabAddTask) el.btnFabAddTask.addEventListener('click', openQuickTaskModal);
  if (el.btnCloseQuickTaskModal) el.btnCloseQuickTaskModal.addEventListener('click', closeQuickTaskModal);
  if (el.btnCancelQuickTask) el.btnCancelQuickTask.addEventListener('click', closeQuickTaskModal);
  if (el.btnSaveQuickTask) el.btnSaveQuickTask.addEventListener('click', submitQuickTaskModal);
  if (el.quickTaskModalForm) {
    el.quickTaskModalForm.addEventListener('submit', e => {
      e.preventDefault();
      submitQuickTaskModal();
    });
  }

  document.querySelectorAll('[data-modal-date]').forEach(chip => {
    chip.addEventListener('click', () => {
      const mode = chip.getAttribute('data-modal-date');
      if (mode === 'clear') {
        el.inputModalTaskDeadline.value = '';
        return;
      }
      const d = new Date();
      if (mode === 'today') {
        d.setHours(18, 0, 0, 0);
      } else if (mode === 'tomorrow') {
        d.setDate(d.getDate() + 1);
        d.setHours(12, 0, 0, 0);
      } else if (mode === 'weekend') {
        const daysUntilSat = (6 - d.getDay() + 7) % 7 || 7;
        d.setDate(d.getDate() + daysUntilSat);
        d.setHours(10, 0, 0, 0);
      }
      el.inputModalTaskDeadline.value = toLocalDatetimeInputValue(d.toISOString());
    });
  });

  // Couple Quick Routines Modal
  const openRoutinesModal = () => {
    if (!appState.dbData || !el.routinesListGrid) return;
    el.routinesListGrid.innerHTML = COUPLE_ROUTINES.map(pack => `
      <button type="button" class="routine-pack-card" data-routine-id="${pack.id}">
        <span class="routine-pack-title">${pack.title}</span>
        <ul class="routine-pack-items">
          ${pack.tasks.map(t => `<li>• ${escapeHTML(t.title)} (${ownerShortName(t.owner)})</li>`).join('')}
        </ul>
      </button>
    `).join('');

    el.routinesListGrid.querySelectorAll('[data-routine-id]').forEach(card => {
      card.addEventListener('click', () => {
        const pack = COUPLE_ROUTINES.find(p => p.id === card.getAttribute('data-routine-id'));
        if (!pack) return;
        const targetListId = getDefaultTargetListId();
        const nowIso = new Date().toISOString();
        pack.tasks.forEach((pt, idx) => {
          appState.dbData.tasks.push({
            id: `t-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
            listId: targetListId,
            projectId: null,
            title: pt.title,
            completed: false,
            completedBy: null,
            completedAt: null,
            createdBy: appState.currentUser,
            createdAt: nowIso,
            deadline: null,
            owner: pt.owner,
            priority: pt.priority,
            recurrence: 'none',
            emoji: pt.emoji,
            svgKey: pt.svgKey,
            subtasks: [],
            comments: []
          });
        });
        db.logAction(appState.dbData, 'add_task', {
          taskTitle: `Rotina "${pack.title}" (${pack.tasks.length} tarefas)`,
          listName: 'Rotinas Rápidas'
        });
        el.routinesModal.classList.remove('open');
        playSound('celebrate');
        saveDataAndRender(appState.dbData);
        showToast(`${pack.tasks.length} tarefas da rotina adicionadas! ⚡`);
      });
    });

    el.routinesModal.classList.add('open');
  };

  const closeRoutinesModal = () => el.routinesModal.classList.remove('open');
  if (el.btnOpenRoutinesModal) el.btnOpenRoutinesModal.addEventListener('click', openRoutinesModal);
  if (el.btnCloseRoutinesModal) el.btnCloseRoutinesModal.addEventListener('click', closeRoutinesModal);
  if (el.btnConfirmCloseRoutines) el.btnConfirmCloseRoutines.addEventListener('click', closeRoutinesModal);

  // Focus Timer (Pomodoro) Controls
  if (el.btnToggleFocusTimer) {
    el.btnToggleFocusTimer.addEventListener('click', () => {
      const visible = el.focusTimerWidget.style.display === 'flex';
      el.focusTimerWidget.style.display = visible ? 'none' : 'flex';
      renderFocusTimerUI();
    });
  }
  if (el.btnCloseFocusWidget) {
    el.btnCloseFocusWidget.addEventListener('click', () => {
      el.focusTimerWidget.style.display = 'none';
    });
  }
  if (el.btnFocusStartPause) {
    el.btnFocusStartPause.addEventListener('click', toggleFocusTimer);
  }
  if (el.btnFocusReset) {
    el.btnFocusReset.addEventListener('click', () => {
      stopFocusTimer();
      focusTimer.remainingSec = focusTimer.durationSec;
      renderFocusTimerUI();
    });
  }
  if (el.btnFocusCompleteTask) {
    el.btnFocusCompleteTask.addEventListener('click', () => {
      if (focusTimer.taskId) {
        toggleTaskCompletion(focusTimer.taskId, true);
        stopFocusTimer();
        focusTimer.taskId = null;
        focusTimer.taskTitle = null;
        el.focusTimerWidget.style.display = 'none';
        renderFocusTimerUI();
      }
    });
  }
  document.querySelectorAll('[data-focus-min]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mins = parseInt(btn.getAttribute('data-focus-min'), 10) || 25;
      stopFocusTimer();
      focusTimer.durationSec = mins * 60;
      focusTimer.remainingSec = mins * 60;
      document.querySelectorAll('[data-focus-min]').forEach(b => b.classList.toggle('active', b === btn));
      renderFocusTimerUI();
    });
  });

  // Global Keyboard Shortcuts: '/' search, 'n' quick new task, 'Escape' close modals/drawers
  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select';

    if (e.key === 'Escape') {
      closeAllModals();
      return;
    }

    if (typing) return;

    if (e.key === '/') {
      e.preventDefault();
      if (appState.activeTab !== 'tasks') {
        appState.activeTab = 'tasks';
        renderApp();
      }
      el.inputSearchTasks.focus();
    } else if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      openQuickTaskModal();
    }
  });

  // Mobile Virtual Keyboard Ergonomics:
  // 1) Never destroy inputs on virtual-keyboard vertical resize; only update header chrome when width crosses 860px
  window.addEventListener('resize', () => {
    const nowIsMobile = window.innerWidth <= 860;
    if (nowIsMobile !== lastIsMobile) {
      lastIsMobile = nowIsMobile;
      if (appState.dbData) updateResponsiveHeaderChrome();
    }
  });

  // 2) Hide mobile bottom nav / FAB while typing so inputs stay visible and flush deferred remote syncs on blur
  let focusOutTimer = null;
  const isTextInputEl = node => {
    if (!node) return false;
    const tag = (node.tagName || '').toLowerCase();
    return tag === 'textarea' || (tag === 'input' && !['checkbox', 'radio', 'button', 'submit', 'file'].includes(node.type));
  };

  document.addEventListener('focus', e => {
    if (isTextInputEl(e.target) && window.innerWidth <= 860) {
      clearTimeout(focusOutTimer);
      document.body.classList.add('keyboard-open');
    }
  }, true);

  document.addEventListener('blur', () => {
    clearTimeout(focusOutTimer);
    focusOutTimer = setTimeout(() => {
      if (!isTextInputEl(document.activeElement)) {
        document.body.classList.remove('keyboard-open');
        if (pendingSyncRender && appState.dbData) {
          pendingSyncRender = false;
          renderApp();
        }
      }
    }, 150);
  }, true);
}

// ============================================================================
// POMODORO FOCUS TIMER HELPERS
// ============================================================================

function formatSeconds(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function renderFocusTimerUI() {
  if (!el.focusTimeDisplay) return;
  const formatted = formatSeconds(focusTimer.remainingSec);
  el.focusTimeDisplay.textContent = formatted;
  el.focusTaskLabel.textContent = focusTimer.taskTitle ? `Focando: ${focusTimer.taskTitle}` : 'Foco livre do casal ✨';
  el.btnFocusStartPause.textContent = focusTimer.running ? '⏸ Pausar' : '▶ Iniciar';
  el.btnFocusCompleteTask.style.display = focusTimer.taskId ? 'inline-flex' : 'none';
  if (el.headerFocusBadge) {
    el.headerFocusBadge.textContent = focusTimer.running ? formatted : 'Foco';
  }
}

function stopFocusTimer() {
  if (focusTimer.intervalId) {
    clearInterval(focusTimer.intervalId);
    focusTimer.intervalId = null;
  }
  focusTimer.running = false;
}

function toggleFocusTimer() {
  if (focusTimer.running) {
    stopFocusTimer();
    renderFocusTimerUI();
    return;
  }
  if (focusTimer.remainingSec <= 0) {
    focusTimer.remainingSec = focusTimer.durationSec;
  }
  focusTimer.running = true;
  playSound('add');
  renderFocusTimerUI();

  focusTimer.intervalId = setInterval(() => {
    focusTimer.remainingSec = Math.max(0, focusTimer.remainingSec - 1);
    renderFocusTimerUI();
    if (focusTimer.remainingSec === 0) {
      stopFocusTimer();
      playSound('celebrate');
      launchConfetti(85);
      showToast('🍅 Tempo de foco concluído! Parabéns! 🎉');
      notifications.showNotification('🍅 Modo Foco Concluído!', focusTimer.taskTitle || 'Hora de uma pausa merecida!');
      renderFocusTimerUI();
    }
  }, 1000);
}

function openFocusTimerForTask(task) {
  focusTimer.taskId = task.id;
  focusTimer.taskTitle = task.title;
  if (!focusTimer.running) {
    focusTimer.remainingSec = focusTimer.durationSec;
  }
  el.focusTimerWidget.style.display = 'flex';
  renderFocusTimerUI();
  showToast(`🍅 Modo Foco pronto para "${task.title}"`);
}

// Start App
init();

