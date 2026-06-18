const firestore = require('@react-native-firebase/firestore').default;

async function check() {
  const db = firestore();
  const snapshot = await db.collection('sermons').limit(5).get();
  snapshot.docs.forEach(doc => {
    console.log(doc.id, '->', doc.data().youtubeId);
  });
}
check();
