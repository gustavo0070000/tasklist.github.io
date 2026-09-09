import * as db from './firebase-db.js';
import * as notifications from './notifications.js';
import * as ifttt from './ifttt-webhook.js';

// Application State
let appState = {
  dbData: null,
  activeListId: 'all', // 'all', 'today', or specific list ID
  activeFilter: 'all',  // 'all', 'today'
  activeTab: 'dashboard', // default to Dashboard / Resumo do Dia
  currentUser: 'Gus',
  secretKey: '',
  currentMonth: new Date(), // For calendar month view
  expandedTaskId: null,     // Active expanded task card
  quickFilter: 'none'       // 'none', 'mine', 'urgent'
};

// DOM Elements
const elements = {
  appContainer: document.querySelector('.app-container'),
  sidebar: document.getElementById('sidebar'),
  sidebarOverlay: document.getElementById('sidebarOverlay'),
  btnToggleMenu: document.getElementById('btnToggleMenu'),
  btnOpenSettings: document.getElementById('btnOpenSettings'),
  btnToggleHistory: document.getElementById('btnToggleHistory'),
  btnCloseHistory: document.getElementById('btnCloseHistory'),
  activityDrawer: document.getElementById('activityDrawer'),
  drawerOverlay: document.getElementById('drawerOverlay'),
  historyList: document.getElementById('historyList'),
  
  // Header
  activeListTitle: document.getElementById('activeListTitle'),
  activeListOwnerBadge: document.getElementById('activeListOwnerBadge'),
  progressText: document.getElementById('progressText'),
  progressBarFill: document.getElementById('progressBarFill'),
  
  // Sidebar Tabs
  tabDashboard: document.getElementById('tabDashboard'),
  tabTasks: document.getElementById('tabTasks'),
  tabCalendar: document.getElementById('tabCalendar'),
  tabProjects: document.getElementById('tabProjects'),
  tabNotes: document.getElementById('tabNotes'),
  tabWishlist: document.getElementById('tabWishlist'),
  tabStats: document.getElementById('tabStats'),
  
  // Tab Views
  viewTasks: document.getElementById('viewTasks'),
  viewCalendar: document.getElementById('viewCalendar'),
  viewProjects: document.getElementById('viewProjects'),
  viewNotes: document.getElementById('viewNotes'),
  viewWishlist: document.getElementById('viewWishlist'),
  viewStats: document.getElementById('viewStats'),
  
  // Task Views & Quick Filters
  mainContent: document.getElementById('mainContent'),
  todoTaskList: document.getElementById('todoTaskList'),
  completedTaskList: document.getElementById('completedTaskList'),
  todoCount: document.getElementById('todoCount'),
  completedCount: document.getElementById('completedCount'),
  todoSection: document.getElementById('todoSection'),
  completedSection: document.getElementById('completedSection'),
  emptyStateView: document.getElementById('emptyStateView'),
  btnFilterMyTasks: document.getElementById('btnFilterMyTasks'),
  btnFilterUrgentTasks: document.getElementById('btnFilterUrgentTasks'),
  btnClearQuickFilters: document.getElementById('btnClearQuickFilters'),
  
  // Lists
  listsContainer: document.getElementById('listsContainer'),
  badgeCountAll: document.getElementById('badgeCountAll'),
  
  // Modals
  addListModal: document.getElementById('addListModal'),
  btnOpenAddListModal: document.getElementById('btnOpenAddListModal'),
  btnCloseAddListModal: document.getElementById('btnCloseAddListModal'),
  btnCancelAddList: document.getElementById('btnCancelAddList'),
  btnSaveList: document.getElementById('btnSaveList'),
  addListForm: document.getElementById('addListForm'),
  inputListName: document.getElementById('inputListName'),
  selectListGroup: document.getElementById('selectListGroup'),
  newGroupNameGroup: document.getElementById('newGroupNameGroup'),
  inputNewGroupName: document.getElementById('inputNewGroupName'),
  
  settingsModal: document.getElementById('settingsModal'),
  btnCloseSettingsModal: document.getElementById('btnCloseSettingsModal'),
  btnConfirmCloseSettings: document.getElementById('btnConfirmCloseSettings'),
  btnResetApp: document.getElementById('btnResetApp'),
  btnEnableNotifications: document.getElementById('btnEnableNotifications'),
  btnSwitchToGus: document.getElementById('btnSwitchToGus'),
  btnSwitchToIsa: document.getElementById('btnSwitchToIsa'),
  settingsConnectedDb: document.getElementById('settingsConnectedDb'),
  
  // Invitation & IFTTT
  btnCopyInviteLink: document.getElementById('btnCopyInviteLink'),
  inviteQrCode: document.getElementById('inviteQrCode'),
  inviteQrCodeText: document.getElementById('inviteQrCodeText'),
  setupIftttKey: document.getElementById('setupIftttKey'),
  setupIftttEvent: document.getElementById('setupIftttEvent'),
  btnTestIfttt: document.getElementById('btnTestIfttt'),
  
  // Forms & Inputs
  addTaskForm: document.getElementById('addTaskForm'),
  inputTaskTitle: document.getElementById('inputTaskTitle'),
  inputTaskDeadline: document.getElementById('inputTaskDeadline'),
  selectTaskOwner: document.getElementById('selectTaskOwner'),
  selectTaskPriority: document.getElementById('selectTaskPriority'),
  currentUserBadge: document.getElementById('currentUserBadge'),
  
  // Calendar View Elements
  btnPrevMonth: document.getElementById('btnPrevMonth'),
  btnNextMonth: document.getElementById('btnNextMonth'),
  calendarMonthTitle: document.getElementById('calendarMonthTitle'),
  calendarGrid: document.getElementById('calendarGrid'),
  
  // Projects View Elements
  btnOpenAddProjectModal: document.getElementById('btnOpenAddProjectModal'),
  projectsListContainer: document.getElementById('projectsListContainer'),
  addProjectModal: document.getElementById('addProjectModal'),
  btnCloseAddProjectModal: document.getElementById('btnCloseAddProjectModal'),
  btnCancelAddProject: document.getElementById('btnCancelAddProject'),
  btnSaveProject: document.getElementById('btnSaveProject'),
  inputProjectName: document.getElementById('inputProjectName'),
  inputProjectTargetDate: document.getElementById('inputProjectTargetDate'),
  
  // Mural View Elements
  btnOpenAddNoteModal: document.getElementById('btnOpenAddNoteModal'),
  notesGrid: document.getElementById('notesGrid'),
  addNoteModal: document.getElementById('addNoteModal'),
  btnCloseAddNoteModal: document.getElementById('btnCloseAddNoteModal'),
  btnCancelAddNote: document.getElementById('btnCancelAddNote'),
  btnSaveNote: document.getElementById('btnSaveNote'),
  inputNoteText: document.getElementById('inputNoteText'),
  
  // Wishlist View Elements
  btnOpenAddWishModal: document.getElementById('btnOpenAddWishModal'),
  wishlistGus: document.getElementById('wishlistGus'),
  wishlistIsa: document.getElementById('wishlistIsa'),
  wishlistShared: document.getElementById('wishlistShared'),
  addWishModal: document.getElementById('addWishModal'),
  btnCloseAddWishModal: document.getElementById('btnCloseAddWishModal'),
  btnCancelAddWish: document.getElementById('btnCancelAddWish'),
  btnSaveWish: document.getElementById('btnSaveWish'),
  inputWishTitle: document.getElementById('inputWishTitle'),
  inputWishLink: document.getElementById('inputWishLink'),
  inputWishNotes: document.getElementById('inputWishNotes'),
  
  // Stats & Achievements
  statsSummaryContainer: document.getElementById('statsSummaryContainer'),
  achievementsGrid: document.getElementById('achievementsGrid'),
  
  // Setup Overlay
  setupOverlay: document.getElementById('setupOverlay'),
  setupForm: document.getElementById('setupForm'),
  setupSecretKey: document.getElementById('setupSecretKey'),
  setupDbUrl: document.getElementById('setupDbUrl'),
  setupApiKey: document.getElementById('setupApiKey'),
  setupProjectId: document.getElementById('setupProjectId'),

  // New elements for Dashboard & Us Integration
  viewDashboard: document.getElementById('viewDashboard'),
  dashboardUserGreeting: document.getElementById('dashboardUserGreeting'),
  dashboardProgressSub: document.getElementById('dashboardProgressSub'),
  dashboardProgressCircle: document.getElementById('dashboardProgressCircle'),
  dashboardUrgentContainer: document.getElementById('dashboardUrgentContainer'),
  dashboardUrgentList: document.getElementById('dashboardUrgentList'),
  dashboardListsGrid: document.getElementById('dashboardListsGrid'),
  btnDashboardOpenAddList: document.getElementById('btnDashboardOpenAddList'),
  

  
  // Sticky add bar & back button:
  stickyTaskAddBar: document.getElementById('stickyTaskAddBar'),
  btnHeaderBack: document.getElementById('btnHeaderBack'),
  
  // Nós history list:
  nosHistoryList: document.getElementById('nosHistoryList'),

  // Mobile Bottom Navigation
  mobileBottomNav: document.getElementById('mobileBottomNav'),
  bottomNavBadgeTasks: document.getElementById('bottomNavBadgeTasks'),
  bottomNavBtnMore: document.getElementById('bottomNavBtnMore'),
  
  // Theme Toggle Elements
  btnToggleTheme: document.getElementById('btnToggleTheme'),
  btnSetThemeLight: document.getElementById('btnSetThemeLight'),
  btnSetThemeDark: document.getElementById('btnSetThemeDark'),
  btnSetThemeAuto: document.getElementById('btnSetThemeAuto'),
  
  // Couple Progress Ring & Mural Preview
  svgRingGus: document.getElementById('svgRingGus'),
  svgRingIsa: document.getElementById('svgRingIsa'),
  legendGusDone: document.getElementById('legendGusDone'),
  legendIsaDone: document.getElementById('legendIsaDone'),
  dashboardMuralPreviewContainer: document.getElementById('dashboardMuralPreviewContainer'),
  dashboardMuralAuthor: document.getElementById('dashboardMuralAuthor'),
  dashboardMuralText: document.getElementById('dashboardMuralText'),
  dashboardMuralPreview: document.getElementById('dashboardMuralPreview')
};

// Theme Controller (Dark Mode / Light Mode / Auto)
function initTheme() {
  const savedTheme = localStorage.getItem('tasklist_theme') || 'auto';
  applyTheme(savedTheme, false);

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if ((localStorage.getItem('tasklist_theme') || 'auto') === 'auto') {
        applyTheme('auto', false);
      }
    });
  }
}

function applyTheme(theme, save = true) {
  if (save) {
    localStorage.setItem('tasklist_theme', theme);
  }
  
  let isDark = false;
  if (theme === 'dark') {
    isDark = true;
  } else if (theme === 'light') {
    isDark = false;
  } else {
    isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  if (isDark) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }

  // Update theme buttons in Settings modal
  const themeButtons = {
    'light': elements.btnSetThemeLight,
    'dark': elements.btnSetThemeDark,
    'auto': elements.btnSetThemeAuto
  };
  
  const currentSaved = localStorage.getItem('tasklist_theme') || 'auto';
  Object.keys(themeButtons).forEach(t => {
    if (themeButtons[t]) {
      const isCurrent = t === currentSaved;
      themeButtons[t].classList.toggle('active', isCurrent);
      themeButtons[t].style.borderColor = isCurrent ? 'var(--color-primary)' : 'var(--border-standard)';
      themeButtons[t].style.backgroundColor = isCurrent ? 'var(--color-primary-fixed)' : 'transparent';
    }
  });
}

// Run initialization
initTheme();
setupEventListeners();
checkConfiguration();

// Check if app has database config
function checkConfiguration() {
  handleIncomingInvite();
  const config = db.getSavedConfig();
  if (config) {
    appState.currentUser = config.currentUser;
    appState.secretKey = config.secretKey;
    
    // Hide setup overlay and show main layout loading
    elements.setupOverlay.classList.remove('open');
    elements.activeListTitle.innerText = "Sincronizando...";
    
    // Initialize Firebase and listen
    const success = db.initFirebase();
    if (success) {
      db.listenToData(handleDataSync);
      updateProfileBadgeUI();
    } else {
      alert("Erro ao iniciar Firebase. Verifique suas configurações.");
      showSetupScreen();
    }
  } else {
    showSetupScreen();
  }
}

// Show Setup Configuration Screen
function showSetupScreen() {
  elements.setupOverlay.classList.add('open');
  elements.mainContent.style.display = 'none';
}

// Handle Real-Time sync updates from Firebase
function handleDataSync(freshData) {
  // Check for notifications
  if (appState.dbData) {
    notifications.checkNewActivities(freshData.history, appState.currentUser);
  } else {
    // First data load, init notifications history pointer
    notifications.initNotifications(freshData.history);
  }
  
  // Save to state
  appState.dbData = freshData;
  
  // Check for reactions
  if (freshData && freshData.history) {
    notifications.checkNewReactions(freshData.history, appState.currentUser);
  }
  
  // Lazy Cron for IFTTT morning summary
  if (freshData) {
    ifttt.checkAndTriggerMorningSummary(freshData, db.updateDatabase);
  }
  
  // Render entire UI
  elements.mainContent.style.display = 'flex';
  renderApp();
}

