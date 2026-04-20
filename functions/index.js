/* ============================================
   LifeTracker — Cloud Functions
   ============================================ */

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

/* ---------- Helpers ---------- */

async function getAllTokens() {
  // Read both prefs docs directly instead of querying (avoids index requirements)
  const docs = await Promise.all([
    db.collection("config").doc("prefs_RC").get(),
    db.collection("config").doc("prefs_LC").get()
  ]);
  const tokens = [];
  docs.forEach(doc => {
    if (doc.exists && doc.data().fcm_token) {
      tokens.push({ token: doc.data().fcm_token, docId: doc.id });
    }
  });
  return tokens;
}

async function sendToAll(data) {
  const tokenEntries = await getAllTokens();
  if (tokenEntries.length === 0) return;

  const tokens = tokenEntries.map(t => t.token);
  const response = await getMessaging().sendEachForMulticast({
    data,
    tokens
  });

  // Clean up invalid tokens
  response.responses.forEach((resp, i) => {
    if (resp.error &&
        (resp.error.code === "messaging/invalid-registration-token" ||
         resp.error.code === "messaging/registration-token-not-registered")) {
      db.collection("config").doc(tokenEntries[i].docId).update({ fcm_token: null });
    }
  });
}

/* ---------- Weight Entry Notification ---------- */

exports.onWeightEntryCreated = onDocumentCreated(
  "weight_entries/{entryId}",
  async () => {
    const { logger } = require("firebase-functions");

    // Rate limit: use a single doc with timestamp, skip if updated < 60s ago
    const rateRef = db.collection("notification_log").doc("weight_rate");
    const rateDoc = await rateRef.get();
    if (rateDoc.exists) {
      const lastSent = rateDoc.data().sent_at;
      if (lastSent && (Date.now() - lastSent.toMillis()) < 60000) {
        logger.info("Rate limited — skipping weight notification");
        return;
      }
    }
    await rateRef.set({ sent_at: FieldValue.serverTimestamp() });

    const tokenEntries = await getAllTokens();
    logger.info(`Found ${tokenEntries.length} FCM token(s)`);

    if (tokenEntries.length === 0) {
      logger.warn("No FCM tokens found — skipping notification");
      return;
    }

    await sendToAll({
      title: "LifeTracker",
      body: "A weight entry has been logged"
    });

    logger.info("Weight notification sent");
  }
);

/* ---------- Due Date Check (daily at 8am UK) ---------- */

exports.checkDueDates = onSchedule(
  { schedule: "0 8 * * *", timeZone: "Europe/London" },
  async () => {
    const now = new Date();
    // Normalize to midnight UK time
    const today = new Date(now.toLocaleDateString("en-CA", { timeZone: "Europe/London" }) + "T00:00:00");
    const dayMs = 86400000;

    const snapshot = await db.collection("tasks")
      .where("completed", "==", false)
      .where("deleted", "==", false)
      .get();

    const notifications = [];

    snapshot.forEach(doc => {
      const task = doc.data();
      if (!task.due_date) return;

      const dueDate = task.due_date.toDate();
      const dueMidnight = new Date(dueDate.toISOString().split("T")[0] + "T00:00:00");
      const diffDays = Math.round((dueMidnight - today) / dayMs);

      if (diffDays < 0 || diffDays > 2) return;

      const todayISO = today.toISOString().split("T")[0];
      const dedupKey = `${doc.id}_${diffDays}_${todayISO}`;

      let label;
      if (diffDays === 0) label = "is due today";
      else if (diffDays === 1) label = "is due tomorrow";
      else label = "is due in 2 days";

      notifications.push({
        title: task.title,
        label,
        dedupKey
      });
    });

    // Also check recurring tasks
    const recurringSnapshot = await db.collection("recurring_tasks")
      .where("deleted", "==", false)
      .get();

    recurringSnapshot.forEach(doc => {
      const task = doc.data();
      if (!task.next_due) return;

      const dueDate = task.next_due.toDate();
      const dueMidnight = new Date(dueDate.toISOString().split("T")[0] + "T00:00:00");
      const diffDays = Math.round((dueMidnight - today) / dayMs);

      // Notify at 5 days before, 1 day before, and on due date
      if (diffDays !== 0 && diffDays !== 1 && diffDays !== 5) return;

      const todayISO = today.toISOString().split("T")[0];
      const dedupKey = `recurring_${doc.id}_${diffDays}_${todayISO}`;

      let label;
      if (diffDays === 0) label = "is due today";
      else if (diffDays === 1) label = "is due tomorrow";
      else label = "is due in 5 days";

      notifications.push({
        title: task.title,
        label,
        dedupKey
      });
    });

    // Send notifications using atomic create to prevent race condition duplicates
    for (const notif of notifications) {
      const logRef = db.collection("notification_log").doc(notif.dedupKey);

      try {
        // create() fails if doc already exists — atomic dedup
        await logRef.create({ sent_at: new Date(), type: "due_date" });
      } catch (err) {
        if (err.code === 6) continue; // ALREADY_EXISTS — already sent
        throw err;
      }

      await sendToAll({
        title: "LifeTracker",
        body: `"${notif.title}" ${notif.label}`
      });
    }
  }
);
