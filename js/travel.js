/* ============================================
   LifeTracker — Travel Page
   ============================================ */

const Travel = (() => {
  let currentUser = null;
  let travelGroups = [];
  let travelTasks = [];
  let sortableInstances = {};
  let editingTaskId = null;
  let currentDirection = 'moniaive';

  const escapeHtml = Utils.escapeHtml;
  const getColourForGroup = Utils.getColourForGroup;
  const formatFullDate = Utils.formatFullDate;
  const isDarkMode = Utils.isDarkMode;

  /* ---------- Init ---------- */

  async function init(user) {
    currentUser = user;

    // Restore saved direction
    currentDirection = localStorage.getItem('lt_travel_direction') || 'moniaive';

    // Seed travel groups if needed
    await Store.seedTravelGroups();

    // Real-time listeners
    Store.onTravelGroupsChanged(groups => {
      travelGroups = groups;
      render();
    });

    Store.onTravelTasksChanged(tasks => {
      travelTasks = tasks;
      render();
    });

    initEventListeners();
    updateDirectionUI();
  }

  /* ---------- Direction ---------- */

  function updateDirectionUI() {
    document.querySelectorAll('.direction-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.direction === currentDirection);
    });
  }

  function setDirection(dir) {
    currentDirection = dir;
    localStorage.setItem('lt_travel_direction', dir);
    updateDirectionUI();
    render();
  }

  /* ---------- Filtering ---------- */

  function isVisible(task) {
    return task.applies_to === 'both' || task.applies_to === currentDirection;
  }

  /* ---------- Rendering ---------- */

  function render() {
    const container = document.getElementById('travel-groups-container');
    const oldCollapseState = {};

    container.querySelectorAll('.group').forEach(el => {
      const gid = el.dataset.groupId;
      const taskList = el.querySelector('.task-list');
      if (gid && taskList) {
        oldCollapseState[gid] = taskList.classList.contains('collapsed');
      }
    });

    container.innerHTML = '';

    travelGroups.forEach(group => {
      const groupEl = document.createElement('section');
      groupEl.className = 'group';
      groupEl.dataset.groupId = group.id;

      const colours = getColourForGroup(group.color);
      const allGroupTasks = travelTasks
        .filter(t => t.group_id === group.id)
        .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
      const visibleTasks = allGroupTasks.filter(isVisible);

      const isCollapsed = oldCollapseState[group.id] !== undefined
        ? oldCollapseState[group.id]
        : group.is_collapsed;

      groupEl.innerHTML = `
        <div class="group-header" style="background: linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(0,0,0,0.4) 100%), ${colours.header}">
          <button class="collapse-btn ${isCollapsed ? 'collapsed' : ''}" data-group="${group.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <span class="group-name">${escapeHtml(group.name)}</span>
          <span class="group-count">${visibleTasks.length}</span>
          <button class="uncheck-all-btn" data-group-id="${group.id}" title="Uncheck all visible tasks">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          </button>
        </div>
        <div class="task-list ${isCollapsed ? 'collapsed' : ''}" id="travel-task-list-${group.id}">
        </div>
        <div class="task-add-row ${isCollapsed ? 'hidden' : ''}" style="background: ${colours.tint}">
          <span class="task-add-icon">+</span>
          <input class="task-add-input travel-task-add-input" data-group-id="${group.id}" placeholder="Add a task..." style="background: transparent">
        </div>
      `;

      const taskListEl = groupEl.querySelector('.task-list');
      visibleTasks.forEach(task => {
        const taskEl = createTravelTaskElement(task);
        taskEl.style.background = colours.tint;
        taskListEl.appendChild(taskEl);
      });

      container.appendChild(groupEl);

      // SortableJS for this group
      if (sortableInstances[group.id]) sortableInstances[group.id].destroy();
      sortableInstances[group.id] = new Sortable(taskListEl, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        delay: 300,
        delayOnTouchOnly: true,
        touchStartThreshold: 5,
        group: 'travel-tasks',
        onEnd: handleTravelDragEnd
      });
    });
  }

  function createTravelTaskElement(task) {
    const el = document.createElement('div');
    el.className = 'task-item' + (task.completed ? ' completed-task' : '');
    el.dataset.taskId = task.id;

    el.innerHTML = `
      <button class="task-checkbox ${task.completed ? 'checked' : ''}" data-task-id="${task.id}" title="${task.completed ? 'Uncheck' : 'Check off'}"></button>
      <span class="task-title ${task.completed ? 'completed-text' : ''}">${escapeHtml(task.title)}</span>
      <span class="task-creator">${task.created_by || ''}</span>
    `;

    el.querySelector('.task-checkbox').addEventListener('click', (e) => {
      e.stopPropagation();
      if (task.completed) {
        Store.uncompleteTravelTask(task.id);
      } else {
        Store.completeTravelTask(task.id);
      }
    });

    el.addEventListener('click', (e) => {
      if (e.target.closest('.task-checkbox')) return;
      openTravelTaskModal(task.id);
    });

    return el;
  }

  /* ---------- Travel Task Modal ---------- */

  function openTravelTaskModal(taskId) {
    const task = travelTasks.find(t => t.id === taskId);
    if (!task) return;

    editingTaskId = taskId;

    document.getElementById('travel-modal-title').textContent = task.title;
    document.getElementById('travel-modal-description').value = task.description || '';
    document.getElementById('travel-modal-applies-to').value = task.applies_to || 'both';
    document.getElementById('travel-modal-created-by').textContent = `Created by ${task.created_by || 'Unknown'}`;
    document.getElementById('travel-modal-created-at').textContent = task.created_at ? formatFullDate(task.created_at) : '';

    // Populate move-to selector
    const moveEl = document.getElementById('travel-modal-move-group');
    moveEl.innerHTML = travelGroups
      .map(g => `<option value="${g.id}" ${g.id === task.group_id ? 'selected' : ''}>${escapeHtml(g.name)}</option>`)
      .join('');

    document.getElementById('travel-modal-overlay').classList.remove('hidden');
  }

  function closeTravelTaskModal() {
    if (!editingTaskId) return;

    const task = travelTasks.find(t => t.id === editingTaskId);
    const updates = {};

    const newTitle = document.getElementById('travel-modal-title').textContent.trim();
    if (task && newTitle && newTitle !== task.title) updates.title = newTitle;

    const newDesc = document.getElementById('travel-modal-description').value;
    if (task && newDesc !== (task.description || '')) updates.description = newDesc;

    const newAppliesTo = document.getElementById('travel-modal-applies-to').value;
    if (task && newAppliesTo !== task.applies_to) updates.applies_to = newAppliesTo;

    const newGroupId = document.getElementById('travel-modal-move-group').value;
    if (task && newGroupId && newGroupId !== task.group_id) {
      updates.group_id = newGroupId;
      updates.order_index = travelTasks.filter(t => t.group_id === newGroupId).length;
    }

    if (Object.keys(updates).length > 0) {
      Store.updateTravelTask(editingTaskId, updates);
    }

    document.getElementById('travel-modal-overlay').classList.add('hidden');
    editingTaskId = null;
  }

  /* ---------- Drag & Drop ---------- */

  function handleTravelDragEnd(evt) {
    const taskId = evt.item.dataset.taskId;
    const newGroupEl = evt.to.closest('.group');
    const newGroupId = newGroupEl ? newGroupEl.dataset.groupId : null;
    if (!newGroupId) return;

    const taskEls = evt.to.querySelectorAll('.task-item');
    const updates = [];
    taskEls.forEach((el, idx) => {
      const tid = el.dataset.taskId;
      const update = { id: tid, order_index: idx };
      if (tid === taskId) update.group_id = newGroupId;
      updates.push(update);
    });

    if (evt.from !== evt.to) {
      const srcEls = evt.from.querySelectorAll('.task-item');
      srcEls.forEach((el, idx) => {
        updates.push({ id: el.dataset.taskId, order_index: idx });
      });
    }

    Store.reorderTravelTasks(updates);
  }

  /* ---------- Event Listeners ---------- */

  function initEventListeners() {
    // Direction selector
    document.getElementById('direction-selector').addEventListener('click', (e) => {
      const btn = e.target.closest('.direction-btn');
      if (!btn) return;
      setDirection(btn.dataset.direction);
    });

    // Collapse toggles (delegated within travel page)
    document.getElementById('page-travel').addEventListener('click', (e) => {
      const collapseBtn = e.target.closest('.collapse-btn');
      if (!collapseBtn) return;

      const groupId = collapseBtn.dataset.group;
      collapseBtn.classList.toggle('collapsed');

      const groupEl = collapseBtn.closest('.group');
      const taskList = groupEl.querySelector('.task-list');
      const addRow = groupEl.querySelector('.task-add-row');
      taskList.classList.toggle('collapsed');
      if (addRow) addRow.classList.toggle('hidden');
      Store.updateTravelGroup(groupId, { is_collapsed: taskList.classList.contains('collapsed') });
    });

    // Uncheck all (delegated)
    document.getElementById('page-travel').addEventListener('click', (e) => {
      const uncheckBtn = e.target.closest('.uncheck-all-btn');
      if (!uncheckBtn) return;
      e.stopPropagation();

      const groupId = uncheckBtn.dataset.groupId;
      const visibleChecked = travelTasks.filter(t =>
        t.group_id === groupId && t.completed && isVisible(t)
      );
      if (visibleChecked.length === 0) return;
      Store.uncheckAllTravelTasks(visibleChecked.map(t => t.id));
    });

    // Task add input (delegated)
    document.getElementById('page-travel').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const input = e.target.closest('.travel-task-add-input');
      if (!input) return;

      const title = input.value.trim();
      if (!title) return;

      const groupId = input.dataset.groupId;
      const groupTasks = travelTasks.filter(t => t.group_id === groupId);
      Store.createTravelTask(title, groupId, groupTasks.length, currentUser, 'both');
      input.value = '';
    });

    // Travel task modal
    document.getElementById('travel-modal-close').addEventListener('click', closeTravelTaskModal);
    document.getElementById('travel-modal-ok').addEventListener('click', closeTravelTaskModal);
    document.getElementById('travel-modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeTravelTaskModal();
    });
    document.getElementById('travel-modal-delete').addEventListener('click', () => {
      if (!editingTaskId) return;
      const task = travelTasks.find(t => t.id === editingTaskId);
      if (confirm(`Permanently delete "${task ? task.title : 'this task'}"?`)) {
        Store.deleteTravelTask(editingTaskId);
        document.getElementById('travel-modal-overlay').classList.add('hidden');
        editingTaskId = null;
      }
    });
  }

  function refreshTheme() {
    render();
  }

  return { init, refreshTheme };
})();