// Render the application interface
function renderApp() {
  renderProfileBadge();
  renderSidebar();
  renderHistory();
  
  // Hide all tab views
  if (elements.viewDashboard) elements.viewDashboard.style.display = 'none';
  elements.viewTasks.style.display = 'none';
  elements.viewCalendar.style.display = 'none';
  elements.viewProjects.style.display = 'none';
  elements.viewNotes.style.display = 'none';
  elements.viewWishlist.style.display = 'none';
  elements.viewStats.style.display = 'none';
  
  // Hide sticky bottom task add bar by default
  if (elements.stickyTaskAddBar) elements.stickyTaskAddBar.classList.remove('active');
  
  // Header Back Button & Hamburger Menu logic (Mobile-First Context Header)
  const isMobile = window.innerWidth <= 800;
  const inSpecificList = appState.activeTab === 'tasks' && appState.activeFilter === 'list';
  
  if (elements.btnHeaderBack) {
    if (isMobile && inSpecificList) {
      elements.btnHeaderBack.style.display = 'flex';
      if (elements.btnToggleMenu) elements.btnToggleMenu.style.display = 'none';
    } else {
      elements.btnHeaderBack.style.display = 'none';
      if (elements.btnToggleMenu) {
        elements.btnToggleMenu.style.display = isMobile ? 'flex' : 'none';
      }
    }
  }

  // Update sidebar active state (for desktop)
  document.querySelectorAll('.sidebar-section .nav-item').forEach(btn => btn.classList.remove('active'));
  const sidebarTabs = {
    'dashboard': document.getElementById('tabDashboard'),
    'tasks': document.getElementById('tabTasks'),
    'calendar': document.getElementById('tabCalendar'),
    'projects': document.getElementById('tabProjects'),
    'notes': document.getElementById('tabNotes'),
    'wishlist': document.getElementById('tabWishlist'),
    'stats': document.getElementById('tabStats')
  };
  const activeSidebarEl = sidebarTabs[appState.activeTab];
  if (activeSidebarEl && (appState.activeTab !== 'tasks' || appState.activeFilter !== 'list')) {
    activeSidebarEl.classList.add('active');
  }

  // Synchronize Mobile Bottom Nav
  if (elements.mobileBottomNav) {
    elements.mobileBottomNav.querySelectorAll('.bottom-nav-item').forEach(btn => {
      const tab = btn.getAttribute('data-tab');
      btn.classList.toggle('active', tab === appState.activeTab);
    });

    if (elements.bottomNavBadgeTasks && appState.dbData && appState.dbData.tasks) {
      const pendingCount = appState.dbData.tasks.filter(t => !t.completed).length;
      if (pendingCount > 0) {
        elements.bottomNavBadgeTasks.innerText = pendingCount;
        elements.bottomNavBadgeTasks.style.display = 'flex';
      } else {
        elements.bottomNavBadgeTasks.style.display = 'none';
      }
    }
  }

  // Render active tab view
  if (appState.activeTab === 'dashboard') {
    if (elements.viewDashboard) elements.viewDashboard.style.display = 'flex';
    renderDashboard();
  } else if (appState.activeTab === 'tasks') {
    elements.viewTasks.style.display = 'flex';
    renderTasks();
  } else if (appState.activeTab === 'calendar') {
    elements.viewCalendar.style.display = 'flex';
    renderCalendar();
  } else if (appState.activeTab === 'projects') {
    elements.viewProjects.style.display = 'flex';
    renderProjects();
  } else if (appState.activeTab === 'notes') {
    elements.viewNotes.style.display = 'flex';
    renderNotes();
  } else if (appState.activeTab === 'wishlist') {
    elements.viewWishlist.style.display = 'flex';
    renderWishlist();
  } else if (appState.activeTab === 'stats') {
    elements.viewStats.style.display = 'flex';
    renderStats();
  }
}

// Render the Dashboard (Resumo do Dia) view
function renderDashboard() {
  const data = appState.dbData;
  if (!data) return;

  // 1. Greet active user
  const isGus = appState.currentUser === 'Gus';
  elements.dashboardUserGreeting.innerText = `Olá, ${isGus ? 'Gus 🧔' : 'Isa 👩'}!`;

  // 2. Calculate daily progress & couple contributions
  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const todayTasks = data.tasks.filter(t => {
    if (!t.deadline) return false;
    const d = new Date(t.deadline);
    return d <= todayEnd;
  });

  const baseTasks = todayTasks.length > 0 ? todayTasks : data.tasks;
  const completedTasks = baseTasks.filter(t => t.completed);
  const totalCount = baseTasks.length;
  const percent = totalCount > 0 ? Math.round((completedTasks.length / totalCount) * 100) : 0;

  // Breakdown by partner
  const gusDone = completedTasks.filter(t => t.completedBy === 'Gus' || (t.owner === 'Gus' && !t.completedBy)).length;
  const isaDone = completedTasks.filter(t => t.completedBy === 'Isa' || (t.owner === 'Isa' && !t.completedBy)).length;

  if (elements.legendGusDone) elements.legendGusDone.innerText = gusDone;
  if (elements.legendIsaDone) elements.legendIsaDone.innerText = isaDone;

  // Dual Progress SVG Ring
  // Circumference for r=32: 2 * Math.PI * 32 ~= 201.06
  const circ = 201.06;
  if (elements.svgRingGus && elements.svgRingIsa) {
    if (totalCount > 0) {
      const gusLen = (gusDone / totalCount) * circ;
      const isaLen = (isaDone / totalCount) * circ;

      elements.svgRingGus.style.strokeDasharray = `${gusLen} ${circ}`;
      elements.svgRingGus.style.strokeDashoffset = '0';

      elements.svgRingIsa.style.strokeDasharray = `${isaLen} ${circ}`;
      elements.svgRingIsa.style.strokeDashoffset = `${-gusLen}`;
    } else {
      elements.svgRingGus.style.strokeDasharray = `0 ${circ}`;
      elements.svgRingIsa.style.strokeDasharray = `0 ${circ}`;
    }
  }

  elements.dashboardProgressCircle.innerText = `${percent}%`;

  if (todayTasks.length > 0) {
    const pendingCount = todayTasks.length - completedTasks.length;
    elements.dashboardProgressSub.innerText = pendingCount > 0 
      ? `${pendingCount} tarefas pendentes para hoje`
      : 'Todas as tarefas de hoje concluídas! 🎉';
  } else {
    const generalPending = data.tasks.filter(t => !t.completed).length;
    elements.dashboardProgressSub.innerText = generalPending > 0
      ? `${generalPending} tarefas pendentes no total`
      : 'Nenhuma tarefa pendente! Aproveitem! 🌸';
  }

  // 2.1 Latest Mural Note Preview
  if (elements.dashboardMuralPreviewContainer) {
    const notes = data.notes || [];
    if (notes.length > 0) {
      const lastNote = notes[notes.length - 1];
      elements.dashboardMuralPreviewContainer.style.display = 'block';
      if (elements.dashboardMuralAuthor) {
        elements.dashboardMuralAuthor.innerText = lastNote.user ? `De ${lastNote.user}` : 'Recado';
      }
      if (elements.dashboardMuralText) {
        elements.dashboardMuralText.innerText = `"${lastNote.text}"`;
      }
    } else {
      elements.dashboardMuralPreviewContainer.style.display = 'none';
    }
  }

  // 3. Highlight Urgent/Overdue Tasks
  const urgentTasks = data.tasks.filter(t => {
    if (t.completed) return false;
    if (!t.deadline) return false;
    const d = new Date(t.deadline);
    const diffHours = (d - now) / (1000 * 60 * 60);
    return d < now || diffHours <= 12; // overdue or within 12h
  });

  if (urgentTasks.length > 0) {
    elements.dashboardUrgentContainer.style.display = 'flex';
    
    // Sort urgent: oldest deadline first
    urgentTasks.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    
    elements.dashboardUrgentList.innerHTML = urgentTasks.slice(0, 3).map(task => {
      const isOverdue = new Date(task.deadline) < now;
      const typeClass = isOverdue ? 'overdue' : 'urgent';
      const formattedTime = new Date(task.deadline).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const formattedDate = new Date(task.deadline).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      
      let ownerChip = 'Geral';
      let ownerClass = 'badge-shared';
      if (task.owner === 'Gus') { ownerChip = 'Gus'; ownerClass = 'badge-gus'; }
      if (task.owner === 'Isa') { ownerChip = 'Isa'; ownerClass = 'badge-isa'; }

      return `
        <div class="urgent-highlight-card ${typeClass}" data-task-id="${task.id}">
          <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="task-meta-chip" style="background-color: var(--color-error-bg); color: var(--color-error); font-size: 10px; font-weight: bold; border-radius: var(--radius-sm);">
                ${isOverdue ? '⚠️ ATRASADA' : '⏳ URGENTE'}
              </span>
              <span style="font-size: 11px; color: var(--color-outline); font-weight: 500;">
                ${formattedDate}, ${formattedTime}
              </span>
            </div>
            <div style="font-size: 14px; font-weight: 600; color: var(--color-on-surface);">${escapeHTML(task.title)}</div>
          </div>
          <span class="task-meta-chip ${ownerClass}" style="align-self: center; font-size: 10px;">${ownerChip}</span>
        </div>
      `;
    }).join('');
    
    // Bind click to open specific task in list
    elements.dashboardUrgentList.querySelectorAll('.urgent-highlight-card').forEach(card => {
      card.addEventListener('click', () => {
        const taskId = card.getAttribute('data-task-id');
        const task = data.tasks.find(t => t.id === taskId);
        if (task) {
          appState.activeTab = 'tasks';
          appState.activeListId = task.listId;
          appState.activeFilter = 'list';
          appState.expandedTaskId = taskId;
          renderApp();
        }
      });
    });
  } else {
    elements.dashboardUrgentContainer.style.display = 'none';
  }

  // 4. Render My Lists Grid
  elements.dashboardListsGrid.innerHTML = data.lists.map(list => {
    const listTasks = data.tasks.filter(t => t.listId === list.id && !t.completed);
    const countText = listTasks.length === 1 ? '1 pendência' : `${listTasks.length} pendências`;
    
    let icon = '📁';
    const nameLower = list.name.toLowerCase();
    if (nameLower.includes('mercado') || nameLower.includes('compra') || nameLower.includes('supermercado')) icon = '🛒';
    else if (nameLower.includes('casa') || nameLower.includes('limpeza') || nameLower.includes('organizar')) icon = '🏠';
    else if (nameLower.includes('trabalho') || nameLower.includes('estud') || nameLower.includes('code')) icon = '💼';
    else if (nameLower.includes('viagem') || nameLower.includes('ferias') || nameLower.includes('mala')) icon = '✈️';
    
    let ownerClass = 'shared';
    if (list.owner === 'Gus') ownerClass = 'gus';
    if (list.owner === 'Isa') ownerClass = 'isa';
    
    return `
      <div class="dashboard-list-card" data-list-id="${list.id}">
        <div class="list-card-icon ${ownerClass}">${icon}</div>
        <div style="display: flex; flex-direction: column;">
          <span style="font-size: 15px; font-weight: 700; color: var(--color-on-surface);">${escapeHTML(list.name)}</span>
          <span style="font-size: 12px; color: var(--color-outline); margin-top: 2px;">${countText}</span>
        </div>
      </div>
    `;
  }).join('');

  // Bind list card click to open list
  elements.dashboardListsGrid.querySelectorAll('.dashboard-list-card').forEach(card => {
    card.addEventListener('click', () => {
      const listId = card.getAttribute('data-list-id');
      appState.activeTab = 'tasks';
      appState.activeListId = listId;
      appState.activeFilter = 'list';
      renderApp();
    });
  });
}

// Profile UI rendering
function renderProfileBadge() {
  const isGus = appState.currentUser === 'Gus';
  const name = isGus ? 'Gus 🧔' : 'Isa 👩';
  const avatarClass = isGus ? 'avatar-gus' : 'avatar-isa';
  
  elements.currentUserBadge.className = `user-badge`;
  elements.currentUserBadge.innerHTML = `
    <div class="user-avatar ${avatarClass}">${isGus ? 'G' : 'I'}</div>
    <span>${name}</span>
  `;
}

// Custom Date formatter for task card deadlines
function formatDeadline(isoString) {
  if (!isoString) return { text: '', class: '' };
  
  const date = new Date(isoString);
  const now = new Date();
  
  // Check if overdue (excluding completed tasks in CSS)
  const isOverdue = date < now;
  
  // Format Date String: e.g. "17 Jun, 15:30"
  const formatted = date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  if (isOverdue) {
    return { text: `⚠️ Atrasado: ${formatted}`, class: 'warning' };
  }
  
  // Check if urgent (within 24 hours)
  const diffHours = (date - now) / (1000 * 60 * 60);
  if (diffHours <= 24) {
    return { text: `⏳ Urgente: ${formatted}`, class: 'warning' };
  }
  
  return { text: `⏰ Prazo: ${formatted}`, class: '' };
}

