/* ============================================
   Firestore Data Layer
   ============================================ */

const Store = (() => {
  const groupsRef = db.collection('groups');
  const tasksRef  = db.collection('tasks');
  const configRef = db.collection('config');
  const travelGroupsRef = db.collection('travel_groups');
  const travelTasksRef  = db.collection('travel_tasks');
  const weightEntriesRef = db.collection('weight_entries');

  /* ---------- PIN Auth ---------- */

  async function verifyPin(pin) {
    const hash = await hashPin(pin);
    const doc = await configRef.doc('app').get();
    if (!doc.exists) return null;
    const data = doc.data();
    if (data.pins.rc_hash === hash) return 'RC';
    if (data.pins.lc_hash === hash) return 'LC';
    return null;
  }

  async function hashPin(pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + '_lifetracker_salt');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /* ---------- Groups (Tasks page) ---------- */

  function onGroupsChanged(callback) {
    return groupsRef.orderBy('order_index').onSnapshot(snapshot => {
      const groups = [];
      snapshot.forEach(doc => {
        groups.push({ id: doc.id, ...doc.data() });
      });
      callback(groups);
    });
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

  function onTasksChanged(callback) {
    return tasksRef.onSnapshot(snapshot => {
      const tasks = [];
      snapshot.forEach(doc => {
        tasks.push({ id: doc.id, ...doc.data() });
      });
      callback(tasks);
    });
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

  /* ---------- Setup helper ---------- */

  async function setupPins(rcPin, lcPin) {
    const rcHash = await hashPin(rcPin);
    const lcHash = await hashPin(lcPin);
    return configRef.doc('app').set({
      pins: { rc_hash: rcHash, lc_hash: lcHash }
    });
  }

  /* ---------- Public API ---------- */

  return {
    verifyPin,
    hashPin,
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
