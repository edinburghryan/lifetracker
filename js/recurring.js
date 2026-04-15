/* ============================================
   LifeTracker — Recurring Tasks Page
   ============================================ */

const Recurring = (() => {
  /* ---------- State ---------- */
  let currentUser = null;
  let recurringGroups = [];
  let recurringTasks = [];
  let sortableInstances = {};
  let editingTaskId = null;
  let creatingForGroupId = null;
  let colourPickerGroupId = null;
  let unsubscribers = [];

  /* ---------- Shorthand refs to Utils ---------- */
  const PALETTE = Utils.PALETTE;
  const DARK_PALETTE = Utils.DARK_PALETTE;
  const isDarkMode = Utils.isDarkMode;
  const getColourForGroup = Utils.getColourForGroup;
  const escapeHtml = Utils.escapeHtml;
  const formatFullDate = Utils.formatFullDate;
  const formatDate = Utils.formatDate;
  const computeNextDue = Utils.computeNextDue;
  const formatFrequency = Utils.formatFrequency;

  const DUE_WINDOW_DAYS = 5;

  /* ---------- Helpers ---------- */

  function toDate(val) {
    if (!val) return null;
    return val.toDate ? val.toDate() : new Date(val);
  }

  function isDueTask(task) {
    if (task.deleted) return false;
    if (!task.next_due) return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const d = toDate(task.next_due);
    d.setHours(0, 0, 0, 0);
    const diff = (d - now) / (1000 * 60 * 60 * 24);
    return diff <= DUE_WINDOW_DAYS;
  }

  function isOverdue(task) {
    if (!task.next_due) return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const d = toDate(task.next_due);
    d.setHours(0, 0, 0, 0);
    return d < now;
  }

  function cycleSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>';
  }

  function toDateInputValue(val) {
    const d = toDate(val);
    if (!d) return '';
    return d.toISOString().split('T')[0];
  }

  /* ---------- Init ---------- */

  function init(user, prefs) {
    currentUser = user;

    unsubscribers.push(
      Store.onRecurringGroupsChanged(groups => {
        recurringGroups = groups;
        render();
      }, err => console.error('Recurring groups listener error:', err)),

      Store.onRecurringTasksChanged(tasks => {
        recurringTasks = tasks;
        render();
      }, err => console.error('Recurring tasks listener error:', err))
    );

    initEventListeners();
  }

  /* ---------- Rendering ---------- */

  function render() {
    renderDueTasks();
    renderGroups();
    cleanupRecycleBin();
  }

  function renderDueTasks() {
    const container = document.getElementById('recurring-due-tasks');
    const countEl = document.getElementById('recurring-due-count');

    const dueTasks = recurringTasks
      .filter(t => !t.deleted && isDueTask(t))
      .sort((a, b) => {
        const aDue = toDate(a.next_due);
        const bDue = toDate(b.next_due);
        if (aDue && !bDue) return -1;
        if (!aDue && bDue) return 1;
        if (aDue && bDue) return aDue - bDue;
        return 0;
      });

    countEl.textContent = dueTasks.length;

    const isCollapsed = container.classList.contains('collapsed');
    container.innerHTML = '';

    if (dueTasks.length === 0) {
      container.innerHTML = '<p class="empty-message">No tasks due</p>';
    } else {
      dueTasks.forEach(task => {
        container.appendChild(createDueTaskElement(task));
      });
    }

    if (isCollapsed) container.classList.add('collapsed');
  }

  function createDueTaskElement(task) {
    const el = document.createElement('div');
    el.className = 'task-item';
    el.dataset.taskId = task.id;

    const group = recurringGroups.find(g => g.id === task.group_id);
    const dueDateStr = formatDate(task.next_due);
    const overdue = isOverdue(task);
    const dueClass = overdue ? 'overdue' : 'due-soon';

    el.innerHTML = `
      <button class="recurring-cycle-btn" data-task-id="${task.id}" title="Mark done &amp; cycle">${cycleSvg()}</button>
      <span class="task-title">${escapeHtml(task.title)}</span>
      ${dueDateStr ? `<span class="task-due ${dueClass}">${dueDateStr}</span>` : ''}
      <span class="recurring-frequency-badge">${formatFrequency(task.frequency)}</span>
      <span class="task-creator">${task.created_by || ''}</span>
      ${group ? `<span class="task-group-indicator" style="background: ${group.color}" title="${escapeHtml(group.name)}"></span>` : ''}
    `;

    el.querySelector('.recurring-cycle-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      Store.cycleRecurringTask(task.id, task.frequency);
    });

    el.addEventListener('click', (e) => {
      if (e.target.closest('.recurring-cycle-btn')) return;
      openRecurringTaskModal(task.id);
    });

    return el;
  }

  function renderGroups() {
    const container = document.getElementById('recurring-groups-container');
    const oldCollapseState = {};

    container.querySelectorAll('.group').forEach(el => {
      const gid = el.dataset.groupId;
      const taskList = el.querySelector('.task-list');
      if (gid && taskList) {
        oldCollapseState[gid] = taskList.classList.contains('collapsed');
      }
    });

    container.innerHTML = '';

    recurringGroups.forEach(group => {
      const groupEl = document.createElement('section');
      groupEl.className = 'group';
      groupEl.dataset.groupId = group.id;

      const colours = getColourForGroup(group.color);
      const groupTasks = recurringTasks
        .filter(t => t.group_id === group.id && !t.deleted)
        .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

      const isCollapsed = oldCollapseState[group.id] !== undefined
        ? oldCollapseState[group.id]
        : group.is_collapsed;

      groupEl.innerHTML = `
        <div class="group-header" style="background: linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(0,0,0,0.4) 100%), ${colours.header}">
          <button class="collapse-btn ${isCollapsed ? 'collapsed' : ''}" data-group="${group.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <span class="group-name" data-group-id="${group.id}">${escapeHtml(group.name)}</span>
          <span class="group-count">${groupTasks.length}</span>
          <div class="group-actions">
            <button class="group-action-btn" data-action="colour" data-group-id="${group.id}" title="Change colour">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>
            </button>
            <button class="group-action-btn" data-action="delete" data-group-id="${group.id}" title="Delete group">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        <div class="task-list ${isCollapsed ? 'collapsed' : ''}" id="recurring-task-list-${group.id}">
        </div>
        <div class="task-add-row recurring-task-add-btn ${isCollapsed ? 'hidden' : ''}" data-group-id="${group.id}" style="background: ${colours.tint}; cursor: pointer">
          <span class="task-add-icon">+</span>
          <span class="task-add-label">Add a recurring task...</span>
        </div>
      `;

      const taskListEl = groupEl.querySelector('.task-list');
      groupTasks.forEach(task => {
        const taskEl = createRecurringTaskElement(task);
        taskEl.style.background = colours.tint;
        taskListEl.appendChild(taskEl);
      });

      container.appendChild(groupEl);

      if (sortableInstances[group.id]) sortableInstances[group.id].destroy();
      sortableInstances[group.id] = new Sortable(taskListEl, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        delay: 300,
        delayOnTouchOnly: true,
        touchStartThreshold: 5,
        group: 'recurring-tasks',
        onEnd: handleTaskDragEnd
      });
    });

    if (sortableInstances['recurring-groups']) sortableInstances['recurring-groups'].destroy();
    sortableInstances['recurring-groups'] = new Sortable(container, {
      animation: 150,
      ghostClass: 'sortable-ghost',
      dragClass: 'sortable-drag',
      delay: 300,
      delayOnTouchOnly: true,
      touchStartThreshold: 5,
      handle: '.group-header',
      onEnd: handleGroupDragEnd
    });
  }

  function createRecurringTaskElement(task) {
    const el = document.createElement('div');
    el.className = 'task-item';
    el.dataset.taskId = task.id;

    const dueDateStr = formatDate(task.next_due);
    let dueClass = '';
    if (task.next_due) {
      if (isOverdue(task)) dueClass = 'overdue';
      else if (isDueTask(task)) dueClass = 'due-soon';
    }

    el.innerHTML = `
      <span class="task-title">${escapeHtml(task.title)}</span>
      ${dueDateStr ? `<span class="task-due ${dueClass}">${dueDateStr}</span>` : ''}
      <span class="recurring-frequency-badge">${formatFrequency(task.frequency)}</span>
      <span class="task-creator">${task.created_by || ''}</span>
    `;

    el.addEventListener('click', () => openRecurringTaskModal(task.id));
    return el;
  }

  /* ---------- Task Modal ---------- */

  function openNewRecurringTaskModal(groupId) {
    editingTaskId = null;
    creatingForGroupId = groupId;

    document.getElementById('recurring-modal-title').textContent = '';
    document.getElementById('recurring-modal-description').value = '';
    document.getElementById('recurring-modal-start-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('recurring-modal-frequency').value = 'monthly';
    document.getElementById('recurring-modal-next-due').textContent = formatFullDate(firebase.firestore.Timestamp.now());
    document.getElementById('recurring-modal-last-completed').textContent = 'Never';
    document.getElementById('recurring-modal-created-by').textContent = '';
    document.getElementById('recurring-modal-created-at').textContent = '';

    const moveEl = document.getElementById('recurring-modal-move-group');
    moveEl.innerHTML = recurringGroups
      .map(g => `<option value="${g.id}" ${g.id === groupId ? 'selected' : ''}>${escapeHtml(g.name)}</option>`)
      .join('');

    // Hide delete button in create mode
    document.getElementById('recurring-modal-delete').style.display = 'none';

    document.getElementById('recurring-modal-overlay').classList.remove('hidden');
    // Focus the title for immediate typing
    const titleEl = document.getElementById('recurring-modal-title');
    setTimeout(() => titleEl.focus(), 100);
  }

  function openRecurringTaskModal(taskId) {
    const task = recurringTasks.find(t => t.id === taskId);
    if (!task) return;

    editingTaskId = taskId;
    creatingForGroupId = null;

    document.getElementById('recurring-modal-title').textContent = task.title;
    document.getElementById('recurring-modal-description').value = task.description || '';

    document.getElementById('recurring-modal-start-date').value = toDateInputValue(task.start_date);
    document.getElementById('recurring-modal-frequency').value = task.frequency || 'monthly';
    document.getElementById('recurring-modal-next-due').textContent = task.next_due ? formatFullDate(task.next_due) : 'Not set';
    document.getElementById('recurring-modal-last-completed').textContent = task.last_completed ? formatFullDate(task.last_completed) : 'Never';
    document.getElementById('recurring-modal-created-by').textContent = `Created by ${task.created_by || 'Unknown'}`;
    document.getElementById('recurring-modal-created-at').textContent = task.created_at ? formatFullDate(task.created_at) : '';

    const moveEl = document.getElementById('recurring-modal-move-group');
    moveEl.innerHTML = recurringGroups
      .map(g => `<option value="${g.id}" ${g.id === task.group_id ? 'selected' : ''}>${escapeHtml(g.name)}</option>`)
      .join('');

    // Show delete button in edit mode
    document.getElementById('recurring-modal-delete').style.display = '';

    document.getElementById('recurring-modal-overlay').classList.remove('hidden');
  }

  function closeRecurringTaskModal() {
    // Handle create mode
    if (creatingForGroupId) {
      const title = document.getElementById('recurring-modal-title').textContent.trim().slice(0, 500);
      if (title) {
        const groupId = document.getElementById('recurring-modal-move-group').value || creatingForGroupId;
        const frequency = document.getElementById('recurring-modal-frequency').value || 'monthly';
        const startDateStr = document.getElementById('recurring-modal-start-date').value;
        const startDate = startDateStr
          ? firebase.firestore.Timestamp.fromDate(new Date(startDateStr + 'T00:00:00'))
          : firebase.firestore.Timestamp.now();
        const desc = document.getElementById('recurring-modal-description').value.slice(0, 5000);
        const groupTasks = recurringTasks.filter(t => t.group_id === groupId && !t.deleted);

        Store.createRecurringTask(title, groupId, groupTasks.length, currentUser, frequency, startDate)
          .then(ref => {
            if (desc) Store.updateRecurringTask(ref.id, { description: desc });
          });
      }
      document.getElementById('recurring-modal-overlay').classList.add('hidden');
      creatingForGroupId = null;
      return;
    }

    if (!editingTaskId) return;

    const task = recurringTasks.find(t => t.id === editingTaskId);
    const updates = {};

    const newTitle = document.getElementById('recurring-modal-title').textContent.trim().slice(0, 500);
    if (task && newTitle && newTitle !== task.title) updates.title = newTitle;

    const newDesc = document.getElementById('recurring-modal-description').value;
    if (task && newDesc !== (task.description || '')) updates.description = newDesc.slice(0, 5000);

    // Start date
    const newStartDateStr = document.getElementById('recurring-modal-start-date').value;
    const currentStartStr = toDateInputValue(task.start_date);
    if (newStartDateStr && newStartDateStr !== currentStartStr) {
      updates.start_date = firebase.firestore.Timestamp.fromDate(new Date(newStartDateStr + 'T00:00:00'));
      // If never completed, next_due follows start_date
      if (!task.last_completed) {
        updates.next_due = updates.start_date;
      }
    }

    // Frequency
    const newFrequency = document.getElementById('recurring-modal-frequency').value;
    if (task && newFrequency !== task.frequency) {
      updates.frequency = newFrequency;
      // Recompute next_due based on frequency change
      if (task.last_completed) {
        const fromDate = toDate(task.last_completed);
        const nextDue = computeNextDue(fromDate, newFrequency);
        updates.next_due = firebase.firestore.Timestamp.fromDate(nextDue);
      } else if (updates.start_date) {
        // start_date also changed above — next_due already set
      } else {
        // Never completed, start_date unchanged — next_due stays as start_date
      }
    }

    // Move to group
    const newGroupId = document.getElementById('recurring-modal-move-group').value;
    if (task && newGroupId && newGroupId !== task.group_id) {
      updates.group_id = newGroupId;
      updates.order_index = recurringTasks.filter(t => t.group_id === newGroupId && !t.deleted).length;
    }

    if (Object.keys(updates).length > 0) {
      Store.updateRecurringTask(editingTaskId, updates);
    }

    document.getElementById('recurring-modal-overlay').classList.add('hidden');
    editingTaskId = null;
  }

  /* ---------- Colour Picker ---------- */

  function openRecurringColourPicker(groupId) {
    colourPickerGroupId = groupId;
    const overlay = document.getElementById('recurring-colour-modal-overlay');
    const grid = document.getElementById('recurring-colour-grid');
    const group = recurringGroups.find(g => g.id === groupId);

    grid.innerHTML = '';
    PALETTE.forEach(colour => {
      const swatch = document.createElement('button');
      const isSelected = group && (group.color === colour.header || DARK_PALETTE[PALETTE.indexOf(colour)].header === group.color);
      swatch.className = 'colour-swatch' + (isSelected ? ' selected' : '');
      swatch.style.background = colour.header;
      swatch.title = colour.name;
      swatch.addEventListener('click', () => {
        Store.updateRecurringGroup(groupId, { color: colour.header });
        overlay.classList.add('hidden');
        colourPickerGroupId = null;
      });
      grid.appendChild(swatch);
    });

    overlay.classList.remove('hidden');
  }

  /* ---------- Recycle Bin ---------- */

  function openRecurringRecycleBin() {
    const overlay = document.getElementById('recurring-recycle-modal-overlay');
    const container = document.getElementById('recurring-recycle-bin-tasks');

    const deletedTasks = recurringTasks
      .filter(t => t.deleted)
      .sort((a, b) => {
        const aTime = toDate(a.deleted_at) || new Date(0);
        const bTime = toDate(b.deleted_at) || new Date(0);
        return bTime - aTime;
      });

    container.innerHTML = '';

    if (deletedTasks.length === 0) {
      container.innerHTML = '<p class="empty-message">No deleted tasks</p>';
    } else {
      deletedTasks.forEach(task => {
        const group = recurringGroups.find(g => g.id === task.group_id);
        const el = document.createElement('div');
        el.className = 'task-item recycled-task';
        el.innerHTML = `
          <span class="task-title">${escapeHtml(task.title)}</span>
          ${group ? `<span class="task-group-indicator" style="background: ${group.color}"></span>` : ''}
          <span class="deleted-date">${formatFullDate(task.deleted_at)}</span>
          <button class="restore-btn" data-task-id="${task.id}">Restore</button>
        `;
        el.querySelector('.restore-btn').addEventListener('click', async () => {
          const groupExists = recurringGroups.some(g => g.id === task.group_id);
          if (!groupExists && recurringGroups.length > 0) {
            await Store.updateRecurringTask(task.id, { group_id: recurringGroups[0].id });
          }
          await Store.restoreRecurringTask(task.id);
          openRecurringRecycleBin();
        });
        container.appendChild(el);
      });
    }

    overlay.classList.remove('hidden');
  }

  function cleanupRecycleBin() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    recurringTasks.filter(t => t.deleted && t.deleted_at).forEach(task => {
      const deletedAt = toDate(task.deleted_at);
      if (deletedAt < thirtyDaysAgo) {
        Store.permanentlyDeleteRecurringTask(task.id);
      }
    });
  }

  /* ---------- Drag & Drop ---------- */

  function handleTaskDragEnd(evt) {
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

    Store.reorderRecurringTasks(updates);
  }

  function handleGroupDragEnd() {
    const container = document.getElementById('recurring-groups-container');
    const groupEls = container.querySelectorAll('.group');
    const orderedIds = Array.from(groupEls).map(el => el.dataset.groupId);
    Store.reorderRecurringGroups(orderedIds);
  }

  /* ---------- Event Listeners ---------- */

  function initEventListeners() {
    const page = document.getElementById('page-recurring');

    // Collapse toggles
    page.addEventListener('click', (e) => {
      const collapseBtn = e.target.closest('.collapse-btn');
      if (!collapseBtn) return;

      const groupId = collapseBtn.dataset.group;
      collapseBtn.classList.toggle('collapsed');

      if (groupId === 'recurring-due') {
        document.getElementById('recurring-due-tasks').classList.toggle('collapsed');
      } else {
        const groupEl = collapseBtn.closest('.group');
        const taskList = groupEl.querySelector('.task-list');
        const addRow = groupEl.querySelector('.task-add-row');
        taskList.classList.toggle('collapsed');
        if (addRow) addRow.classList.toggle('hidden');
        Store.updateRecurringGroup(groupId, { is_collapsed: taskList.classList.contains('collapsed') });
      }
    });

    // Group actions (colour, delete)
    page.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('.group-action-btn');
      if (!actionBtn) return;
      e.stopPropagation();

      const action = actionBtn.dataset.action;
      const groupId = actionBtn.dataset.groupId;

      if (action === 'colour') {
        openRecurringColourPicker(groupId);
      } else if (action === 'delete') {
        const group = recurringGroups.find(g => g.id === groupId);
        if (confirm(`Delete "${group ? group.name : 'this group'}" and all its tasks?`)) {
          Store.deleteRecurringGroup(groupId);
        }
      }
    });

    // Group name editing
    page.addEventListener('dblclick', (e) => {
      const nameEl = e.target.closest('.group-name');
      if (!nameEl || !nameEl.dataset.groupId) return;

      const groupId = nameEl.dataset.groupId;
      const currentName = nameEl.textContent;

      const input = document.createElement('input');
      input.className = 'group-name-input';
      input.value = currentName;
      nameEl.replaceWith(input);
      input.focus();
      input.select();

      function save() {
        const newName = input.value.trim().slice(0, 500);
        if (newName && newName !== currentName) {
          Store.updateRecurringGroup(groupId, { name: newName });
        }
        const span = document.createElement('span');
        span.className = 'group-name';
        span.dataset.groupId = groupId;
        span.textContent = newName || currentName;
        input.replaceWith(span);
      }

      input.addEventListener('blur', save);
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); save(); }
        if (ev.key === 'Escape') { input.value = currentName; save(); }
      });
    });

    // Task add button — opens modal in create mode
    page.addEventListener('click', (e) => {
      const addBtn = e.target.closest('.recurring-task-add-btn');
      if (!addBtn) return;
      openNewRecurringTaskModal(addBtn.dataset.groupId);
    });

    // Add group button
    document.getElementById('recurring-add-group-btn').addEventListener('click', async () => {
      const name = prompt('Group name:');
      if (!name || !name.trim()) return;
      const colour = PALETTE[recurringGroups.length % PALETTE.length];
      await Store.createRecurringGroup(name.trim().slice(0, 500), colour.header, recurringGroups.length);
    });

    // Recycle bin button
    document.getElementById('recurring-recycle-btn').addEventListener('click', openRecurringRecycleBin);

    // Task modal
    document.getElementById('recurring-modal-close').addEventListener('click', closeRecurringTaskModal);
    document.getElementById('recurring-modal-ok').addEventListener('click', closeRecurringTaskModal);
    document.getElementById('recurring-modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeRecurringTaskModal();
    });
    document.getElementById('recurring-modal-delete').addEventListener('click', () => {
      if (!editingTaskId) return;
      Store.softDeleteRecurringTask(editingTaskId);
      document.getElementById('recurring-modal-overlay').classList.add('hidden');
      editingTaskId = null;
    });

    // Colour picker modal
    document.getElementById('recurring-colour-modal-close').addEventListener('click', () => {
      document.getElementById('recurring-colour-modal-overlay').classList.add('hidden');
    });
    document.getElementById('recurring-colour-modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        document.getElementById('recurring-colour-modal-overlay').classList.add('hidden');
      }
    });

    // Recycle bin modal
    document.getElementById('recurring-recycle-modal-close').addEventListener('click', () => {
      document.getElementById('recurring-recycle-modal-overlay').classList.add('hidden');
    });
    document.getElementById('recurring-recycle-modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        document.getElementById('recurring-recycle-modal-overlay').classList.add('hidden');
      }
    });
  }

  /* ---------- Public API ---------- */

  function refreshTheme() {
    render();
  }

  function teardown() {
    unsubscribers.forEach(fn => fn());
    unsubscribers = [];
  }

  return { init, refreshTheme, teardown };
})();
