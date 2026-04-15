/* ============================================
   Firebase Cloud Messaging — Service Worker
   Handles background push notifications
   ============================================ */

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBTWJwB8r2M2kleX4Ey-P6c-e5N9Qvn138",
  authDomain: "crawfordcommon-20462.firebaseapp.com",
  projectId: "crawfordcommon-20462",
  storageBucket: "crawfordcommon-20462.firebasestorage.app",
  messagingSenderId: "916999532190",
  appId: "1:916999532190:web:f7d862356ee7a8503a158f"
});

const messaging = firebase.messaging();

// Handle data-only messages when app is in background
messaging.onBackgroundMessage((payload) => {
  if (!payload.data || typeof payload.data.title !== 'string') return;
  const title = payload.data.title.slice(0, 200) || 'LifeTracker';
  const body = (typeof payload.data.body === 'string' ? payload.data.body : '').slice(0, 500);
  self.registration.showNotification(title, {
    body,
    icon: 'img/icon-v2-180.png',
    badge: 'img/icon-v2-152.png'
  });
});
