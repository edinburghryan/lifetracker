/* ============================================
   Firestore Data Layer
   ============================================ */

const Store = (() => {
  const configRef = db.collection('config');
  const groupsRef = db.collection('groups');
  const tasksRef  = db.collection('tasks');
  const travelGroupsRef = db.collection('travel_groups');
  const travelTasksRef  = db.collection('travel_tasks');
  const weightEntriesRef = db.collection('weight_entries');

  /* ---------- App Config ---------- */

  async function getConfig() {
    const doc = await configRef.doc('app').get();
    return doc.exists ? doc.data() : {};
  }

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

  /* ---------- User Preferences ---------- */

  async function getPrefs(userId) {
    const doc = await configRef.doc('prefs_' + userId).get();
    return doc.exists ? doc.data() : {};
  }

  async function savePrefs(userId, data) {
    return configRef.doc('prefs_' + userId).set(data, { merge: true });
  }

  /* ---------- Public API ---------- */

  return {
    getConfig,
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
    createWeightEntry,
    updateWeightEntry,
    deleteWeightEntry,
    // Preferences
    getPrefs,
    savePrefs
  };
})();
