const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

async function check() {
  const users = await db.collection('users').get();
  let count = 0;
  users.forEach(doc => {
    if (doc.data().fcmToken) {
      count++;
      console.log('Found token for:', doc.data().name || doc.id);
    }
  });
  console.log(`Total tokens found: ${count}`);
}
check();