// Update settings UI values
function updateProfileBadgeUI() {
  const isGus = appState.currentUser === 'Gus';
  elements.btnSwitchToGus.classList.toggle('active', isGus);
  elements.btnSwitchToIsa.classList.toggle('active', !isGus);
  
  const config = db.getSavedConfig();
  if (config) {
    elements.settingsConnectedDb.innerText = config.firebaseConfig.databaseURL;
    
    // Generate Invite QR Code
    const inviteUrl = generateInviteLink();
    if (inviteUrl) {
      elements.inviteQrCode.src = 'https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=' + encodeURIComponent(inviteUrl);
      elements.inviteQrCode.style.display = 'block';
      elements.inviteQrCodeText.style.display = 'block';
    } else {
      elements.inviteQrCode.style.display = 'none';
      elements.inviteQrCodeText.style.display = 'none';
    }
  }
}

// Render Sidebar lists and groups
function renderSidebar() {
  const data = appState.dbData;
  if (!data) return;
  
  // 1. Calculate smart counts
  // Tasks not completed
  const openTasks = data.tasks.filter(t => !t.completed);
  
  elements.badgeCountAll.innerText = openTasks.length;
  
  // 2. Build group + list tree
  let html = '';
  
  data.groups.forEach(group => {
    const groupLists = data.lists.filter(l => l.groupId === group.id);
    
    // Group header
    html += `
      <div class="list-group-header">${escapeHTML(group.name)}</div>
      <ul class="nav-list">
    `;
    
    // Group lists
    groupLists.forEach(list => {
      const isSelected = appState.activeTab === 'tasks' && appState.activeFilter === 'list' && appState.activeListId === list.id;
      const activeClass = isSelected ? 'active' : '';
      
      // Calculate list open tasks count
      const listOpenCount = openTasks.filter(t => t.listId === list.id).length;
      
      // Owner dot color
      let ownerDotClass = 'dot-shared';
      if (list.owner === 'Gus') ownerDotClass = 'dot-gus';
      if (list.owner === 'Isa') ownerDotClass = 'dot-isa';
      
      html += `
        <li>
          <a href="#" class="nav-item ${activeClass}" data-list-id="${list.id}">
            <span class="nav-item-owner-dot ${ownerDotClass}"></span>
            <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHTML(list.name)}</span>
            ${listOpenCount > 0 ? `<span class="nav-item-badge">${listOpenCount}</span>` : ''}
            <button class="btn-delete-list" data-list-id="${list.id}" style="color: var(--color-outline); font-size: 11px; padding: 2px 4px; display: none;">✕</button>
          </a>
        </li>
      `;
    });
    
    html += `</ul>`;
  });
  
  elements.listsContainer.innerHTML = html;
  
  // Add click events to lists
  elements.listsContainer.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-delete-list')) return; // handled separately
      e.preventDefault();
      const listId = item.getAttribute('data-list-id');
      appState.activeTab = 'tasks';
      appState.activeListId = listId;
      appState.activeFilter = 'list';
      
      // Remove active classes
      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      
      closeMobileSidebar();
      renderApp();
    });
    
    // Show delete list button on hover on desktop, or long press
    const deleteBtn = item.querySelector('.btn-delete-list');
    item.addEventListener('mouseenter', () => { deleteBtn.style.display = 'inline-block'; });
    item.addEventListener('mouseleave', () => { deleteBtn.style.display = 'none'; });
    
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const listId = deleteBtn.getAttribute('data-list-id');
      handleDeleteList(listId);
    });
  });
}

// Render tasks inside the selected view
function renderTasks() {
  const data = appState.dbData;
  if (!data) return;
  
  // Hide top quick add card on mobile in favor of sticky bottom add bar
  const isMobile = window.innerWidth <= 800;
  const isSpecificList = appState.activeFilter === 'list';
  if (isMobile && isSpecificList && elements.stickyTaskAddBar) {
    elements.stickyTaskAddBar.classList.add('active');
    const quickAddCard = document.querySelector('.quick-add-card');
    if (quickAddCard) quickAddCard.style.display = 'none';
  } else {
    if (elements.stickyTaskAddBar) elements.stickyTaskAddBar.classList.remove('active');
    const quickAddCard = document.querySelector('.quick-add-card');
    if (quickAddCard) quickAddCard.style.display = 'block';
  }
  
  let listTitle = "Todas as Tarefas";
  let listOwner = "Shared";
  let filteredTasks = [...data.tasks];
  
  // Apply filtering
  if (appState.activeFilter === 'today') {
    listTitle = "Com Prazos Limites";
    filteredTasks = filteredTasks.filter(t => t.deadline);
  } else if (appState.activeFilter === 'date') {
    const d = appState.selectedDate;
    const dStr = d.toLocaleDateString('pt-BR');
    listTitle = `Tarefas para ${dStr}`;
    filteredTasks = filteredTasks.filter(t => {
      if (!t.deadline) return false;
      const taskDate = new Date(t.deadline);
      return taskDate.getFullYear() === d.getFullYear() &&
             taskDate.getMonth() === d.getMonth() &&
             taskDate.getDate() === d.getDate();
    });
  } else if (appState.activeFilter === 'list') {
    const activeList = data.lists.find(l => l.id === appState.activeListId);
    if (activeList) {
      listTitle = activeList.name;
      listOwner = activeList.owner;
      filteredTasks = filteredTasks.filter(t => t.listId === appState.activeListId);
    } else {
      // Fallback if list was deleted
      appState.activeFilter = 'all';
      appState.activeListId = 'all';
      renderTasks();
      return;
    }
  }

  // Apply quick filters
  if (appState.quickFilter === 'mine') {
    filteredTasks = filteredTasks.filter(t => t.owner === appState.currentUser);
  } else if (appState.quickFilter === 'urgent') {
    const now = new Date();
    filteredTasks = filteredTasks.filter(t => {
      if (!t.deadline) return false;
      const d = new Date(t.deadline);
      return d < now || (d - now) / (1000 * 60 * 60) <= 12; // overdue or within 12h
    });
  }
  
  // Header title update
  elements.activeListTitle.innerText = listTitle;
  
  // Owner Badge
  elements.activeListOwnerBadge.className = 'list-owner-badge';
  if (listOwner === 'Gus') {
    elements.activeListOwnerBadge.innerText = 'Lista de Gus';
    elements.activeListOwnerBadge.className = 'list-owner-badge badge-gus';
    elements.activeListOwnerBadge.style.display = 'inline-block';
  } else if (listOwner === 'Isa') {
    elements.activeListOwnerBadge.innerText = 'Lista de Isa';
    elements.activeListOwnerBadge.className = 'list-owner-badge badge-isa';
    elements.activeListOwnerBadge.style.display = 'inline-block';
  } else {
    elements.activeListOwnerBadge.innerText = 'Lista Compartilhada';
    elements.activeListOwnerBadge.className = 'list-owner-badge badge-shared';
    elements.activeListOwnerBadge.style.display = 'inline-block';
  }
  
  // Sort tasks: newest first
  filteredTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  const todoList = filteredTasks.filter(t => !t.completed);
  const completedList = filteredTasks.filter(t => t.completed);
  
  // Set progress numbers
  const totalCount = filteredTasks.length;
  const doneCount = completedList.length;
  const percent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  
  elements.progressText.innerText = `${percent}%`;
  elements.progressBarFill.style.width = `${percent}%`;
  
  elements.todoCount.innerText = todoList.length;
  elements.completedCount.innerText = completedList.length;
  
  // Highlight active quick filter buttons
  elements.btnFilterMyTasks.style.backgroundColor = appState.quickFilter === 'mine' ? 'var(--color-primary-fixed)' : 'transparent';
  elements.btnFilterMyTasks.style.borderColor = appState.quickFilter === 'mine' ? 'var(--color-primary)' : 'var(--color-outline-variant)';
  elements.btnFilterUrgentTasks.style.backgroundColor = appState.quickFilter === 'urgent' ? 'var(--color-primary-fixed)' : 'transparent';
  elements.btnFilterUrgentTasks.style.borderColor = appState.quickFilter === 'urgent' ? 'var(--color-primary)' : 'var(--color-outline-variant)';
  elements.btnClearQuickFilters.style.display = (appState.quickFilter !== 'none' || appState.activeFilter === 'date') ? 'inline-block' : 'none';
  
  // Toggle empty states
  if (totalCount === 0) {
    elements.emptyStateView.style.display = 'flex';
    elements.todoSection.style.display = 'none';
    elements.completedSection.style.display = 'none';
    return;
  }
  
  elements.emptyStateView.style.display = 'none';
  elements.todoSection.style.display = todoList.length > 0 ? 'block' : 'none';
  elements.completedSection.style.display = completedList.length > 0 ? 'block' : 'none';
  
  // Render Pending Tasks
  elements.todoTaskList.innerHTML = todoList.map(task => renderTaskCard(task)).join('');
  
  // Render Completed Tasks
  elements.completedTaskList.innerHTML = completedList.map(task => renderTaskCard(task)).join('');
  
  // Add Task card interaction events
  addTaskListeners();
}

