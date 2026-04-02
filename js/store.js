/* ============================================
   Firestore Data Layer
   ============================================ */

const Store = (() => {
  const groupsRef = db.collection('groups');
  const tasksRef  = db.collection('tasks');
  const configRef = db.collection('config');

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

  /* ---------- Groups ---------- */

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
    // Soft-delete all tasks in this group
    const tasks = await tasksRef.where('group_id', '==', id).get();
    const batch = db.batch();
    const now = firebase.firestore.Timestamp.now();
    tasks.forEach(doc => {
      batch.update(doc.ref, { deleted: true, deleted_at: now });
    });
    // Delete the group document
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
    setupPins
  };
})();
