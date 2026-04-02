/* ============================================
   LifeTracker — Main Application
   ============================================ */

const App = (() => {
  /* ---------- State ---------- */
  let currentUser = null; // 'RC' or 'LC'
  let groups = [];
  let tasks = [];
  let sortableInstances = {};
  let editingTaskId = null;

  /* ---------- Pastel Palette ---------- */
  const PALETTE = [
    { name: 'Rose',     header: '#E8A0A0', tint: '#FDF0F0' },
    { name: 'Peach',    header: '#E8C4A0', tint: '#FDF5F0' },
    { name: 'Sand',     header: '#E8D8A0', tint: '#FDFAF0' },
    { name: 'Sage',     header: '#A0D8A0', tint: '#F0FDF0' },
    { name: 'Sky',      header: '#A0C4E8', tint: '#F0F5FD' },
    { name: 'Lavender', header: '#C4A0E8', tint: '#F5F0FD' },
    { name: 'Slate',    header: '#A0B8C8', tint: '#F0F4F8' },
    { name: 'Blush',    header: '#E8A0C4', tint: '#FDF0F5' },
  ];

  const DARK_PALETTE = [
    { name: 'Rose',     header: '#8B5E5E', tint: '#3A2A2A' },
    { name: 'Peach',    header: '#8B7A5E', tint: '#3A3228' },
    { name: 'Sand',     header: '#8B845E', tint: '#3A3828' },
    { name: 'Sage',     header: '#5E8B5E', tint: '#283A28' },
    { name: 'Sky',      header: '#5E7A8B', tint: '#28323A' },
    { name: 'Lavender', header: '#7A5E8B', tint: '#32283A' },
    { name: 'Slate',    header: '#5E7080', tint: '#282E34' },
    { name: 'Blush',    header: '#8B5E7A', tint: '#3A2832' },
  ];

  /* ---------- Helpers ---------- */

  function isDarkMode() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  function getColourForGroup(colorHex) {
    const activePalette = isDarkMode() ? DARK_PALETTE : PALETTE;
    // Match against both palettes so colours saved in either mode resolve correctly
    let idx = PALETTE.findIndex(p => p.header === colorHex);
    if (idx === -1) idx = DARK_PALETTE.findIndex(p => p.header === colorHex);
    if (idx === -1) return { header: colorHex, tint: colorHex + '20' };
    return activePalette[idx];
  }

  function isWithinDays(dateVal, days) {
    if (!dateVal) return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    let d;
    if (dateVal.toDate) d = dateVal.toDate();
    else d = new Date(dateVal);
    d.setHours(0, 0, 0, 0);
    const diff = (d - now) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= days;
  }

  function isPastDue(dateVal) {
    if (!dateVal) return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    let d;
    if (dateVal.toDate) d = dateVal.toDate();
    else d = new Date(dateVal);
    d.setHours(0, 0, 0, 0);
    return d < now;
  }

  function formatDate(dateVal) {
    if (!dateVal) return '';
    let d;
    if (dateVal.toDate) d = dateVal.toDate();
    else d = new Date(dateVal);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((d - now) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff < -1) return `${Math.abs(diff)}d overdue`;
    if (diff <= 7) return `${diff}d`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  function formatFullDate(timestamp) {
    if (!timestamp) return '';
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function isTopPriority(task) {
    if (task.completed || task.deleted) return false;
    if (task.is_starred) return true;
    if (task.due_date && isWithinDays(task.due_date, 7)) return true;
    if (task.due_date && isPastDue(task.due_date)) return true;
    return false;
  }

  function starSvg(active) {
    if (active) {
      return `<svg viewBox="0 0 24 24"><polygon class="star-active" points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    }
    return `<svg viewBox="0 0 24 24"><polygon class="star-inactive" points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  }

  /* ---------- PIN Screen ---------- */

  function initPinScreen() {
    const keys = document.querySelectorAll('.pin-key[data-key]');
    const dots = document.querySelectorAll('.pin-dot');
    const errorEl = document.getElementById('pin-error');
    let pinValue = '';

    keys.forEach(key => {
      key.addEventListener('click', async () => {
        const val = key.dataset.key;
        if (val === 'delete') {
          pinValue = pinValue.slice(0, -1);
          updateDots();
          return;
        }
        if (pinValue.length >= 4) return;
        pinValue += val;
        updateDots();

        if (pinValue.length === 4) {
          const user = await Store.verifyPin(pinValue);
          if (user) {
            currentUser = user;
            localStorage.setItem('lt_user', user);
            showApp();
          } else {
            errorEl.textContent = 'Incorrect PIN';
            document.getElementById('pin-dots').classList.add('pin-shake');
            setTimeout(() => {
              document.getElementById('pin-dots').classList.remove('pin-shake');
              pinValue = '';
              updateDots();
              errorEl.textContent = '';
            }, 600);
          }
        }
      });
    });

    // Keyboard support for PIN entry
    document.addEventListener('keydown', (e) => {
      if (!document.getElementById('pin-screen').classList.contains('hidden')) {
        if (e.key >= '0' && e.key <= '9' && pinValue.length < 4) {
          pinValue += e.key;
          updateDots();
          if (pinValue.length === 4) {
            document.querySelector(`.pin-key[data-key="${e.key}"]`).click();
            // PIN verification triggered above on 4th digit
          }
        } else if (e.key === 'Backspace') {
          pinValue = pinValue.slice(0, -1);
          updateDots();
        }
      }
    });

    function updateDots() {
      dots.forEach((dot, i) => {
        dot.classList.toggle('filled', i < pinValue.length);
      });
    }
  }

  /* ---------- App Init ---------- */

  function showApp() {
    document.getElementById('pin-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('user-badge').textContent = currentUser;
    initRealtime();
    initEventListeners();
  }

  function initRealtime() {
    Store.onGroupsChanged(newGroups => {
      groups = newGroups;
      render();
    });

    Store.onTasksChanged(newTasks => {
      tasks = newTasks;
      render();
    });
  }

  /* ---------- Rendering ---------- */

  function render() {
    renderTopPriority();
    renderGroups();
    renderCompleted();
    cleanupRecycleBin();
  }

  function renderTopPriority() {
    const container = document.getElementById('top-priority-tasks');
    const countEl = document.getElementById('top-priority-count');
    const topTasks = tasks
      .filter(t => !t.completed && !t.deleted && isTopPriority(t))
      .sort((a, b) => {
        // Due date first (soonest), then creation date (newest)
        const aDue = a.due_date ? (a.due_date.toDate ? a.due_date.toDate() : new Date(a.due_date)) : null;
        const bDue = b.due_date ? (b.due_date.toDate ? b.due_date.toDate() : new Date(b.due_date)) : null;
        if (aDue && !bDue) return -1;
        if (!aDue && bDue) return 1;
        if (aDue && bDue) return aDue - bDue;
        const aCreated = a.created_at ? (a.created_at.toDate ? a.created_at.toDate() : new Date(a.created_at)) : new Date(0);
        const bCreated = b.created_at ? (b.created_at.toDate ? b.created_at.toDate() : new Date(b.created_at)) : new Date(0);
        return bCreated - aCreated;
      });

    countEl.textContent = topTasks.length;

    const isCollapsed = container.classList.contains('collapsed');
    container.innerHTML = '';

    if (topTasks.length === 0) {
      container.innerHTML = '<p class="empty-message">No priority tasks</p>';
    } else {
      topTasks.forEach(task => {
        container.appendChild(createTaskElement(task, true));
      });
    }

    if (isCollapsed) container.classList.add('collapsed');

    // Init sortable for top priority
    if (sortableInstances['top-priority']) sortableInstances['top-priority'].destroy();
    if (topTasks.length > 0) {
      sortableInstances['top-priority'] = new Sortable(container, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        handle: '.task-item',
        delay: 300,
        delayOnTouchOnly: true,
        touchStartThreshold: 5,
        group: { name: 'tasks', pull: false, put: false },
        onEnd: () => {} // Top priority reorder is session-only per spec
      });
    }
  }

  function renderGroups() {
    const container = document.getElementById('groups-container');
    const oldCollapseState = {};

    // Preserve collapse state
    container.querySelectorAll('.group').forEach(el => {
      const gid = el.dataset.groupId;
      const taskList = el.querySelector('.task-list');
      if (gid && taskList) {
        oldCollapseState[gid] = taskList.classList.contains('collapsed');
      }
    });

    container.innerHTML = '';

    groups.forEach(group => {
      const groupEl = document.createElement('section');
      groupEl.className = 'group';
      groupEl.dataset.groupId = group.id;

      const colours = getColourForGroup(group.color);
      const groupTasks = tasks
        .filter(t => t.group_id === group.id && !t.completed && !t.deleted)
        .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

      const isCollapsed = oldCollapseState[group.id] !== undefined
        ? oldCollapseState[group.id]
        : group.is_collapsed;

      groupEl.innerHTML = `
        <div class="group-header" style="background: ${colours.header}">
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
        <div class="task-list ${isCollapsed ? 'collapsed' : ''}" id="task-list-${group.id}">
        </div>
        <div class="task-add-row ${isCollapsed ? 'hidden' : ''}" style="background: ${colours.tint}">
          <span class="task-add-icon">+</span>
          <input class="task-add-input" data-group-id="${group.id}" placeholder="Add a task..." style="background: transparent">
        </div>
      `;

      const taskListEl = groupEl.querySelector('.task-list');
      groupTasks.forEach(task => {
        const taskEl = createTaskElement(task, false);
        taskEl.style.background = colours.tint;
        taskListEl.appendChild(taskEl);
      });

      container.appendChild(groupEl);

      // Init sortable for this group's task list
      if (sortableInstances[group.id]) sortableInstances[group.id].destroy();
      sortableInstances[group.id] = new Sortable(taskListEl, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        delay: 300,
        delayOnTouchOnly: true,
        touchStartThreshold: 5,
        group: 'tasks',
        onEnd: handleTaskDragEnd
      });
    });

    // Init sortable for groups container
    if (sortableInstances['groups']) sortableInstances['groups'].destroy();
    sortableInstances['groups'] = new Sortable(container, {
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

  function renderCompleted() {
    const container = document.getElementById('completed-tasks');
    const countEl = document.getElementById('completed-count');
    const completedTasks = tasks
      .filter(t => t.completed && !t.deleted)
      .sort((a, b) => {
        const aTime = a.completed_at ? (a.completed_at.toDate ? a.completed_at.toDate() : new Date(a.completed_at)) : new Date(0);
        const bTime = b.completed_at ? (b.completed_at.toDate ? b.completed_at.toDate() : new Date(b.completed_at)) : new Date(0);
        return bTime - aTime;
      });

    countEl.textContent = completedTasks.length;

    const isCollapsed = container.classList.contains('collapsed');
    container.innerHTML = '';

    if (completedTasks.length === 0) {
      container.innerHTML = '<p class="empty-message">No completed tasks yet</p>';
    } else {
      completedTasks.forEach(task => {
        const group = groups.find(g => g.id === task.group_id);
        const el = document.createElement('div');
        el.className = 'task-item completed-task';
        el.dataset.taskId = task.id;

        el.innerHTML = `
          <button class="task-checkbox checked" data-task-id="${task.id}" title="Restore task"></button>
          <span class="task-title completed-text">${escapeHtml(task.title)}</span>
          <span class="task-creator">${task.created_by || ''}</span>
          ${group ? `<span class="task-group-indicator" style="background: ${group.color}" title="${escapeHtml(group.name)}"></span>` : ''}
        `;

        // Click checkbox to uncomplete
        el.querySelector('.task-checkbox').addEventListener('click', (e) => {
          e.stopPropagation();
          Store.uncompleteTask(task.id);
        });

        el.addEventListener('click', () => openTaskModal(task.id));

        container.appendChild(el);
      });
    }

    if (isCollapsed) container.classList.add('collapsed');
  }

  function createTaskElement(task, isTopPriorityView) {
    const el = document.createElement('div');
    el.className = 'task-item';
    el.dataset.taskId = task.id;

    const group = groups.find(g => g.id === task.group_id);
    const dueDateStr = formatDate(task.due_date);
    let dueClass = '';
    if (task.due_date) {
      if (isPastDue(task.due_date)) dueClass = 'overdue';
      else if (isWithinDays(task.due_date, 7)) dueClass = 'due-soon';
    }

    el.innerHTML = `
      <button class="task-checkbox" data-task-id="${task.id}" title="Complete task"></button>
      <span class="task-title">${escapeHtml(task.title)}</span>
      ${dueDateStr ? `<span class="task-due ${dueClass}">${dueDateStr}</span>` : ''}
      <span class="task-creator">${task.created_by || ''}</span>
      ${isTopPriorityView && group ? `<span class="task-group-indicator" style="background: ${group.color}" title="${escapeHtml(group.name)}"></span>` : ''}
      <button class="task-star" data-task-id="${task.id}" title="${task.is_starred ? 'Unstar' : 'Star'}">
        ${starSvg(task.is_starred)}
      </button>
    `;

    // Checkbox click
    el.querySelector('.task-checkbox').addEventListener('click', (e) => {
      e.stopPropagation();
      Store.completeTask(task.id);
    });

    // Star click
    el.querySelector('.task-star').addEventListener('click', (e) => {
      e.stopPropagation();
      Store.updateTask(task.id, { is_starred: !task.is_starred });
    });

    // Click to open detail
    el.addEventListener('click', (e) => {
      if (e.target.closest('.task-checkbox') || e.target.closest('.task-star')) return;
      openTaskModal(task.id);
    });

    return el;
  }

  /* ---------- Task Detail Modal ---------- */

  function openTaskModal(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    editingTaskId = taskId;

    const overlay = document.getElementById('task-modal-overlay');
    const titleEl = document.getElementById('modal-title');
    const descEl = document.getElementById('modal-description');
    const dateEl = document.getElementById('modal-due-date');
    const createdByEl = document.getElementById('modal-created-by');
    const createdAtEl = document.getElementById('modal-created-at');

    titleEl.textContent = task.title;
    descEl.value = task.description || '';

    if (task.due_date) {
      let d = task.due_date.toDate ? task.due_date.toDate() : new Date(task.due_date);
      dateEl.value = d.toISOString().split('T')[0];
    } else {
      dateEl.value = '';
    }

    createdByEl.textContent = `Created by ${task.created_by || 'Unknown'}`;
    createdAtEl.textContent = task.created_at ? formatFullDate(task.created_at) : '';

    // Populate "Move to" group selector
    const moveGroupEl = document.getElementById('modal-move-group');
    moveGroupEl.innerHTML = groups
      .map(g => `<option value="${g.id}" ${g.id === task.group_id ? 'selected' : ''}>${escapeHtml(g.name)}</option>`)
      .join('');

    overlay.classList.remove('hidden');
  }

  function closeTaskModal() {
    if (!editingTaskId) return;

    const titleEl = document.getElementById('modal-title');
    const descEl = document.getElementById('modal-description');
    const dateEl = document.getElementById('modal-due-date');

    const updates = {};
    const newTitle = titleEl.textContent.trim();
    const task = tasks.find(t => t.id === editingTaskId);

    if (task && newTitle && newTitle !== task.title) {
      updates.title = newTitle;
    }
    if (task && descEl.value !== (task.description || '')) {
      updates.description = descEl.value;
    }

    const newDate = dateEl.value;
    const currentDate = task && task.due_date
      ? (task.due_date.toDate ? task.due_date.toDate().toISOString().split('T')[0] : new Date(task.due_date).toISOString().split('T')[0])
      : '';

    if (newDate !== currentDate) {
      updates.due_date = newDate ? firebase.firestore.Timestamp.fromDate(new Date(newDate + 'T00:00:00')) : null;
    }

    const newGroupId = document.getElementById('modal-move-group').value;
    if (task && newGroupId && newGroupId !== task.group_id) {
      updates.group_id = newGroupId;
      updates.order_index = tasks.filter(t => t.group_id === newGroupId && !t.completed && !t.deleted).length;
    }

    if (Object.keys(updates).length > 0) {
      Store.updateTask(editingTaskId, updates);
    }

    document.getElementById('task-modal-overlay').classList.add('hidden');
    editingTaskId = null;
  }

  /* ---------- Recycle Bin Modal ---------- */

  function openRecycleBin() {
    const overlay = document.getElementById('recycle-modal-overlay');
    const container = document.getElementById('recycle-bin-tasks');

    const deletedTasks = tasks
      .filter(t => t.deleted)
      .sort((a, b) => {
        const aTime = a.deleted_at ? (a.deleted_at.toDate ? a.deleted_at.toDate() : new Date(a.deleted_at)) : new Date(0);
        const bTime = b.deleted_at ? (b.deleted_at.toDate ? b.deleted_at.toDate() : new Date(b.deleted_at)) : new Date(0);
        return bTime - aTime;
      });

    container.innerHTML = '';

    if (deletedTasks.length === 0) {
      container.innerHTML = '<p class="empty-message">No deleted tasks</p>';
    } else {
      deletedTasks.forEach(task => {
        const group = groups.find(g => g.id === task.group_id);
        const el = document.createElement('div');
        el.className = 'task-item recycled-task';
        el.innerHTML = `
          <span class="task-title">${escapeHtml(task.title)}</span>
          ${group ? `<span class="task-group-indicator" style="background: ${group.color}"></span>` : ''}
          <span class="deleted-date">${formatFullDate(task.deleted_at)}</span>
          <button class="restore-btn" data-task-id="${task.id}">Restore</button>
        `;
        el.querySelector('.restore-btn').addEventListener('click', () => {
          Store.restoreTask(task.id);
          openRecycleBin(); // Refresh
        });
        container.appendChild(el);
      });
    }

    overlay.classList.remove('hidden');
  }

  /* ---------- Colour Picker Modal ---------- */

  let colourPickerGroupId = null;

  function openColourPicker(groupId) {
    colourPickerGroupId = groupId;
    const overlay = document.getElementById('colour-modal-overlay');
    const grid = document.getElementById('colour-grid');
    const group = groups.find(g => g.id === groupId);

    grid.innerHTML = '';
    PALETTE.forEach(colour => {
      const swatch = document.createElement('button');
      const isSelected = group && (group.color === colour.header || DARK_PALETTE[PALETTE.indexOf(colour)].header === group.color);
      swatch.className = 'colour-swatch' + (isSelected ? ' selected' : '');
      swatch.style.background = colour.header;
      swatch.title = colour.name;
      swatch.addEventListener('click', () => {
        Store.updateGroup(groupId, { color: colour.header });
        overlay.classList.add('hidden');
        colourPickerGroupId = null;
      });
      grid.appendChild(swatch);
    });

    overlay.classList.remove('hidden');
  }

  /* ---------- Drag & Drop Handlers ---------- */

  function handleTaskDragEnd(evt) {
    const taskId = evt.item.dataset.taskId;
    const newGroupEl = evt.to.closest('.group');
    const newGroupId = newGroupEl ? newGroupEl.dataset.groupId : null;

    if (!newGroupId) return;

    // Build new order for destination list
    const taskEls = evt.to.querySelectorAll('.task-item');
    const updates = [];
    taskEls.forEach((el, idx) => {
      const tid = el.dataset.taskId;
      const update = { id: tid, order_index: idx };
      if (tid === taskId) update.group_id = newGroupId;
      updates.push(update);
    });

    // Also reorder source list if different from destination
    if (evt.from !== evt.to) {
      const srcEls = evt.from.querySelectorAll('.task-item');
      srcEls.forEach((el, idx) => {
        updates.push({ id: el.dataset.taskId, order_index: idx });
      });
    }

    Store.reorderTasks(updates);
  }

  function handleGroupDragEnd() {
    const container = document.getElementById('groups-container');
    const groupEls = container.querySelectorAll('.group');
    const orderedIds = Array.from(groupEls).map(el => el.dataset.groupId);
    Store.reorderGroups(orderedIds);
  }

  /* ---------- Event Listeners ---------- */

  function initEventListeners() {
    // Dark mode toggle
    document.getElementById('dark-mode-btn').addEventListener('click', () => {
      const isDark = isDarkMode();
      document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
      localStorage.setItem('lt_theme', isDark ? 'light' : 'dark');
      render();
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
      localStorage.removeItem('lt_user');
      currentUser = null;
      document.getElementById('app').classList.add('hidden');
      document.getElementById('pin-screen').classList.remove('hidden');
    });

    // Recycle bin
    document.getElementById('recycle-bin-btn').addEventListener('click', openRecycleBin);
    document.getElementById('recycle-modal-close').addEventListener('click', () => {
      document.getElementById('recycle-modal-overlay').classList.add('hidden');
    });
    document.getElementById('recycle-modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        document.getElementById('recycle-modal-overlay').classList.add('hidden');
      }
    });

    // Task modal
    document.getElementById('modal-close').addEventListener('click', closeTaskModal);
    document.getElementById('task-modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeTaskModal();
    });
    document.getElementById('modal-delete').addEventListener('click', () => {
      if (editingTaskId) {
        Store.softDeleteTask(editingTaskId);
        document.getElementById('task-modal-overlay').classList.add('hidden');
        editingTaskId = null;
      }
    });
    document.getElementById('modal-ok').addEventListener('click', closeTaskModal);
    document.getElementById('modal-clear-date').addEventListener('click', () => {
      document.getElementById('modal-due-date').value = '';
    });

    // Colour modal
    document.getElementById('colour-modal-close').addEventListener('click', () => {
      document.getElementById('colour-modal-overlay').classList.add('hidden');
    });
    document.getElementById('colour-modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        document.getElementById('colour-modal-overlay').classList.add('hidden');
      }
    });

    // Add group
    document.getElementById('add-group-btn').addEventListener('click', async () => {
      const name = prompt('Group name:');
      if (!name || !name.trim()) return;
      const colour = PALETTE[groups.length % PALETTE.length];
      await Store.createGroup(name.trim(), colour.header, groups.length);
    });

    // Collapse toggles (delegated)
    document.addEventListener('click', (e) => {
      const collapseBtn = e.target.closest('.collapse-btn');
      if (!collapseBtn) return;

      const groupId = collapseBtn.dataset.group;
      collapseBtn.classList.toggle('collapsed');

      if (groupId === 'top-priority') {
        document.getElementById('top-priority-tasks').classList.toggle('collapsed');
      } else if (groupId === 'completed') {
        document.getElementById('completed-tasks').classList.toggle('collapsed');
      } else {
        const groupEl = collapseBtn.closest('.group');
        const taskList = groupEl.querySelector('.task-list');
        const addRow = groupEl.querySelector('.task-add-row');
        taskList.classList.toggle('collapsed');
        if (addRow) addRow.classList.toggle('hidden');
        Store.updateGroup(groupId, { is_collapsed: taskList.classList.contains('collapsed') });
      }
    });

    // Group actions (delegated)
    document.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('.group-action-btn');
      if (!actionBtn) return;
      e.stopPropagation();

      const action = actionBtn.dataset.action;
      const groupId = actionBtn.dataset.groupId;

      if (action === 'colour') {
        openColourPicker(groupId);
      } else if (action === 'delete') {
        const group = groups.find(g => g.id === groupId);
        if (confirm(`Delete "${group ? group.name : 'this group'}" and all its tasks?`)) {
          Store.deleteGroup(groupId);
        }
      }
    });

    // Group name editing (delegated)
    document.addEventListener('dblclick', (e) => {
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
        const newName = input.value.trim();
        if (newName && newName !== currentName) {
          Store.updateGroup(groupId, { name: newName });
        }
        // Re-render will replace this
        const span = document.createElement('span');
        span.className = 'group-name';
        span.dataset.groupId = groupId;
        span.textContent = newName || currentName;
        input.replaceWith(span);
      }

      input.addEventListener('blur', save);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); save(); }
        if (e.key === 'Escape') { input.value = currentName; save(); }
      });
    });

    // Task add input (delegated)
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const input = e.target.closest('.task-add-input');
      if (!input) return;

      const title = input.value.trim();
      if (!title) return;

      const groupId = input.dataset.groupId;
      const groupTasks = tasks.filter(t => t.group_id === groupId && !t.completed && !t.deleted);
      const orderIndex = groupTasks.length;

      Store.createTask(title, groupId, orderIndex, currentUser);
      input.value = '';
    });
  }

  /* ---------- Recycle Bin Cleanup ---------- */

  function cleanupRecycleBin() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    tasks.filter(t => t.deleted && t.deleted_at).forEach(task => {
      const deletedAt = task.deleted_at.toDate ? task.deleted_at.toDate() : new Date(task.deleted_at);
      if (deletedAt < thirtyDaysAgo) {
        Store.permanentlyDeleteTask(task.id);
      }
    });
  }

  /* ---------- Utilities ---------- */

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ---------- Bootstrap ---------- */

  function init() {
    // Restore dark mode preference
    const theme = localStorage.getItem('lt_theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);

    // Check for existing session
    const savedUser = localStorage.getItem('lt_user');
    if (savedUser) {
      currentUser = savedUser;
      showApp();
    }

    initPinScreen();
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