// Generate single task card HTML
function renderTaskCard(task) {
  const deadlineInfo = formatDeadline(task.deadline);
  const isCompleted = task.completed;
  
  // Find task owner badge colors
  let ownerChipClass = 'badge-shared';
  let ownerName = '👪 Geral';
  if (task.owner === 'Gus') { ownerChipClass = 'badge-gus'; ownerName = '🧔 Gus'; }
  if (task.owner === 'Isa') { ownerChipClass = 'badge-isa'; ownerName = '👩 Isa'; }
  
  const priorityClass = `priority-${(task.priority || 'Medium').toLowerCase()}`;
  
  let priorityBadge = '';
  if (task.priority === 'High') priorityBadge = '<span class="task-meta-chip" style="background-color: var(--color-error-bg); color: var(--color-error); font-weight: bold;">🔴 Alta</span>';
  else if (task.priority === 'Low') priorityBadge = '<span class="task-meta-chip" style="background-color: var(--color-success-bg); color: var(--color-success); font-weight: bold;">🟢 Baixa</span>';
  else priorityBadge = '<span class="task-meta-chip" style="background-color: var(--color-warning-bg); color: var(--color-warning-text); font-weight: bold;">🟡 Média</span>';
  
  const isExpanded = task.id === appState.expandedTaskId;
  
  const subtasks = task.subtasks || [];
  const comments = task.comments || [];

  // 1. Subtasks Checklist
  let subtasksListHtml = '';
  if (subtasks.length > 0) {
    subtasksListHtml = subtasks.map(st => `
      <div class="subtask-item ${st.completed ? 'completed' : ''}" style="display: flex; align-items: center; gap: 0.5rem; font-size: 13px; padding: 2px 0;">
        <input type="checkbox" class="subtask-checkbox" data-subtask-id="${st.id}" ${st.completed ? 'checked' : ''} style="cursor: pointer;">
        <span class="subtask-title" style="flex: 1; ${st.completed ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${escapeHTML(st.title)}</span>
        ${isExpanded ? `<button class="btn-delete-subtask" data-subtask-id="${st.id}" style="border: none; background: none; font-size: 12px; cursor: pointer; color: var(--color-outline); padding: 0 4px;">✕</button>` : ''}
      </div>
    `).join('');
  } else if (isExpanded) {
    subtasksListHtml = '<p style="font-size: 11px; color: var(--color-outline); font-style: italic; margin: 0;">Nenhuma sub-tarefa criada.</p>';
  }

  // 2. Comments List
  let commentsListHtml = '';
  if (comments.length > 0) {
    commentsListHtml = comments.map(c => {
      const time = new Date(c.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return `
        <div class="comment-item" style="font-size: 12px; line-height: 1.4; background: white; padding: 6px 8px; border-radius: var(--radius-sm); border: var(--border-standard); margin-bottom: 4px;">
          <span class="comment-user" style="font-weight: 700;">${c.user}:</span>
          <span>${escapeHTML(c.text)}</span>
          <span class="comment-time" style="font-size: 10px; color: var(--color-outline); float: right; margin-left: 8px;">${time}</span>
        </div>
      `;
    }).join('');
  } else if (isExpanded) {
    commentsListHtml = '<p style="font-size: 11px; color: var(--color-outline); font-style: italic; margin: 0; padding: 4px 0;">Sem recados.</p>';
  }

  // 3. Settings Block (Priority, Recurrence, Owner, Deadline) - only when expanded
  let settingsHtml = '';
  if (isExpanded) {
    const prioritySelect = `
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 11px; font-weight: 700; color: var(--color-outline);">Prioridade:</span>
        <select class="select-task-card-priority" style="font-size: 12px; padding: 2px 6px; border: var(--border-standard); border-radius: var(--radius-sm); background: white;">
          <option value="Low" ${task.priority === 'Low' ? 'selected' : ''}>🟢 Baixa</option>
          <option value="Medium" ${task.priority === 'Medium' || !task.priority ? 'selected' : ''}>🟡 Média</option>
          <option value="High" ${task.priority === 'High' ? 'selected' : ''}>🔴 Alta</option>
        </select>
      </div>
    `;
    
    const recurrenceSelect = `
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 11px; font-weight: 700; color: var(--color-outline);">Repetir:</span>
        <select class="select-task-card-recurrence" style="font-size: 12px; padding: 2px 6px; border: var(--border-standard); border-radius: var(--radius-sm); background: white;">
          <option value="none" ${task.recurrence === 'none' || !task.recurrence ? 'selected' : ''}>Não repetir</option>
          <option value="daily" ${task.recurrence === 'daily' ? 'selected' : ''}>Diariamente</option>
          <option value="weekly" ${task.recurrence === 'weekly' ? 'selected' : ''}>Semanalmente</option>
          <option value="monthly" ${task.recurrence === 'monthly' ? 'selected' : ''}>Mensalmente</option>
        </select>
      </div>
    `;

    const ownerSelect = `
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 11px; font-weight: 700; color: var(--color-outline);">Responsável:</span>
        <select class="select-task-card-owner" style="font-size: 12px; padding: 2px 6px; border: var(--border-standard); border-radius: var(--radius-sm); background: white;">
          <option value="Shared" ${task.owner === 'Shared' || !task.owner ? 'selected' : ''}>👪 Compartilhado</option>
          <option value="Gus" ${task.owner === 'Gus' ? 'selected' : ''}>Gus</option>
          <option value="Isa" ${task.owner === 'Isa' ? 'selected' : ''}>Isa</option>
        </select>
      </div>
    `;

    let deadlineValue = '';
    if (task.deadline) {
      const date = new Date(task.deadline);
      const tzOffset = date.getTimezoneOffset() * 60000;
      const localISODate = new Date(date.getTime() - tzOffset).toISOString();
      deadlineValue = localISODate.slice(0, 16);
    }
    const deadlineInput = `
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 11px; font-weight: 700; color: var(--color-outline);">Prazo:</span>
        <input type="datetime-local" class="input-task-card-deadline" value="${deadlineValue}" style="font-size: 12px; padding: 2px 6px; border: var(--border-standard); border-radius: var(--radius-sm); background: white;">
      </div>
    `;

    settingsHtml = `
      <div style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.75rem; width: 100%;">
        ${prioritySelect}
        ${recurrenceSelect}
        ${ownerSelect}
        ${deadlineInput}
      </div>
    `;
  }

  // 4. Checklist Block Layout
  let checklistBlockHtml = '';
  if (subtasks.length > 0 || isExpanded) {
    const inputAddHtml = isExpanded ? `
      <div style="display: flex; gap: 6px; margin-top: 4px;">
        <input type="text" class="input-subtask-add" placeholder="Adicionar item ao checklist..." style="flex: 1; font-size: 12px; border: none; border-bottom: 1px dashed var(--color-outline-variant); outline: none; background: transparent; padding: 4px 0;">
        <button class="btn-subtask-add-submit" style="padding: 2px 8px; font-size: 12px; background-color: var(--color-primary); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer;">+</button>
      </div>
    ` : '';

    checklistBlockHtml = `
      <div class="subtasks-section" style="display: flex; flex-direction: column; gap: 0.5rem; width: 100%;">
        <label style="font-size: 11px; font-weight: 700; color: var(--color-outline);">Checklist de Itens</label>
        <div class="subtask-list" style="display: flex; flex-direction: column; gap: 4px;">
          ${subtasksListHtml}
        </div>
        ${inputAddHtml}
      </div>
    `;
  }

  // 5. Comments Block Layout
  let commentsBlockHtml = '';
  if (comments.length > 0 || isExpanded) {
    const inputCommentHtml = isExpanded ? `
      <div class="comment-form" style="display: flex; gap: 4px; margin-top: 4px; width: 100%;">
        <input type="text" class="input-comment" placeholder="Escrever comentário..." style="flex: 1; font-size: 12px; border: var(--border-standard); border-radius: var(--radius-sm); padding: 4px 8px; outline: none;">
        <button class="btn-comment-send" style="padding: 4px 10px; font-size: 12px; background-color: var(--color-primary); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer;">Enviar</button>
      </div>
    ` : '';

    commentsBlockHtml = `
      <div class="comments-section" style="display: flex; flex-direction: column; gap: 0.5rem; background-color: var(--color-surface-container-low); padding: 0.75rem; border-radius: var(--radius-default); border: var(--border-standard); width: 100%;">
        <label style="font-size: 11px; font-weight: 700; color: var(--color-outline);">Chat / Comentários</label>
        <div class="comment-list" style="max-height: 120px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;">
          ${commentsListHtml}
        </div>
        ${inputCommentHtml}
      </div>
    `;
  }

  // Combine elements inside the card-expanded-content wrapper if there is any content to render
  let extraContentHtml = '';
  if (settingsHtml || checklistBlockHtml || commentsBlockHtml) {
    extraContentHtml = `
      <div class="task-card-expanded-content" style="display: flex; flex-direction: column; gap: 0.75rem; width: 100%; border-top: 1px solid #f1f5f9; padding-top: 0.75rem; margin-top: 0.5rem;">
        ${settingsHtml}
        ${checklistBlockHtml}
        ${commentsBlockHtml}
      </div>
    `;
  }
  
  return `
    <div class="task-card ${isCompleted ? 'completed' : ''} ${priorityClass}" data-task-id="${task.id}">
      <div style="display: flex; align-items: flex-start; width: 100%; gap: 0.75rem;">
        <label class="checkbox-container" style="margin-top: 4px;">
          <input type="checkbox" class="task-checkbox" ${isCompleted ? 'checked' : ''}>
          <span class="checkmark"></span>
        </label>
        
        <div class="task-card-clickable-area" style="flex: 1; cursor: pointer; display: flex; flex-direction: column;">
          <div class="task-title" style="font-weight: 600; font-size: 14px;">${escapeHTML(task.title)}</div>
          <div class="task-meta-row" style="margin-top: 4px;">
            <span class="task-meta-chip ${ownerChipClass}">${ownerName}</span>
            ${priorityBadge}
            ${deadlineInfo.text ? `<span class="task-meta-chip deadline-badge ${deadlineInfo.class}">${deadlineInfo.text}</span>` : ''}
            ${isCompleted && task.completedBy ? `<span class="task-meta-chip" style="font-style: italic; background-color: var(--color-surface-container);">Concluído por: ${task.completedBy}</span>` : ''}
          </div>
        </div>
        
        <button class="task-action-btn btn-delete-task" title="Excluir Tarefa" style="margin-top: 4px;">🗑️</button>
      </div>
      
      ${extraContentHtml}
    </div>
  `;
}

// Add event handlers to task cards
function addTaskListeners() {
  // Click title/meta to expand/collapse card
  document.querySelectorAll('.task-card-clickable-area').forEach(area => {
    area.addEventListener('click', (e) => {
      const card = area.closest('.task-card');
      const taskId = card.getAttribute('data-task-id');
      
      if (appState.expandedTaskId === taskId) {
        appState.expandedTaskId = null; // collapse
      } else {
        appState.expandedTaskId = taskId; // expand
      }
      renderTasks();
    });
  });
  
  // Checkbox toggle with celebratory micro-interaction
  document.querySelectorAll('.task-checkbox').forEach(chk => {
    chk.addEventListener('change', (e) => {
      e.stopPropagation();
      const card = chk.closest('.task-card');
      const taskId = card.getAttribute('data-task-id');
      const isChecked = chk.checked;

      if (isChecked) {
        card.classList.add('completing');
        setTimeout(() => {
          toggleTaskCompletion(taskId, true);
        }, 280);
      } else {
        toggleTaskCompletion(taskId, false);
      }
    });
  });
  
  // Delete button
  document.querySelectorAll('.btn-delete-task').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.task-card');
      const taskId = card.getAttribute('data-task-id');
      handleDeleteTask(taskId);
    });
  });
  
  // Subtasks toggle checkbox
  document.querySelectorAll('.subtask-checkbox').forEach(chk => {
    chk.addEventListener('change', (e) => {
      e.stopPropagation();
      const card = chk.closest('.task-card');
      const taskId = card.getAttribute('data-task-id');
      const subtaskId = chk.getAttribute('data-subtask-id');
      toggleSubtaskCompletion(taskId, subtaskId, chk.checked);
    });
  });
  
  // Subtask delete button
  document.querySelectorAll('.btn-delete-subtask').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.task-card');
      const taskId = card.getAttribute('data-task-id');
      const subtaskId = btn.getAttribute('data-subtask-id');
      handleDeleteSubtask(taskId, subtaskId);
    });
  });
  
  // Subtask add button/enter key
  document.querySelectorAll('.input-subtask-add').forEach(input => {
    const card = input.closest('.task-card');
    const taskId = card.getAttribute('data-task-id');
    const btn = card.querySelector('.btn-subtask-add-submit');
    
    const submitSubtask = () => {
      const title = input.value.trim();
      if (title) {
        handleAddSubtask(taskId, title);
      }
    };
    
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('keypress', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        submitSubtask();
      }
    });
    
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        submitSubtask();
      });
    }
  });
  
  // Comment submit form
  document.querySelectorAll('.comment-form').forEach(form => {
    const card = form.closest('.task-card');
    const taskId = card.getAttribute('data-task-id');
    const input = card.querySelector('.input-comment');
    const btn = card.querySelector('.btn-comment-send');
    
    const submitComment = () => {
      const text = input.value.trim();
      if (text) {
        handleAddComment(taskId, text);
      }
    };
    
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('keypress', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        submitComment();
      }
    });
    
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        submitComment();
      });
    }
  });
  
  // Priority dropdown change
  document.querySelectorAll('.select-task-card-priority').forEach(sel => {
    sel.addEventListener('click', (e) => e.stopPropagation());
    sel.addEventListener('change', (e) => {
      const card = sel.closest('.task-card');
      const taskId = card.getAttribute('data-task-id');
      handleTaskPriorityChange(taskId, sel.value);
    });
  });
  
  // Recurrence dropdown change
  document.querySelectorAll('.select-task-card-recurrence').forEach(sel => {
    sel.addEventListener('click', (e) => e.stopPropagation());
    sel.addEventListener('change', (e) => {
      const card = sel.closest('.task-card');
      const taskId = card.getAttribute('data-task-id');
      handleTaskRecurrenceChange(taskId, sel.value);
    });
  });

  // Owner dropdown change
  document.querySelectorAll('.select-task-card-owner').forEach(sel => {
    sel.addEventListener('click', (e) => e.stopPropagation());
    sel.addEventListener('change', (e) => {
      const card = sel.closest('.task-card');
      const taskId = card.getAttribute('data-task-id');
      handleTaskOwnerChange(taskId, sel.value);
    });
  });

  // Deadline date-time picker change
  document.querySelectorAll('.input-task-card-deadline').forEach(inp => {
    inp.addEventListener('click', (e) => e.stopPropagation());
    inp.addEventListener('change', (e) => {
      const card = inp.closest('.task-card');
      const taskId = card.getAttribute('data-task-id');
      const isoDeadline = inp.value ? new Date(inp.value).toISOString() : null;
      handleTaskDeadlineChange(taskId, isoDeadline);
    });
  });
}

