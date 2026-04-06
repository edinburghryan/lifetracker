/* ============================================
   Firestore Data Layer
   ============================================ */

const Store = (() => {
  const groupsRef = db.collection('groups');
  const tasksRef  = db.collection('tasks');
  const travelGroupsRef = db.collection('travel_groups');
  const travelTasksRef  = db.collection('travel_tasks');
  const weightEntriesRef = db.collection('weight_entries');

  /* ---------- Groups (Tasks page) ---------- */

  function onGroupsChanged(callback, onError) {
    return groupsRef.orderBy('order_index').onSnapshot(snapshot => {
      const groups = [];
      snapshot.forEach(doc => {
        groups.push({ id: doc.id, ...doc.data() });
      });
      callback(groups);
    }, onError);
  }

  async function createGroup(name, color, orderIndex) {
    return groupsRef.add({
      name,
      color,
      order_index: orderIndex,
      is_collapsed: false,
      created_at: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  async function updateGroup(id, data) {
    return groupsRef.doc(id).update(data);
  }

  async function deleteGroup(id) {
    const tasks = await tasksRef.where('group_id', '==', id).get();
    const batch = db.batch();
    const now = firebase.firestore.Timestamp.now();
    tasks.forEach(doc => {
      batch.update(doc.ref, { deleted: true, deleted_at: now });
    });
    batch.delete(groupsRef.doc(id));
    return batch.commit();
  }

  async function reorderGroups(orderedIds) {
    const batch = db.batch();
    orderedIds.forEach((id, index) => {
      batch.update(groupsRef.doc(id), { order_index: index });
    });
    return batch.commit();
  }

  /* ---------- Tasks ---------- */

  function onTasksChanged(callback, onError) {
    return tasksRef.onSnapshot(snapshot => {
      const tasks = [];
      snapshot.forEach(doc => {
        tasks.push({ id: doc.id, ...doc.data() });
      });
      callback(tasks);
    }, onError);
  }

  async function createTask(title, groupId, orderIndex, createdBy) {
    return tasksRef.add({
      title,
      description: '',
      due_date: null,
      is_starred: false,
      group_id: groupId,
      order_index: orderIndex,
      created_by: createdBy,
      created_at: firebase.firestore.FieldValue.serverTimestamp(),
      completed: false,
      completed_at: null,
      deleted: false,
      deleted_at: null
    });
  }

  async function updateTask(id, data) {
    return tasksRef.doc(id).update(data);
  }

  async function completeTask(id) {
    return tasksRef.doc(id).update({
      completed: true,
      completed_at: firebase.firestore.Timestamp.now()
    });
  }

  async function uncompleteTask(id) {
    return tasksRef.doc(id).update({
      completed: false,
      completed_at: null
    });
  }

  async function softDeleteTask(id) {
    return tasksRef.doc(id).update({
      deleted: true,
      deleted_at: firebase.firestore.Timestamp.now()
    });
  }

  async function restoreTask(id) {
    return tasksRef.doc(id).update({
      deleted: false,
      deleted_at: null
    });
  }

  async function permanentlyDeleteTask(id) {
    return tasksRef.doc(id).delete();
  }

  async function reorderTasks(taskIdOrderPairs) {
    const batch = db.batch();
    taskIdOrderPairs.forEach(({ id, order_index, group_id }) => {
      const update = { order_index };
      if (group_id !== undefined) update.group_id = group_id;
      batch.update(tasksRef.doc(id), update);
    });
    return batch.commit();
  }

  /* ---------- Travel Groups ---------- */

  function onTravelGroupsChanged(callback) {
    return travelGroupsRef.orderBy('order_index').onSnapshot(snapshot => {
      const groups = [];
      snapshot.forEach(doc => {
        groups.push({ id: doc.id, ...doc.data() });
      });
      callback(groups);
    });
  }

  async function seedTravelGroups() {
    const snapshot = await travelGroupsRef.get();
    if (!snapshot.empty) return;

    const defaults = [
      { name: 'Preparing to Leave', color: '#A0B8C8', order_index: 0 },
      { name: "Ly's Stuff",         color: '#E8A0C4', order_index: 1 },
      { name: "Ryan's Stuff",       color: '#A0C4E8', order_index: 2 },
    ];

    const batch = db.batch();
    defaults.forEach(g => {
      const ref = travelGroupsRef.doc();
      batch.set(ref, {
        ...g,
        is_collapsed: false,
        created_at: firebase.firestore.FieldValue.serverTimestamp()
      });
    });
    return batch.commit();
  }

  async function updateTravelGroup(id, data) {
    return travelGroupsRef.doc(id).update(data);
  }

  async function seedTravelTasks() {
    const snapshot = await travelTasksRef.get();
    if (!snapshot.empty) return;

    // Look up group IDs by name
    const groupsSnap = await travelGroupsRef.orderBy('order_index').get();
    const groups = {};
    groupsSnap.forEach(doc => { groups[doc.data().name] = doc.id; });

    const preparing = groups['Preparing to Leave'];
    const lys = groups["Ly's Stuff"];
    const ryans = groups["Ryan's Stuff"];
    if (!preparing || !lys || !ryans) return;

    const now = firebase.firestore.FieldValue.serverTimestamp();
    const tasks = [
      // Preparing to Leave — Both
      { title: 'Empty bins', group_id: preparing, applies_to: 'both', order_index: 0 },
      { title: 'Empty fridge', group_id: preparing, applies_to: 'both', order_index: 1 },
      { title: 'Switch HIVE to ON & set 13°C', group_id: preparing, applies_to: 'both', order_index: 2 },
      { title: 'Empty dish washer', group_id: preparing, applies_to: 'both', order_index: 3 },
      { title: 'Empty washing machine', group_id: preparing, applies_to: 'both', order_index: 4 },
      { title: 'Take clothes off radiators', group_id: preparing, applies_to: 'both', order_index: 5 },
      { title: 'Water plants', group_id: preparing, applies_to: 'both', order_index: 6 },
      // Preparing to Leave — Moniaive only
      { title: 'Check external doors are locked', group_id: preparing, applies_to: 'moniaive', order_index: 7 },
      { title: 'Check garage doors are locked', group_id: preparing, applies_to: 'moniaive', order_index: 8 },
      { title: 'Check electric heaters are on low', group_id: preparing, applies_to: 'moniaive', order_index: 9 },
      { title: 'Turn off water pump', group_id: preparing, applies_to: 'moniaive', order_index: 10 },
      { title: 'Turn off printer', group_id: preparing, applies_to: 'moniaive', order_index: 11 },
      { title: 'Set RING to away', group_id: preparing, applies_to: 'moniaive', order_index: 12 },
      { title: 'Enable automation on HUE Lights', group_id: preparing, applies_to: 'moniaive', order_index: 13 },
      { title: 'Feed birds', group_id: preparing, applies_to: 'moniaive', order_index: 14 },
      // Preparing to Leave — Edinburgh only
      { title: 'Turn off underfloor heating', group_id: preparing, applies_to: 'edinburgh', order_index: 15 },
      // Ly's Stuff — all Both
      { title: 'Wallet', group_id: lys, applies_to: 'both', order_index: 0 },
      { title: 'Glasses', group_id: lys, applies_to: 'both', order_index: 1 },
      { title: 'Treat bag', group_id: lys, applies_to: 'both', order_index: 2 },
      { title: 'Canicross kit', group_id: lys, applies_to: 'both', order_index: 3 },
      { title: 'Leads', group_id: lys, applies_to: 'both', order_index: 4 },
      { title: 'Running gloves and headbands', group_id: lys, applies_to: 'both', order_index: 5 },
      { title: 'Running shoes', group_id: lys, applies_to: 'both', order_index: 6 },
      { title: 'Water bottle', group_id: lys, applies_to: 'both', order_index: 7 },
      { title: 'Running vest', group_id: lys, applies_to: 'both', order_index: 8 },
      { title: 'Running food', group_id: lys, applies_to: 'both', order_index: 9 },
      { title: 'Bose headphones', group_id: lys, applies_to: 'both', order_index: 10 },
      // Ryan's Stuff — all Both
      { title: 'Mounjaro Pen', group_id: ryans, applies_to: 'both', order_index: 0 },
      { title: 'Wallet', group_id: ryans, applies_to: 'both', order_index: 1 },
      { title: 'Glasses', group_id: ryans, applies_to: 'both', order_index: 2 },
      { title: 'Rain Jacket', group_id: ryans, applies_to: 'both', order_index: 3 },
      { title: 'Laptop', group_id: ryans, applies_to: 'both', order_index: 4 },
      { title: 'Charging pouch', group_id: ryans, applies_to: 'both', order_index: 5 },
      { title: 'Wired & Wireless Earbuds', group_id: ryans, applies_to: 'both', order_index: 6 },
      { title: 'NAS', group_id: ryans, applies_to: 'both', order_index: 7 },
      { title: 'Switch 2', group_id: ryans, applies_to: 'both', order_index: 8 },
      { title: 'Painkillers', group_id: ryans, applies_to: 'both', order_index: 9 },
    ];

    // Firestore batch limit is 500, we're well under
    const batch = db.batch();
    tasks.forEach(t => {
      const ref = travelTasksRef.doc();
      batch.set(ref, {
        ...t,
        description: '',
        created_by: 'RC',
        created_at: now,
        completed: false,
        completed_at: null
      });
    });
    return batch.commit();
  }

  /* ---------- Travel Tasks ---------- */

  function onTravelTasksChanged(callback) {
    return travelTasksRef.onSnapshot(snapshot => {
      const tasks = [];
      snapshot.forEach(doc => {
        tasks.push({ id: doc.id, ...doc.data() });
      });
      callback(tasks);
    });
  }

  async function createTravelTask(title, groupId, orderIndex, createdBy, appliesTo) {
    return travelTasksRef.add({
      title,
      description: '',
      applies_to: appliesTo || 'both',
      group_id: groupId,
      order_index: orderIndex,
      created_by: createdBy,
      created_at: firebase.firestore.FieldValue.serverTimestamp(),
      completed: false,
      completed_at: null
    });
  }

  async function updateTravelTask(id, data) {
    return travelTasksRef.doc(id).update(data);
  }

  async function completeTravelTask(id) {
    return travelTasksRef.doc(id).update({
      completed: true,
      completed_at: firebase.firestore.Timestamp.now()
    });
  }

  async function uncompleteTravelTask(id) {
    return travelTasksRef.doc(id).update({
      completed: false,
      completed_at: null
    });
  }

  async function deleteTravelTask(id) {
    return travelTasksRef.doc(id).delete();
  }

  async function reorderTravelTasks(taskIdOrderPairs) {
    const batch = db.batch();
    taskIdOrderPairs.forEach(({ id, order_index, group_id }) => {
      const update = { order_index };
      if (group_id !== undefined) update.group_id = group_id;
      batch.update(travelTasksRef.doc(id), update);
    });
    return batch.commit();
  }

  async function uncheckAllTravelTasks(taskIds) {
    const batch = db.batch();
    taskIds.forEach(id => {
      batch.update(travelTasksRef.doc(id), {
        completed: false,
        completed_at: null
      });
    });
    return batch.commit();
  }

  /* ---------- Weight Entries ---------- */

  function onWeightEntriesChanged(callback) {
    return weightEntriesRef.orderBy('date', 'asc').onSnapshot(snapshot => {
      const entries = [];
      snapshot.forEach(doc => {
        entries.push({ id: doc.id, ...doc.data() });
      });
      callback(entries);
    });
  }

  async function seedWeightEntries() {
    const snapshot = await weightEntriesRef.get();
    if (!snapshot.empty) return;

    const seedData = [
      { date: '2026-02-08', weight: 172.8 },
      { date: '2026-02-14', weight: 170.3 },
      { date: '2026-02-20', weight: 170.3 },
      { date: '2026-02-27', weight: 168.2 },
      { date: '2026-03-07', weight: 166.8 },
      { date: '2026-03-14', weight: 165.6 },
      { date: '2026-03-21', weight: 164.7 },
      { date: '2026-03-28', weight: 163.9 },
      { date: '2026-04-04', weight: 162.0 },
    ];

    const batch = db.batch();
    seedData.forEach(entry => {
      const ref = weightEntriesRef.doc();
      batch.set(ref, {
        date: firebase.firestore.Timestamp.fromDate(new Date(entry.date + 'T00:00:00')),
        weight: entry.weight,
        created_at: firebase.firestore.FieldValue.serverTimestamp()
      });
    });
    return batch.commit();
  }

  async function createWeightEntry(date, weight) {
    return weightEntriesRef.add({
      date: firebase.firestore.Timestamp.fromDate(new Date(date + 'T00:00:00')),
      weight,
      created_at: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  async function updateWeightEntry(id, data) {
    if (data.date && typeof data.date === 'string') {
      data.date = firebase.firestore.Timestamp.fromDate(new Date(data.date + 'T00:00:00'));
    }
    return weightEntriesRef.doc(id).update(data);
  }

  async function deleteWeightEntry(id) {
    return weightEntriesRef.doc(id).delete();
  }

  /* ---------- Public API ---------- */

  return {
    onGroupsChanged,
    createGroup,
    updateGroup,
    deleteGroup,
    reorderGroups,
    onTasksChanged,
    createTask,
    updateTask,
    completeTask,
    uncompleteTask,
    softDeleteTask,
    restoreTask,
    permanentlyDeleteTask,
    reorderTasks,
    // Travel
    onTravelGroupsChanged,
    seedTravelGroups,
    seedTravelTasks,
    updateTravelGroup,
    onTravelTasksChanged,
    createTravelTask,
    updateTravelTask,
    completeTravelTask,
    uncompleteTravelTask,
    deleteTravelTask,
    reorderTravelTasks,
    uncheckAllTravelTasks,
    // Weight
    onWeightEntriesChanged,
    seedWeightEntries,
    createWeightEntry,
    updateWeightEntry,
    deleteWeightEntry,
    // Setup
    setupPins
  };
})();
