import * as db from './firebase-db.js';
import * as notifications from './notifications.js';

// Application State
let appState = {
  dbData: null,
  activeListId: 'all', // 'all', 'today', or specific list ID
  activeFilter: 'all',  // 'all', 'today'
  currentUser: 'Gus',
  secretKey: ''
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
  
  // Header
  activeListTitle: document.getElementById('activeListTitle'),
  activeListOwnerBadge: document.getElementById('activeListOwnerBadge'),
  progressText: document.getElementById('progressText'),
  progressBarFill: document.getElementById('progressBarFill'),
  
  // Task Views
  mainContent: document.getElementById('mainContent'),
  todoTaskList: document.getElementById('todoTaskList'),
  completedTaskList: document.getElementById('completedTaskList'),
  todoCount: document.getElementById('todoCount'),
  completedCount: document.getElementById('completedCount'),
  todoSection: document.getElementById('todoSection'),
  completedSection: document.getElementById('completedSection'),
  emptyStateView: document.getElementById('emptyStateView'),
  
  // Lists
  listsContainer: document.getElementById('listsContainer'),
  badgeCountAll: document.getElementById('badgeCountAll'),
  badgeCountToday: document.getElementById('badgeCountToday'),
  
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
  
  // Forms & Inputs
  addTaskForm: document.getElementById('addTaskForm'),
  inputTaskTitle: document.getElementById('inputTaskTitle'),
  inputTaskDeadline: document.getElementById('inputTaskDeadline'),
  selectedDeadlineText: document.getElementById('selectedDeadlineText'),
  selectTaskOwner: document.getElementById('selectTaskOwner'),
  currentUserBadge: document.getElementById('currentUserBadge'),
  
  // Setup Overlay
  setupOverlay: document.getElementById('setupOverlay'),
  setupForm: document.getElementById('setupForm'),
  setupSecretKey: document.getElementById('setupSecretKey'),
  setupDbUrl: document.getElementById('setupDbUrl'),
  setupApiKey: document.getElementById('setupApiKey'),
  setupProjectId: document.getElementById('setupProjectId')
};

// Initial Setup Check
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkConfiguration();
});

// Check if app has database config
function checkConfiguration() {
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
  
  // Render entire UI
  elements.mainContent.style.display = 'flex';
  renderApp();
}