// Render History Log items in drawer
function renderHistory() {
  const data = appState.dbData;
  if (!data || !data.history) return;
  
  const historyHtml = data.history.map(log => {
    let icon = '✏️';
    let colorClass = 'dot-shared';
    if (log.user === 'Gus') colorClass = 'avatar-gus';
    if (log.user === 'Isa') colorClass = 'avatar-isa';
    
    switch(log.action) {
      case 'add_task': icon = '➕'; break;
      case 'complete_task': icon = '✓'; break;
      case 'uncomplete_task': icon = '↩️'; break;
      case 'delete_task': icon = '🗑️'; break;
      case 'add_list': icon = '📁'; break;
      case 'delete_list': icon = '✕'; break;
      case 'add_note': icon = '📌'; break;
      case 'delete_note': icon = '🗑️'; break;
      case 'add_wish': icon = '🎁'; break;
      case 'delete_wish': icon = '🗑️'; break;
      case 'add_project': icon = '🚀'; break;
      case 'delete_project': icon = '🗑️'; break;
      case 'undo_action': icon = '↩️'; break;
    }
    
    const time = new Date(log.timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short'
    });
    
    let text = '';
    if (log.action === 'add_task') {
      text = `adicionou <strong>"${escapeHTML(log.taskTitle)}"</strong> na lista <em>${escapeHTML(log.listName)}</em>`;
    } else if (log.action === 'complete_task') {
      text = `marcou como concluída: <strong>"${escapeHTML(log.taskTitle)}"</strong>`;
    } else if (log.action === 'uncomplete_task') {
      text = `desmarcou a tarefa: <strong>"${escapeHTML(log.taskTitle)}"</strong>`;
    } else if (log.action === 'delete_task') {
      text = `removeu a tarefa: <strong>"${escapeHTML(log.taskTitle)}"</strong>`;
    } else if (log.action === 'add_list') {
      text = `criou a lista: <strong>"${escapeHTML(log.listName)}"</strong>`;
    } else if (log.action === 'delete_list') {
      text = `removeu a lista: <strong>"${escapeHTML(log.listName)}"</strong>`;
    } else if (log.action === 'add_note') {
      text = `deixou um recado no mural: <em>"${escapeHTML(log.noteText)}"</em>`;
    } else if (log.action === 'delete_note') {
      text = `removeu um recado do mural`;
    } else if (log.action === 'add_wish') {
      text = `adicionou na lista de desejos: <strong>"${escapeHTML(log.wishTitle)}"</strong>`;
    } else if (log.action === 'delete_wish') {
      text = `removeu o desejo: <strong>"${escapeHTML(log.wishTitle)}"</strong>`;
    } else if (log.action === 'add_project') {
      text = `criou uma nova grande meta: <strong>"${escapeHTML(log.projectName)}"</strong>`;
    } else if (log.action === 'delete_project') {
      text = `removeu a grande meta: <strong>"${escapeHTML(log.projectName)}"</strong>`;
    } else if (log.action === 'undo_action') {
      text = `desfez a ação <strong>"${escapeHTML(log.undoAction)}"</strong> executada por <em>${escapeHTML(log.undoUser)}</em>`;
    }
    
    // Generate emoji reactions row
    const emojis = ['❤️', '👍', '🎉', '😂'];
    const logReactions = log.reactions || {};
    let reactionsHtml = `<div class="history-reactions-row">`;
    emojis.forEach(emoji => {
      const userReacted = logReactions[appState.currentUser] === emoji;
      const activeClass = userReacted ? 'active' : '';
      
      const count = Object.values(logReactions).filter(v => v === emoji).length;
      const countBadge = count > 0 ? ` <span>${count}</span>` : '';
      
      reactionsHtml += `
        <button class="btn-history-reaction ${activeClass}" data-log-id="${log.id}" data-emoji="${emoji}">
          ${emoji}${countBadge}
        </button>
      `;
    });
    reactionsHtml += `</div>`;
    
    // Add undo button if applicable
    const undoable = ['complete_task', 'add_task', 'add_list', 'add_note', 'add_wish'].includes(log.action);
    const undoHtml = undoable ? `<button class="btn-history-undo" data-log-id="${log.id}" style="border: none; background: none; color: var(--color-error); font-size: 11px; cursor: pointer; padding: 0; margin-left: 8px;">[Desfazer]</button>` : '';
    
    return `
      <div class="history-item" style="flex-direction: column; align-items: flex-start; gap: 4px; padding: 10px 0; border-bottom: 1px solid rgba(0,0,0,0.04);">
        <div style="display: flex; align-items: center; width: 100%;">
          <div class="history-marker ${colorClass}">${icon}</div>
          <div class="history-text" style="flex: 1;">
            <strong>${log.user}</strong> ${text}
            <span class="history-time">${time}</span>
            ${undoHtml}
          </div>
        </div>
        ${reactionsHtml}
      </div>
    `;
  }).join('');
  
  elements.historyList.innerHTML = historyHtml || '<p class="body-sm" style="color: var(--color-outline); text-align: center; margin-top: 2rem;">Nenhuma atividade registrada ainda.</p>';
  
  // Render history directly in the Nós (Us) view tab
  if (elements.nosHistoryList) {
    elements.nosHistoryList.innerHTML = historyHtml || '<p class="body-sm" style="color: var(--color-outline); text-align: center; margin-top: 1rem;">Nenhuma atividade registrada ainda.</p>';
    
    // Bind reactions in Nosotros History
    elements.nosHistoryList.querySelectorAll('.btn-history-reaction').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const logId = btn.getAttribute('data-log-id');
        const emoji = btn.getAttribute('data-emoji');
        handleHistoryReaction(logId, emoji);
      });
    });
    
    // Bind undo in Nosotros History
    elements.nosHistoryList.querySelectorAll('.btn-history-undo').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const logId = btn.getAttribute('data-log-id');
        handleHistoryUndo(logId);
      });
    });
  }

  // Bind reactions
  elements.historyList.querySelectorAll('.btn-history-reaction').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const logId = btn.getAttribute('data-log-id');
      const emoji = btn.getAttribute('data-emoji');
      handleHistoryReaction(logId, emoji);
    });
  });
  
  // Bind undo
  elements.historyList.querySelectorAll('.btn-history-undo').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const logId = btn.getAttribute('data-log-id');
      handleHistoryUndo(logId);
    });
  });
}

function saveDataAndRender(data) {
  checkRecurrenceAndClone(data);
  renderApp();
  db.updateDatabase(data).catch(err => {
    alert("Erro ao salvar no Firebase! Certifique-se de que você configurou as Regras de Segurança no painel do Firebase Console para ler e escrever (veja o passo a passo na tela de configuração). Detalhes do erro: " + err.message);
    console.error("Firebase write error:", err);
  });
}

// Action: Toggle completion state of task
function toggleTaskCompletion(taskId, isChecked) {
  const data = appState.dbData;
  const task = data.tasks.find(t => t.id === taskId);
  if (!task) return;
  
  task.completed = isChecked;
  task.completedBy = isChecked ? appState.currentUser : null;
  task.completedAt = isChecked ? new Date().toISOString() : null;
  
  // Log action
  db.logAction(data, isChecked ? 'complete_task' : 'uncomplete_task', {
    taskId: task.id,
    taskTitle: task.title
  });
  
  saveDataAndRender(data);
}

// Action: Delete a task
function handleDeleteTask(taskId) {
  const data = appState.dbData;
  const taskIndex = data.tasks.findIndex(t => t.id === taskId);
  if (taskIndex === -1) return;
  
  const task = data.tasks[taskIndex];
  
  // Confirmation if task is not completed yet
  if (!task.completed && !confirm(`Deseja mesmo remover a tarefa "${task.title}"?`)) {
    renderTasks(); // restore checkbox UI state
    return;
  }
  
  // Log action before deleting
  db.logAction(data, 'delete_task', {
    taskId: task.id,
    taskTitle: task.title
  });
  
  // Remove task from array
  data.tasks.splice(taskIndex, 1);
  
  saveDataAndRender(data);
}

// Action: Delete a list and all its tasks
function handleDeleteList(listId) {
  const data = appState.dbData;
  const list = data.lists.find(l => l.id === listId);
  if (!list) return;
  
  if (!confirm(`Excluir a lista "${list.name}" removerá também todas as tarefas dentro dela. Deseja prosseguir?`)) {
    return;
  }
  
  // Log action
  db.logAction(data, 'delete_list', {
    listId: list.id,
    listName: list.name
  });
  
  // Remove list and its tasks
  data.lists = data.lists.filter(l => l.id !== listId);
  data.tasks = data.tasks.filter(t => t.listId !== listId);
  
  // If active list was deleted, redirect
  if (appState.activeListId === listId) {
    appState.activeListId = 'all';
    appState.activeFilter = 'all';
  }
  
  saveDataAndRender(data);
}

// Register DOM and UI Event Listeners
function setupEventListeners() {
  // Mobile Sidebar Toggle
  elements.btnToggleMenu.addEventListener('click', () => {
    elements.sidebar.classList.add('open');
    elements.sidebarOverlay.classList.add('open');
  });
  
  elements.sidebarOverlay.addEventListener('click', closeMobileSidebar);
  
  // Setup Submit
  elements.setupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const user = document.querySelector('input[name="setup_user"]:checked').value;
    const secret = elements.setupSecretKey.value.trim().toLowerCase();
    
    const firebaseConfig = {
      apiKey: elements.setupApiKey.value.trim(),
      databaseURL: elements.setupDbUrl.value.trim(),
      projectId: elements.setupProjectId.value.trim(),
      authDomain: `${elements.setupProjectId.value.trim()}.firebaseapp.com`,
      storageBucket: `${elements.setupProjectId.value.trim()}.appspot.com`
    };
    
    db.saveConfig(firebaseConfig, secret, user);
    checkConfiguration();
  });
  
  // Add List Modals Open/Close
  elements.btnOpenAddListModal.addEventListener('click', () => {
    elements.addListModal.classList.add('open');
    populateGroupSelect();
    elements.inputListName.value = '';
    elements.inputNewGroupName.value = '';
    elements.inputListName.focus();
  });
  
  const closeAddList = () => {
    elements.addListModal.classList.remove('open');
  };
  
  elements.btnCloseAddListModal.addEventListener('click', closeAddList);
  elements.btnCancelAddList.addEventListener('click', closeAddList);
  
  // Trigger Group visibility depending on dropdown selection
  elements.selectListGroup.addEventListener('change', () => {
    const value = elements.selectListGroup.value;
    elements.newGroupNameGroup.style.display = value === 'NEW_GROUP' ? 'block' : 'none';
  });
  
  // Save new list
  elements.btnSaveList.addEventListener('click', handleCreateList);
  
  // Task submit form
  elements.addTaskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleCreateTask();
  });
  
  // History Drawer Show/Hide
  elements.btnToggleHistory.addEventListener('click', () => {
    elements.activityDrawer.classList.add('open');
    elements.drawerOverlay.classList.add('open');
  });
  
  const closeHistory = () => {
    elements.activityDrawer.classList.remove('open');
    elements.drawerOverlay.classList.remove('open');
  };
  elements.btnCloseHistory.addEventListener('click', closeHistory);
  elements.drawerOverlay.addEventListener('click', closeHistory);
  
  // Settings Modal Open/Close
  elements.btnOpenSettings.addEventListener('click', () => {
    elements.settingsModal.classList.add('open');
    updateProfileBadgeUI();
    const iftttConfig = ifttt.getIftttConfig();
    elements.setupIftttKey.value = iftttConfig.key;
    elements.setupIftttEvent.value = iftttConfig.event;
  });
  
  const saveIftttSettings = () => {
    const key = elements.setupIftttKey.value.trim();
    const event = elements.setupIftttEvent.value.trim();
    ifttt.saveIftttConfig(key, event);
  };
  
  elements.btnCloseSettingsModal.addEventListener('click', () => {
    saveIftttSettings();
    elements.settingsModal.classList.remove('open');
  });
  elements.btnConfirmCloseSettings.addEventListener('click', () => {
    saveIftttSettings();
    elements.settingsModal.classList.remove('open');
  });
  
  // Reset App / Log out configuration
  elements.btnResetApp.addEventListener('click', () => {
    if (confirm("Deseja realmente desconectar este dispositivo do banco Firebase?")) {
      db.clearConfig();
      elements.settingsModal.classList.remove('open');
      showSetupScreen();
    }
  });
  
  // Enable local notifications
  elements.btnEnableNotifications.addEventListener('click', () => {
    notifications.requestPermission().then(permission => {
      if (permission === 'granted') {
        notifications.showNotification("Notificações Ativadas!", "Prontinho! Você receberá alertas quando houver novas tarefas.");
      } else {
        alert("Notificações bloqueadas pelo navegador. Permita nas configurações do seu celular.");
      }
    });
  });
  
  // Profile Switching in Settings
  elements.btnSwitchToGus.addEventListener('click', () => switchUserProfile('Gus'));
  elements.btnSwitchToIsa.addEventListener('click', () => switchUserProfile('Isa'));
  
  // Invite System Copy Button
  elements.btnCopyInviteLink.addEventListener('click', () => {
    const inviteUrl = generateInviteLink();
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl).then(() => {
        alert("Link de convite copiado para a área de transferência! Envie para o seu parceiro.");
      }).catch(err => {
        // Fallback
        const input = document.createElement('input');
        input.value = inviteUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        alert("Link de convite copiado!");
      });
    } else {
      alert("Configure o aplicativo primeiro para gerar um convite.");
    }
  });
  
  // IFTTT Test Webhook
  elements.btnTestIfttt.addEventListener('click', () => {
    const data = appState.dbData;
    if (!data) return;
    ifttt.fireTestWebhook(data, appState.currentUser)
      .then(() => alert("Disparo de teste enviado com sucesso! Verifique seu WhatsApp/Email configurado."))
      .catch(err => alert("Erro no disparo de teste: " + err));
  });
  
  // Back button in header (returns to Dashboard)
  if (elements.btnHeaderBack) {
    elements.btnHeaderBack.addEventListener('click', (e) => {
      e.preventDefault();
      appState.activeTab = 'dashboard';
      renderApp();
    });
  }

  // Dashboard "+" add list button listener
  if (elements.btnDashboardOpenAddList) {
    elements.btnDashboardOpenAddList.addEventListener('click', (e) => {
      e.preventDefault();
      elements.addListModal.classList.add('open');
      populateGroupSelect();
      elements.inputListName.value = '';
      elements.inputNewGroupName.value = '';
      elements.inputListName.focus();
    });
  }

  // Sticky task add form submission (adds to current active list)
  const stickyForm = document.getElementById('stickyAddTaskForm');
  if (stickyForm) {
    stickyForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('inputStickyTaskTitle');
      const title = input.value.trim();
      if (!title) return;
      
      const data = appState.dbData;
      let targetListId = appState.activeListId;
      if (appState.activeListId === 'all' || appState.activeListId === 'today') {
        if (data.lists.length > 0) {
          targetListId = data.lists[0].id;
        } else {
          alert("Crie uma lista no menu lateral antes de adicionar tarefas.");
          return;
        }
      }
      
      const newTask = {
        id: 't-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        listId: targetListId,
        title: title,
        completed: false,
        completedBy: null,
        completedAt: null,
        createdBy: appState.currentUser,
        createdAt: new Date().toISOString(),
        deadline: null,
        owner: 'Shared'
      };
      
      data.tasks.push(newTask);
      
      const activeList = data.lists.find(l => l.id === targetListId);
      db.logAction(data, 'add_task', {
        taskId: newTask.id,
        taskTitle: newTask.title,
        listName: activeList ? activeList.name : 'Lista'
      });
      
      input.value = '';
      saveDataAndRender(data);
    });
  }

  // Tabs Switch Controller
  const tabs = ['Dashboard', 'Tasks', 'Calendar', 'Projects', 'Notes', 'Wishlist', 'Stats'];
  tabs.forEach(tabName => {
    const el = elements[`tab${tabName}`];
    if (el) {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        appState.activeTab = tabName.toLowerCase();
        
        if (tabName === 'Tasks') {
          appState.activeFilter = 'all';
          appState.activeListId = 'all';
        }
        
        // Remove active class from other elements
        document.querySelectorAll('.sidebar-section .nav-item').forEach(btn => btn.classList.remove('active'));
        el.classList.add('active');
        
        closeMobileSidebar();
        renderApp();
      });
    }
  });

  // Mobile Bottom Navigation Tab Switching
  if (elements.mobileBottomNav) {
    elements.mobileBottomNav.querySelectorAll('.bottom-nav-item[data-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
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

    if (elements.bottomNavBtnMore) {
      elements.bottomNavBtnMore.addEventListener('click', (e) => {
        e.preventDefault();
        elements.sidebar.classList.add('open');
        elements.sidebarOverlay.classList.add('open');
      });
    }
  }

  // Theme Toggle Button (Sidebar footer)
  if (elements.btnToggleTheme) {
    elements.btnToggleTheme.addEventListener('click', (e) => {
      e.preventDefault();
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      applyTheme(isDark ? 'light' : 'dark', true);
    });
  }

  // Settings Modal Theme Buttons
  if (elements.btnSetThemeLight) {
    elements.btnSetThemeLight.addEventListener('click', (e) => {
      e.preventDefault();
      applyTheme('light', true);
    });
  }
  if (elements.btnSetThemeDark) {
    elements.btnSetThemeDark.addEventListener('click', (e) => {
      e.preventDefault();
      applyTheme('dark', true);
    });
  }
  if (elements.btnSetThemeAuto) {
    elements.btnSetThemeAuto.addEventListener('click', (e) => {
      e.preventDefault();
      applyTheme('auto', true);
    });
  }

  // Dashboard Mural Note Preview click
  if (elements.dashboardMuralPreview) {
    elements.dashboardMuralPreview.addEventListener('click', () => {
      appState.activeTab = 'notes';
      renderApp();
    });
  }
  
  // Quick Filters Inside Tasks View
  elements.btnFilterMyTasks.addEventListener('click', () => {
    appState.quickFilter = appState.quickFilter === 'mine' ? 'none' : 'mine';
    renderTasks();
  });
  
  elements.btnFilterUrgentTasks.addEventListener('click', () => {
    appState.quickFilter = appState.quickFilter === 'urgent' ? 'none' : 'urgent';
    renderTasks();
  });
  
  elements.btnClearQuickFilters.addEventListener('click', () => {
    appState.quickFilter = 'none';
    if (appState.activeFilter === 'date') {
      appState.activeFilter = 'all';
      appState.activeListId = 'all';
    }
    renderTasks();
  });
  
  // Calendar navigations
  elements.btnPrevMonth.addEventListener('click', () => {
    appState.currentMonth.setMonth(appState.currentMonth.getMonth() - 1);
    renderCalendar();
  });
  
  elements.btnNextMonth.addEventListener('click', () => {
    appState.currentMonth.setMonth(appState.currentMonth.getMonth() + 1);
    renderCalendar();
  });
  
  // Projects Modal Events
  elements.btnOpenAddProjectModal.addEventListener('click', () => {
    elements.addProjectModal.classList.add('open');
    elements.inputProjectName.value = '';
    elements.inputProjectTargetDate.value = '';
    elements.inputProjectName.focus();
  });
  const closeAddProject = () => elements.addProjectModal.classList.remove('open');
  elements.btnCloseAddProjectModal.addEventListener('click', closeAddProject);
  elements.btnCancelAddProject.addEventListener('click', closeAddProject);
  elements.btnSaveProject.addEventListener('click', handleCreateProject);
  
  // Mural Modal Events
  elements.btnOpenAddNoteModal.addEventListener('click', () => {
    elements.addNoteModal.classList.add('open');
    elements.inputNoteText.value = '';
    elements.inputNoteText.focus();
  });
  const closeAddNote = () => elements.addNoteModal.classList.remove('open');
  elements.btnCloseAddNoteModal.addEventListener('click', closeAddNote);
  elements.btnCancelAddNote.addEventListener('click', closeAddNote);
  elements.btnSaveNote.addEventListener('click', handleCreateNote);
  
  // Wishlist Modal Events
  elements.btnOpenAddWishModal.addEventListener('click', () => {
    elements.addWishModal.classList.add('open');
    elements.inputWishTitle.value = '';
    elements.inputWishLink.value = '';
    elements.inputWishNotes.value = '';
    elements.inputWishTitle.focus();
  });
  const closeAddWish = () => elements.addWishModal.classList.remove('open');
  elements.btnCloseAddWishModal.addEventListener('click', closeAddWish);
  elements.btnCancelAddWish.addEventListener('click', closeAddWish);
  elements.btnSaveWish.addEventListener('click', handleCreateWish);
}

