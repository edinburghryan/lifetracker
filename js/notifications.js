/* ============================================
   LifeTracker — Push Notifications (FCM)
   ============================================ */

const Notifications = (() => {
  const VAPID_KEY = 'BNsN3HIjEHgJy8JJS2kILSFq9nd2Am86A3GpacfXKpyK8nMLiKk0U7tldzq8PucA1bupxsMY7oAjJSR-euyXPvc';

  let messaging = null;
  let swRegistration = null;
  let currentUser = null;

  /* ---------- Init ---------- */

  async function init(userId) {
    currentUser = userId;

    if (!('serviceWorker' in navigator) || !('Notification' in window)) return;
    if (typeof firebase === 'undefined' || !firebase.messaging) return;

    try {
      swRegistration = await navigator.serviceWorker.register('firebase-messaging-sw.js');
      messaging = firebase.messaging();

      // Foreground message handler
      messaging.onMessage((payload) => {
        if (!payload.data || typeof payload.data.title !== 'string') return;
        const title = payload.data.title.slice(0, 200) || 'LifeTracker';
        const body = (typeof payload.data.body === 'string' ? payload.data.body : '').slice(0, 500);
        new Notification(title, { body, icon: 'img/icon-v2-180.png' });
      });

      // Silently refresh token if permission already granted
      if (Notification.permission === 'granted') {
        await saveToken();
      }
    } catch (err) {
      console.error('Notifications init error:', err);
    }
  }

  /* ---------- Permission ---------- */

  async function requestPermission() {
    if (!messaging) return false;

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await saveToken();
        return true;
      }
    } catch (err) {
      console.error('Notification permission error:', err);
    }
    return false;
  }

  /* ---------- Token Management ---------- */

  async function saveToken() {
    if (!messaging || !currentUser) return;

    try {
      const token = await messaging.getToken({
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swRegistration
      });
      if (token) {
        Store.savePrefs(currentUser, {
          fcm_token: token,
          fcm_token_updated: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (err) {
      console.error('FCM token error:', err);
    }
  }

  /* ---------- Teardown ---------- */

  function teardown() {
    messaging = null;
    currentUser = null;
  }

  return { init, requestPermission, teardown };
})();