// Render the application interface
function renderApp() {
  renderProfileBadge();
  renderSidebar();
  renderTasks();
  renderHistory();
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
  elements.badgeCountToday.innerText = openTasks.filter(t => t.deadline).length;
  
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
      const isSelected = appState.activeListId === list.id;
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
      appState.activeListId = listId;
      appState.activeFilter = 'list';
      
      // Remove active classes
      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      
      closeMobileSidebar();
      renderTasks();
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
  
  let listTitle = "Todas as Tarefas";
  let listOwner = "Shared";
  let filteredTasks = [...data.tasks];
  
  // Apply filtering
  if (appState.activeFilter === 'today') {
    listTitle = "Com Prazos Limites";
    filteredTasks = filteredTasks.filter(t => t.deadline);
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
  
  // Header title update
  elements.activeListTitle.innerText = listTitle;
  
  // Owner Badge
  elements.activeListOwnerBadge.className = 'list-owner-badge';
  if (listOwner === 'Gus') {
    elements.activeListOwnerBadge.innerText = 'Lista de Gus';
    elements.activeListOwnerBadge.classList.add('badge-gus');
    elements.activeListOwnerBadge.style.display = 'inline-block';
  } else if (listOwner === 'Isa') {
    elements.activeListOwnerBadge.innerText = 'Lista de Isa';
    elements.activeListOwnerBadge.classList.add('badge-isa');
    elements.activeListOwnerBadge.style.display = 'inline-block';
  } else {
    elements.activeListOwnerBadge.innerText = 'Lista Compartilhada';
    elements.activeListOwnerBadge.classList.add('badge-shared');
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
  
  return `
    <div class="task-card ${isCompleted ? 'completed' : ''}" data-task-id="${task.id}">
      <label class="checkbox-container">
        <input type="checkbox" class="task-checkbox" ${isCompleted ? 'checked' : ''}>
        <span class="checkmark"></span>
      </label>
      
      <div class="task-card-content">
        <div class="task-title">${escapeHTML(task.title)}</div>
        <div class="task-meta-row">
          <span class="task-meta-chip ${ownerChipClass}">${ownerName}</span>
          ${deadlineInfo.text ? `<span class="task-meta-chip deadline-badge ${deadlineInfo.class}">${deadlineInfo.text}</span>` : ''}
          ${isCompleted && task.completedBy ? `<span class="task-meta-chip" style="font-style: italic; background-color: var(--color-surface-container);">Concluído por: ${task.completedBy}</span>` : ''}
          <span class="task-meta-chip" style="font-size: 10px; color: var(--color-outline); font-weight: normal; background: transparent; padding: 0;">Criado por: ${task.createdBy}</span>
        </div>
      </div>
      
      <button class="task-action-btn btn-delete-task" title="Excluir Tarefa">🗑️</button>
    </div>
  `;
}

// Add event handlers to task cards
function addTaskListeners() {
  // Checkbox toggle
  document.querySelectorAll('.task-checkbox').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const card = chk.closest('.task-card');
      const taskId = card.getAttribute('data-task-id');
      toggleTaskCompletion(taskId, chk.checked);
    });
  });
  
  // Delete button
  document.querySelectorAll('.btn-delete-task').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const card = btn.closest('.task-card');
      const taskId = card.getAttribute('data-task-id');
      handleDeleteTask(taskId);
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
    }
    
    return `
      <div class="history-item">
        <div class="history-marker ${colorClass}">${icon}</div>
        <div class="history-text">
          <strong>${log.user}</strong> ${text}
          <span class="history-time">${time}</span>
        </div>
      </div>
    `;
  }).join('');
  
  elements.historyList.innerHTML = historyHtml || '<p class="body-sm" style="color: var(--color-outline); text-align: center; margin-top: 2rem;">Nenhuma atividade registrada ainda.</p>';
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
  
  // Optimistic UI Render
  renderApp();
  
  // Push database update
  db.updateDatabase(data).catch(err => {
    alert("Erro ao salvar alteração. Tente novamente.");
    console.error(err);
  });
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
  
  renderApp();
  db.updateDatabase(data).catch(console.error);
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
  
  renderApp();
  db.updateDatabase(data).catch(console.error);
}

// Register DOM and UI Event Listeners
function setupEventListeners() {
  // Mobile Sidebar Toggle
  elements.btnToggleMenu.addEventListener('click', () => {
    elements.sidebar.classList.add('open');
    elements.sidebarOverlay.classList.add('open');
  });
  
  elements.sidebarOverlay.addEventListener('click', closeMobileSidebar);
  
  // Smart filter navigation click handlers
  elements.filterAll.addEventListener('click', (e) => {
    e.preventDefault();
    appState.activeFilter = 'all';
    appState.activeListId = 'all';
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    elements.filterAll.classList.add('active');
    
    closeMobileSidebar();
    renderTasks();
  });
  
  elements.filterToday.addEventListener('click', (e) => {
    e.preventDefault();
    appState.activeFilter = 'today';
    appState.activeListId = 'today';
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    elements.filterToday.classList.add('active');
    
    closeMobileSidebar();
    renderTasks();
  });
  
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
  
  // Handle displaying deadline text in form
  elements.inputTaskDeadline.addEventListener('change', () => {
    const val = elements.inputTaskDeadline.value;
    if (val) {
      const d = new Date(val);
      elements.selectedDeadlineText.innerText = d.toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      });
    } else {
      elements.selectedDeadlineText.innerText = "Sem limite";
    }
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
  });
  
  elements.btnCloseSettingsModal.addEventListener('click', () => elements.settingsModal.classList.remove('open'));
  elements.btnConfirmCloseSettings.addEventListener('click', () => elements.settingsModal.classList.remove('open'));
  
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
  
  renderApp();
  db.updateDatabase(data).catch(console.error);
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
    deadline: deadline
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
  elements.selectedDeadlineText.innerText = 'Sem limite';
  elements.selectTaskOwner.value = 'Shared';
  
  renderApp();
  db.updateDatabase(data).catch(console.error);
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