// Action: Switch Active User Profile
function switchUserProfile(user) {
  appState.currentUser = user;
  const config = db.getSavedConfig();
  if (config) {
    db.saveConfig(config.firebaseConfig, config.secretKey, user);
  }
  db.initFirebase(); // reinit with correct user name
  renderApp();
  updateProfileBadgeUI();
  
  notifications.showNotification("Troca de Perfil", `Agora você está usando como ${user}!`);
}

// Action: Create List form processing
function handleCreateList() {
  const listName = elements.inputListName.value.trim();
  if (!listName) return;
  
  const data = appState.dbData;
  let groupId = elements.selectListGroup.value;
  
  // Check if we need to create a new group
  if (groupId === 'NEW_GROUP') {
    const newGroupName = elements.inputNewGroupName.value.trim();
    if (!newGroupName) {
      alert("Digite o nome do novo grupo.");
      return;
    }
    
    // Create new group
    const newGroup = {
      id: 'g-' + Date.now(),
      name: newGroupName,
      createdAt: new Date().toISOString()
    };
    data.groups.push(newGroup);
    groupId = newGroup.id;
  }
  
  const listOwner = document.querySelector('input[name="list_owner"]:checked').value;
  
  // Create List
  const newList = {
    id: 'l-' + Date.now(),
    name: listName,
    groupId: groupId,
    owner: listOwner,
    createdAt: new Date().toISOString()
  };
  
  data.lists.push(newList);
  
  // Log action
  db.logAction(data, 'add_list', {
    listId: newList.id,
    listName: newList.name
  });
  
  // Close Modal and update Firebase
  elements.addListModal.classList.remove('open');
  appState.activeListId = newList.id;
  appState.activeFilter = 'list';
  
  saveDataAndRender(data);
}

// Action: Create Task form processing
function handleCreateTask() {
  const taskTitle = elements.inputTaskTitle.value.trim();
  if (!taskTitle) return;
  
  const data = appState.dbData;
  
  // Determine list ID to attach to
  let targetListId = appState.activeListId;
  
  // If active filter is 'all' or 'today', look for the first available list or fallback to default
  if (appState.activeListId === 'all' || appState.activeListId === 'today') {
    if (data.lists.length > 0) {
      targetListId = data.lists[0].id;
    } else {
      alert("Crie uma lista no menu lateral antes de adicionar tarefas.");
      return;
    }
  }
  
  const deadlineVal = elements.inputTaskDeadline.value;
  const deadline = deadlineVal ? new Date(deadlineVal).toISOString() : null;
  const owner = elements.selectTaskOwner.value;
  
  const newTask = {
    id: 't-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
    listId: targetListId,
    title: taskTitle,
    completed: false,
    completedBy: null,
    completedAt: null,
    createdBy: appState.currentUser,
    createdAt: new Date().toISOString(),
    deadline: deadline,
    owner: owner
  };
  
  data.tasks.push(newTask);
  
  // Log action
  const activeList = data.lists.find(l => l.id === targetListId);
  db.logAction(data, 'add_task', {
    taskId: newTask.id,
    taskTitle: newTask.title,
    listName: activeList ? activeList.name : 'Lista'
  });
  
  // Clear inputs
  elements.inputTaskTitle.value = '';
  elements.inputTaskDeadline.value = '';
  elements.selectTaskOwner.value = 'Shared';
  
  saveDataAndRender(data);
}

// Populate the group select element inside List modal
function populateGroupSelect() {
  const data = appState.dbData;
  if (!data) return;
  
  let html = '';
  data.groups.forEach(g => {
    html += `<option value="${g.id}">${escapeHTML(g.name)}</option>`;
  });
  
  html += `
    <option value="" disabled>──────────</option>
    <option value="NEW_GROUP">➕ Criar Novo Grupo...</option>
  `;
  
  elements.selectListGroup.innerHTML = html;
  elements.newGroupNameGroup.style.display = 'none'; // reset group input view
}

// Helper: close side nav on mobile
function closeMobileSidebar() {
  elements.sidebar.classList.remove('open');
  elements.sidebarOverlay.classList.remove('open');
}

// Helper: Escape HTML string to avoid injection
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Invite System Configuration & Helpers
function generateInviteLink() {
  const config = db.getSavedConfig();
  if (!config) return null;
  const payload = {
    firebaseConfig: config.firebaseConfig,
    secretKey: config.secretKey
  };
  const base64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  return window.location.origin + window.location.pathname + '?config=' + base64;
}

function handleIncomingInvite() {
  const params = new URLSearchParams(window.location.search);
  const configParam = params.get('config');
  if (configParam) {
    try {
      const decoded = JSON.parse(decodeURIComponent(escape(atob(configParam))));
      if (decoded.firebaseConfig && decoded.secretKey) {
        db.saveConfig(decoded.firebaseConfig, decoded.secretKey, 'Isa');
        
        // Remove the query parameter from URL
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        
        alert("Configuração importada com sucesso! Bem-vinda, Isa!");
        window.location.reload();
      }
    } catch (e) {
      console.error("Erro ao processar convite:", e);
    }
  }
}

// Calendar View Rendering
function renderCalendar() {
  const data = appState.dbData;
  if (!data) return;
  
  const year = appState.currentMonth.getFullYear();
  const month = appState.currentMonth.getMonth();
  
  // Set title
  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  elements.calendarMonthTitle.innerText = `${monthNames[month]} ${year}`;
  
  // Grid headers
  const headers = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  let html = headers.map(h => `<div class="calendar-day-header">${h}</div>`).join('');
  
  // First day of month
  const firstDayIndex = new Date(year, month, 1).getDay();
  // Number of days in month
  const totalDays = new Date(year, month + 1, 0).getDate();
  // Number of days in previous month
  const prevTotalDays = new Date(year, month, 0).getDate();
  
  // Previous month filler days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = prevTotalDays - i;
    html += `
      <div class="calendar-cell other-month">
        <div class="calendar-date-number">${dayNum}</div>
      </div>
    `;
  }
  
  // Current month days
  const today = new Date();
  for (let day = 1; day <= totalDays; day++) {
    const cellDate = new Date(year, month, day);
    const isTodayStr = cellDate.toDateString() === today.toDateString() ? 'today' : '';
    
    // Find tasks for this day
    const dayTasks = data.tasks.filter(t => {
      if (!t.deadline) return false;
      const taskDate = new Date(t.deadline);
      return taskDate.getFullYear() === year &&
             taskDate.getMonth() === month &&
             taskDate.getDate() === day;
    });
    
    let dotsHtml = '';
    if (dayTasks.length > 0) {
      dotsHtml = `<div class="calendar-tasks-indicator">`;
      dayTasks.forEach(t => {
        let dotColor = '#64748b'; // Shared/Default
        if (t.owner === 'Gus') dotColor = 'var(--color-gus)';
        if (t.owner === 'Isa') dotColor = 'var(--color-isa)';
        
        const completedStyle = t.completed ? 'opacity: 0.4;' : '';
        const titleText = escapeHTML(t.title) + (t.completed ? ' (Concluída)' : '');
        
        dotsHtml += `
          <span class="calendar-task-dot" style="background-color: ${dotColor}; ${completedStyle}" title="${titleText}"></span>
        `;
      });
      dotsHtml += `</div>`;
    }
    
    html += `
      <div class="calendar-cell ${isTodayStr}" data-day="${day}" style="cursor: pointer;">
        <div class="calendar-date-number">${day}</div>
        ${dotsHtml}
      </div>
    `;
  }
  
  // Next month filler days (fill up to multiples of 7)
  const totalCellsUsed = firstDayIndex + totalDays;
  const remainingCells = (7 - (totalCellsUsed % 7)) % 7;
  for (let i = 1; i <= remainingCells; i++) {
    html += `
      <div class="calendar-cell other-month">
        <div class="calendar-date-number">${i}</div>
      </div>
    `;
  }
  
  elements.calendarGrid.innerHTML = html;
  
  // Click on a calendar day switches to tasks view with that day's filter
  elements.calendarGrid.querySelectorAll('.calendar-cell:not(.other-month)').forEach(cell => {
    cell.addEventListener('click', () => {
      const dayNum = parseInt(cell.getAttribute('data-day'));
      const targetDate = new Date(year, month, dayNum);
      
      appState.activeTab = 'tasks';
      appState.activeFilter = 'date';
      appState.selectedDate = targetDate;
      
      // Update sidebar active class
      document.querySelectorAll('.sidebar-section .nav-item').forEach(el => el.classList.remove('active'));
      elements.tabTasks.classList.add('active');
      
      renderApp();
    });
  });
}

