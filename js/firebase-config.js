/* ============================================
   Firebase Configuration
   ============================================ */

const firebaseConfig = {
  apiKey: "AIzaSyBTWJwB8r2M2kleX4Ey-P6c-e5N9Qvn138",
  authDomain: "crawfordcommon-20462.firebaseapp.com",
  projectId: "crawfordcommon-20462",
  storageBucket: "crawfordcommon-20462.firebasestorage.app",
  messagingSenderId: "916999532190",
  appId: "1:916999532190:web:f7d862356ee7a8503a158f",
  measurementId: "G-YC8KRKJQ26"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