// Projects (Goals) View Rendering & Helpers
function renderProjects() {
  const data = appState.dbData;
  if (!data) return;
  
  const projects = data.projects || [];
  let html = '';
  
  projects.forEach(project => {
    const target = new Date(project.targetDate);
    const diffDays = Math.ceil((target - new Date()) / (1000 * 60 * 60 * 24));
    const daysRemainingText = diffDays > 0 ? `${diffDays} dias restantes` : (diffDays === 0 ? "Hoje!" : `Atrasado há ${Math.abs(diffDays)} dias`);
    const countdownClass = diffDays <= 7 ? 'project-countdown-chip urgent' : 'project-countdown-chip';
    
    const projectTasks = data.tasks.filter(t => t.projectId === project.id);
    const completed = projectTasks.filter(t => t.completed).length;
    const total = projectTasks.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    const tasksHtml = projectTasks.map(t => `
      <div class="project-task-item" style="display: flex; align-items: center; justify-content: space-between; font-size: 13px; padding: 4px 0; border-bottom: 1px solid rgba(0,0,0,0.02);">
        <span style="${t.completed ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${escapeHTML(t.title)}</span>
        <div style="display: flex; gap: 8px; align-items: center;">
          <input type="checkbox" ${t.completed ? 'checked' : ''} class="project-task-toggle" data-task-id="${t.id}" style="cursor: pointer;">
          <button class="project-task-delete" data-task-id="${t.id}" style="font-size: 11px; background: none; border: none; cursor: pointer; padding: 0;">🗑️</button>
        </div>
      </div>
    `).join('');
    
    html += `
      <div class="project-card" data-project-id="${project.id}">
        <button class="project-delete-btn" data-project-id="${project.id}" style="border: none; background: none; cursor: pointer; font-size: 16px;">✕</button>
        <span class="${countdownClass}">${daysRemainingText}</span>
        <h4 class="project-title" style="margin: 0.5rem 0;">${escapeHTML(project.name)}</h4>
        
        <!-- Progress bar -->
        <div class="project-progress">
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; color: var(--color-on-surface-variant);">
            <span>Progresso</span>
            <span>${percentage}% (${completed}/${total})</span>
          </div>
          <div style="height: 6px; background-color: var(--color-surface-container); border-radius: var(--radius-full); overflow: hidden;">
            <div style="width: ${percentage}%; height: 100%; background-color: var(--color-primary); border-radius: var(--radius-full); transition: width 0.3s ease;"></div>
          </div>
        </div>
        
        <!-- Tasks list -->
        <div class="project-tasks-list" style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem; max-height: 150px; overflow-y: auto;">
          ${tasksHtml || '<p style="font-size: 12px; color: var(--color-outline); font-style: italic; margin: 0;">Nenhuma tarefa vinculada.</p>'}
        </div>
        
        <!-- Add task input -->
        <div style="display: flex; gap: 6px; margin-top: auto; padding-top: 0.5rem; border-top: 1px dashed rgba(0,0,0,0.05);">
          <input type="text" class="input-project-task-add" placeholder="Nova tarefa da meta..." style="flex: 1; font-size: 12px; padding: 4px 8px; border: var(--border-standard); border-radius: var(--radius-sm); outline: none;">
          <button class="btn-project-task-add-submit" style="padding: 4px 8px; font-size: 12px; background-color: var(--color-primary); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer;">+</button>
        </div>
      </div>
    `;
  });
  
  elements.projectsListContainer.innerHTML = html || '<p style="color: var(--color-outline); font-style: italic; width: 100%; text-align: center;">Nenhum projeto ou grande meta cadastrada.</p>';
  
  // Bind listeners
  elements.projectsListContainer.querySelectorAll('.project-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pId = btn.getAttribute('data-project-id');
      handleDeleteProject(pId);
    });
  });
  
  elements.projectsListContainer.querySelectorAll('.project-task-toggle').forEach(chk => {
    chk.addEventListener('change', () => {
      const taskId = chk.getAttribute('data-task-id');
      toggleTaskCompletion(taskId, chk.checked);
    });
  });
  
  elements.projectsListContainer.querySelectorAll('.project-task-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const taskId = btn.getAttribute('data-task-id');
      handleDeleteTask(taskId);
    });
  });
  
  elements.projectsListContainer.querySelectorAll('.input-project-task-add').forEach(input => {
    const card = input.closest('.project-card');
    const pId = card.getAttribute('data-project-id');
    const btn = card.querySelector('.btn-project-task-add-submit');
    
    const submitProjTask = () => {
      const title = input.value.trim();
      if (title) {
        handleAddProjectTask(pId, title);
      }
    };
    
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        submitProjTask();
      }
    });
    btn.addEventListener('click', submitProjTask);
  });
}

function handleCreateProject() {
  const name = elements.inputProjectName.value.trim();
  const targetDateVal = elements.inputProjectTargetDate.value;
  if (!name || !targetDateVal) return;
  
  const data = appState.dbData;
  const targetDate = new Date(targetDateVal).toISOString();
  
  const newProject = {
    id: 'p-' + Date.now(),
    name: name,
    targetDate: targetDate,
    createdAt: new Date().toISOString()
  };
  
  data.projects = data.projects || [];
  data.projects.push(newProject);
  
  db.logAction(data, 'add_project', {
    projectId: newProject.id,
    projectName: newProject.name
  });
  
  elements.addProjectModal.classList.remove('open');
  saveDataAndRender(data);
}

function handleDeleteProject(projectId) {
  const data = appState.dbData;
  data.projects = data.projects || [];
  const project = data.projects.find(p => p.id === projectId);
  if (!project) return;
  
  if (confirm(`Deseja mesmo remover a meta "${project.name}"?`)) {
    data.projects = data.projects.filter(p => p.id !== projectId);
    
    // Dissociate tasks
    data.tasks.forEach(t => {
      if (t.projectId === projectId) {
        delete t.projectId;
      }
    });
    
    db.logAction(data, 'delete_project', {
      projectId: projectId,
      projectName: project.name
    });
    
    saveDataAndRender(data);
  }
}

function handleAddProjectTask(projectId, title) {
  if (!title.trim()) return;
  const data = appState.dbData;
  
  const newTask = {
    id: 't-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
    listId: data.lists.length > 0 ? data.lists[0].id : 'l-geral',
    projectId: projectId,
    title: title,
    completed: false,
    completedBy: null,
    completedAt: null,
    createdBy: appState.currentUser,
    createdAt: new Date().toISOString(),
    deadline: null,
    owner: 'Shared'
  };
  data.tasks.push(newTask);
  
  db.logAction(data, 'add_task', {
    taskId: newTask.id,
    taskTitle: newTask.title,
    listName: 'Meta/Projeto'
  });
  
  saveDataAndRender(data);
}

// Mural (Sticky Notes) View Rendering & Helpers
function renderNotes() {
  const data = appState.dbData;
  if (!data) return;
  
  const notes = data.notes || [];
  
  // Sort notes: newest first
  notes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  let html = '';
  notes.forEach((note, index) => {
    const rotation = (index % 3 - 1) * (1.5 + (index % 2) * 0.5); // pseudo-random rotation
    const dateStr = new Date(note.timestamp).toLocaleString('pt-BR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
    
    const deleteBtn = `<button class="note-delete-btn" data-note-id="${note.id}" style="border: none; background: none; cursor: pointer; font-size: 14px; margin-left: 8px;">🗑️</button>`;
    
    html += `
      <div class="note-card note-${note.color || 'yellow'}" style="transform: rotate(${rotation}deg); margin-top: 10px;">
        <div class="note-text">${escapeHTML(note.text)}</div>
        <div class="note-footer" style="display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: var(--color-outline); margin-top: 1rem; border-top: 1px dashed rgba(0,0,0,0.08); padding-top: 0.5rem;">
          <span>Por ${note.user} em ${dateStr}</span>
          ${deleteBtn}
        </div>
      </div>
    `;
  });
  
  elements.notesGrid.innerHTML = html || '<p style="color: var(--color-outline); text-align: center; width: 100%; font-style: italic; margin-top: 2rem;">Nenhum recado no mural ainda. Deixe uma mensagem carinhosa!</p>';
  
  // Delete note listeners
  elements.notesGrid.querySelectorAll('.note-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const noteId = btn.getAttribute('data-note-id');
      handleDeleteNote(noteId);
    });
  });
}

function handleCreateNote() {
  const text = elements.inputNoteText.value.trim();
  if (!text) return;
  
  const data = appState.dbData;
  const colorInput = document.querySelector('input[name="note_color"]:checked');
  const color = colorInput ? colorInput.value : 'yellow';
  
  const newNote = {
    id: 'n-' + Date.now(),
    user: appState.currentUser,
    text: text,
    color: color,
    timestamp: new Date().toISOString()
  };
  
  data.notes = data.notes || [];
  data.notes.push(newNote);
  
  db.logAction(data, 'add_note', {
    noteId: newNote.id,
    noteText: newNote.text.substr(0, 15) + (newNote.text.length > 15 ? '...' : '')
  });
  
  elements.inputNoteText.value = '';
  elements.addNoteModal.classList.remove('open');
  
  saveDataAndRender(data);
}

function handleDeleteNote(noteId) {
  const data = appState.dbData;
  data.notes = data.notes || [];
  const note = data.notes.find(n => n.id === noteId);
  if (!note) return;
  
  if (confirm("Deseja mesmo remover este recado?")) {
    data.notes = data.notes.filter(n => n.id !== noteId);
    
    db.logAction(data, 'delete_note', {
      noteId: noteId,
      noteText: note.text.substr(0, 15) + (note.text.length > 15 ? '...' : '')
    });
    
    saveDataAndRender(data);
  }
}

// Wishlist View Rendering & Helpers
function renderWishlist() {
  const data = appState.dbData;
  if (!data) return;
  
  const wishes = data.wishlist || [];
  
  // Filter into Gus, Isa, Shared
  const gusWishes = wishes.filter(w => w.user === 'Gus');
  const isaWishes = wishes.filter(w => w.user === 'Isa');
  const sharedWishes = wishes.filter(w => w.user === 'Shared');
  
  const renderGrid = (gridEl, list) => {
    let html = list.map(wish => {
      const linkHtml = wish.link ? `<a href="${escapeHTML(wish.link)}" target="_blank" class="btn-secondary" style="font-size: 11px; padding: 2px 6px; text-decoration: none; display: inline-block;">🔗 Link</a>` : '';
      const notesHtml = wish.notes ? `<p style="font-size: 12px; color: var(--color-on-surface-variant); margin-top: 4px; font-style: italic; margin-bottom: 0;">${escapeHTML(wish.notes)}</p>` : '';
      return `
        <div class="wish-card" style="background-color: var(--color-surface); border: var(--border-standard); border-radius: var(--radius-lg); padding: 1rem; box-shadow: var(--shadow-level-1); display: flex; flex-direction: column; gap: 0.5rem; position: relative;">
          <button class="wish-delete-btn" data-wish-id="${wish.id}" style="position: absolute; top: 0.5rem; right: 0.5rem; border: none; background: none; cursor: pointer; color: var(--color-outline); opacity: 0.5;">✕</button>
          <h4 style="margin: 0; font-size: 15px; font-weight: 700; word-break: break-word; padding-right: 1.5rem;">${escapeHTML(wish.title)}</h4>
          ${notesHtml}
          <div style="margin-top: auto; display: flex; align-items: center; justify-content: space-between; padding-top: 0.5rem; border-top: 1px dashed rgba(0,0,0,0.02);">
            ${linkHtml}
            <span style="font-size: 9px; color: var(--color-outline);">De: ${wish.createdBy || 'Sistema'}</span>
          </div>
        </div>
      `;
    }).join('');
    
    gridEl.innerHTML = html || '<p style="color: var(--color-outline); font-style: italic; font-size: 12px; margin: 10px 0;">Nenhum desejo listado.</p>';
  };
  
  renderGrid(elements.wishlistGus, gusWishes);
  renderGrid(elements.wishlistIsa, isaWishes);
  renderGrid(elements.wishlistShared, sharedWishes);
  
  // Delete wish listeners
  document.querySelectorAll('.wish-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const wishId = btn.getAttribute('data-wish-id');
      handleDeleteWish(wishId);
    });
  });
}

function handleCreateWish() {
  const title = elements.inputWishTitle.value.trim();
  if (!title) return;
  
  const data = appState.dbData;
  const link = elements.inputWishLink.value.trim();
  const notes = elements.inputWishNotes.value.trim();
  const ownerInput = document.querySelector('input[name="wish_owner"]:checked');
  const owner = ownerInput ? ownerInput.value : 'Shared';
  
  const newWish = {
    id: 'w-' + Date.now(),
    user: owner,
    title: title,
    link: link,
    notes: notes,
    createdBy: appState.currentUser,
    timestamp: new Date().toISOString()
  };
  
  data.wishlist = data.wishlist || [];
  data.wishlist.push(newWish);
  
  db.logAction(data, 'add_wish', {
    wishId: newWish.id,
    wishTitle: newWish.title
  });
  
  // Reset form and close modal
  elements.inputWishTitle.value = '';
  elements.inputWishLink.value = '';
  elements.inputWishNotes.value = '';
  elements.addWishModal.classList.remove('open');
  
  saveDataAndRender(data);
}

function handleDeleteWish(wishId) {
  const data = appState.dbData;
  data.wishlist = data.wishlist || [];
  const wish = data.wishlist.find(w => w.id === wishId);
  if (!wish) return;
  
  if (confirm(`Deseja mesmo remover "${wish.title}" de desejos?`)) {
    data.wishlist = data.wishlist.filter(w => w.id !== wishId);
    
    db.logAction(data, 'delete_wish', {
      wishId: wishId,
      wishTitle: wish.title
    });
    
    saveDataAndRender(data);
  }
}

// Stats & Achievements Rendering
function renderStats() {
  const data = appState.dbData;
  if (!data) return;
  
  // 1. Calculate weekly completions
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const completedTasks = data.tasks.filter(t => t.completed);
  
  const gusCompletions = completedTasks.filter(t => t.completedBy === 'Gus').length;
  const isaCompletions = completedTasks.filter(t => t.completedBy === 'Isa').length;
  
  // Completions in the last week
  const weeklyCompleted = completedTasks.filter(t => {
    if (!t.completedAt) return false;
    return new Date(t.completedAt) >= oneWeekAgo;
  });
  
  const gusWeekly = weeklyCompleted.filter(t => t.completedBy === 'Gus').length;
  const isaWeekly = weeklyCompleted.filter(t => t.completedBy === 'Isa').length;
  
  let championText = "Empate técnico esta semana! ⚖️";
  if (gusWeekly > isaWeekly) {
    championText = `🧔 Gus é o campeão da semana com ${gusWeekly} tarefas! 🏆`;
  } else if (isaWeekly > gusWeekly) {
    championText = `👩 Isa é a campeã da semana com ${isaWeekly} tarefas! 🏆`;
  }
  
  // Render weekly summary block
  elements.statsSummaryContainer.innerHTML = `
    <div class="stats-summary-card" style="background-color: var(--color-surface); padding: 1.5rem; border-radius: var(--radius-xl); border: var(--border-standard); box-shadow: var(--shadow-level-1); text-align: center; width: 100%;">
      <h4 style="margin: 0 0 0.5rem 0; font-size: 16px; color: var(--color-on-surface-variant);">Campeão da Semana</h4>
      <p style="font-size: 18px; font-weight: 700; margin: 0; color: var(--color-primary);">${championText}</p>
      
      <div style="display: flex; justify-content: space-around; margin-top: 1.5rem; border-top: 1px dashed rgba(0,0,0,0.05); padding-top: 1.25rem;">
        <div>
          <div style="font-size: 24px;">🧔</div>
          <div style="font-size: 12px; color: var(--color-outline);">Gus (Total)</div>
          <div style="font-size: 20px; font-weight: 700;">${gusCompletions}</div>
          <div style="font-size: 11px; color: var(--color-on-surface-variant);">(Esta semana: ${gusWeekly})</div>
        </div>
        <div>
          <div style="font-size: 24px;">👩</div>
          <div style="font-size: 12px; color: var(--color-outline);">Isa (Total)</div>
          <div style="font-size: 20px; font-weight: 700;">${isaCompletions}</div>
          <div style="font-size: 11px; color: var(--color-on-surface-variant);">(Esta semana: ${isaWeekly})</div>
        </div>
      </div>
    </div>
  `;
  
  // 2. Compute Achievements
  const notesCount = (data.notes || []).length;
  const projectsCount = (data.projects || []).length;
  const listsCount = data.lists.length;
  
  // Count reactions received by current user (reactions inside history logs where log.user is currentUser)
  let reactionsReceived = 0;
  (data.history || []).forEach(log => {
    if (log.user === appState.currentUser && log.reactions) {
      reactionsReceived += Object.keys(log.reactions).length;
    }
  });
  
  const totalCompletions = completedTasks.filter(t => t.completedBy === appState.currentUser).length;
  
  const achievements = [
    {
      id: "first-steps",
      title: "Primeiros Passos",
      desc: "Concluiu sua primeira tarefa",
      icon: "🌱",
      unlocked: totalCompletions >= 1
    },
    {
      id: "strong-partner",
      title: "Parceria Forte",
      desc: "Concluiu 10 tarefas no aplicativo",
      icon: "🤝",
      unlocked: totalCompletions >= 10
    },
    {
      id: "super-productive",
      title: "Super Produtivo",
      desc: "Concluiu 30 tarefas no aplicativo",
      icon: "⚡",
      unlocked: totalCompletions >= 30
    },
    {
      id: "organizer",
      title: "Mestre da Organização",
      desc: "Criou pelo menos 3 listas diferentes",
      icon: "🗂️",
      unlocked: listsCount >= 3
    },
    {
      id: "mural-master",
      title: "Mensageiro do Amor",
      desc: "Deixou recados fofos no mural",
      icon: "💖",
      unlocked: notesCount >= 2
    },
    {
      id: "dreamer",
      title: "Sonhador do Casal",
      desc: "Criou pelo menos 2 grandes metas",
      icon: "✈️",
      unlocked: projectsCount >= 2
    },
    {
      id: "love-reaction",
      title: "Amor em Gestos",
      desc: "Recebeu 3 reações do seu parceiro",
      icon: "💝",
      unlocked: reactionsReceived >= 3
    }
  ];
  
  elements.achievementsGrid.innerHTML = achievements.map(ach => {
    const stateClass = ach.unlocked ? 'unlocked' : 'locked';
    return `
      <div class="achievement-card ${stateClass}" style="display: flex; align-items: center; gap: 1rem; padding: 1rem; border: var(--border-standard); border-radius: var(--radius-lg); opacity: ${ach.unlocked ? '1' : '0.5'}; transition: box-shadow 0.2s;">
        <span style="font-size: 2.25rem;">${ach.icon}</span>
        <div>
          <h4 style="margin: 0; font-size: 14px; font-weight: 700;">${escapeHTML(ach.title)}</h4>
          <p style="margin: 4px 0 0 0; font-size: 11px; color: var(--color-on-surface-variant);">${escapeHTML(ach.desc)}</p>
          <span style="font-size: 9px; font-weight: 700; color: ${ach.unlocked ? 'var(--color-success)' : 'var(--color-outline)'}; margin-top: 4px; display: inline-block;">
            ${ach.unlocked ? '🔓 Desbloqueada' : '🔒 Bloqueada'}
          </span>
        </div>
      </div>
    `;
  }).join('');
}

// Subtasks completion & comment additions helpers
function toggleSubtaskCompletion(taskId, subtaskId, isChecked) {
  const data = appState.dbData;
  const task = data.tasks.find(t => t.id === taskId);
  if (!task) return;
  
  task.subtasks = task.subtasks || [];
  const subtask = task.subtasks.find(st => st.id === subtaskId);
  if (subtask) {
    subtask.completed = isChecked;
    saveDataAndRender(data);
  }
}

function handleDeleteSubtask(taskId, subtaskId) {
  const data = appState.dbData;
  const task = data.tasks.find(t => t.id === taskId);
  if (!task) return;
  
  task.subtasks = task.subtasks || [];
  task.subtasks = task.subtasks.filter(st => st.id !== subtaskId);
  saveDataAndRender(data);
}

function handleAddSubtask(taskId, title) {
  const data = appState.dbData;
  const task = data.tasks.find(t => t.id === taskId);
  if (!task) return;
  
  task.subtasks = task.subtasks || [];
  const newSubtask = {
    id: 'st-' + Date.now(),
    title: title,
    completed: false
  };
  task.subtasks.push(newSubtask);
  saveDataAndRender(data);
}

function handleAddComment(taskId, text) {
  const data = appState.dbData;
  const task = data.tasks.find(t => t.id === taskId);
  if (!task) return;
  
  task.comments = task.comments || [];
  const newComment = {
    id: 'c-' + Date.now(),
    user: appState.currentUser,
    text: text,
    timestamp: new Date().toISOString()
  };
  task.comments.push(newComment);
  saveDataAndRender(data);
}

function handleTaskPriorityChange(taskId, priority) {
  const data = appState.dbData;
  const task = data.tasks.find(t => t.id === taskId);
  if (!task) return;
  
  task.priority = priority;
  saveDataAndRender(data);
}

function handleTaskRecurrenceChange(taskId, recurrence) {
  const data = appState.dbData;
  const task = data.tasks.find(t => t.id === taskId);
  if (!task) return;
  
  task.recurrence = recurrence;
  saveDataAndRender(data);
}

function handleTaskOwnerChange(taskId, owner) {
  const data = appState.dbData;
  const task = data.tasks.find(t => t.id === taskId);
  if (!task) return;
  
  task.owner = owner;
  saveDataAndRender(data);
}

function handleTaskDeadlineChange(taskId, deadline) {
  const data = appState.dbData;
  const task = data.tasks.find(t => t.id === taskId);
  if (!task) return;
  
  task.deadline = deadline;
  saveDataAndRender(data);
}

// History drawer reactions and undo actions helpers
function handleHistoryReaction(logId, emoji) {
  const data = appState.dbData;
  const log = data.history.find(h => h.id === logId);
  if (!log) return;
  
  log.reactions = log.reactions || {};
  
  if (log.reactions[appState.currentUser] === emoji) {
    delete log.reactions[appState.currentUser];
  } else {
    log.reactions[appState.currentUser] = emoji;
  }
  
  saveDataAndRender(data);
}

function handleHistoryUndo(logId) {
  const data = appState.dbData;
  const logIndex = data.history.findIndex(h => h.id === logId);
  if (logIndex === -1) return;
  
  const log = data.history[logIndex];
  
  if (log.action === 'complete_task') {
    const task = data.tasks.find(t => t.id === log.taskId);
    if (task) {
      task.completed = false;
      task.completedBy = null;
      task.completedAt = null;
    }
  } else if (log.action === 'add_task') {
    data.tasks = data.tasks.filter(t => t.id !== log.taskId);
  } else if (log.action === 'add_list') {
    data.lists = data.lists.filter(l => l.id !== log.listId);
    data.tasks = data.tasks.filter(t => t.listId !== log.listId);
  } else if (log.action === 'add_note') {
    data.notes = (data.notes || []).filter(n => n.id !== log.noteId);
  } else if (log.action === 'add_wish') {
    data.wishlist = (data.wishlist || []).filter(w => w.id !== log.wishId);
  }
  
  // Remove the action log and log the undo
  data.history.splice(logIndex, 1);
  
  db.logAction(data, 'undo_action', {
    undoAction: log.action,
    undoUser: log.user
  });
  
  saveDataAndRender(data);
}

// Recurrence checker and cloner logic (silent background cron)
function checkRecurrenceAndClone(data) {
  if (!data || !data.tasks) return;
  
  const now = new Date();
  const tasksToProcess = [...data.tasks];
  
  tasksToProcess.forEach(task => {
    if (task.completed && task.recurrence && task.recurrence !== 'none') {
      const completedAt = task.completedAt ? new Date(task.completedAt) : new Date(task.createdAt);
      let shouldClone = false;
      
      const diffTime = now - completedAt;
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      
      if (task.recurrence === 'daily' && diffDays >= 1) {
        shouldClone = true;
      } else if (task.recurrence === 'weekly' && diffDays >= 7) {
        shouldClone = true;
      } else if (task.recurrence === 'monthly' && diffDays >= 30) {
        shouldClone = true;
      }
      
      if (shouldClone) {
        const clonedTask = {
          ...task,
          id: 't-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          completed: false,
          completedBy: null,
          completedAt: null,
          createdAt: now.toISOString(),
          lastRecurrentTrigger: now.toISOString()
        };
        
        // Remove recurrence from completed task so it doesn't duplicate cycle
        const originalRecurrence = task.recurrence;
        task.recurrence = 'none';
        
        data.tasks.push(clonedTask);
        
        db.logAction(data, 'add_task', {
          taskId: clonedTask.id,
          taskTitle: clonedTask.title + ` (Recorrente ${originalRecurrence})`,
          listName: 'Rotina Automática'
        });
      }
    }
  });
}
