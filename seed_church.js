/**
 * seed_church.js
 *
 * Seeds the "churches" collection in Firestore with the Brothers in Christ - Church of God document.
 *
 * HOW TO RUN:
 *   1. Make sure you have Node.js installed.
 *   2. Run: npm install firebase-admin
 *   3. Run: node seed_church.js
 *
 * This script uses the Firebase Admin SDK with a service account.
 * Before running, download your Firebase service account key:
 *   Firebase Console → Project Settings → Service Accounts → Generate new private key
 * Save it as "serviceAccountKey.json" in the same folder as this script.
 */

const admin = require('firebase-admin');

try {
  const serviceAccount = require('./serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (error) {
  console.error("❌ ERROR: Could not load serviceAccountKey.json");
  console.error("Please download the service account key from the Firebase Console:");
  console.error("Project Settings -> Service Accounts -> Generate new private key");
  console.error("and save it as 'serviceAccountKey.json' in this directory.");
  process.exit(1);
}

const db = admin.firestore();

// ─── Church Data ─────────────────────────────────────────────────────────────

const COG_CHURCH = {
  name: 'Brothers in Christ - Church of God',
  subdomain: 'cogblr',           // This is the Church Code members use (lowercase)
  contactEmail: 'admin@brothersinchristcog.org',
  contactPhone: '8000504070',
  address: 'Bangalore, Karnataka, India',

  theme: {
    primaryColor: '#1a2d5a',     // Deep Navy Blue
    secondaryColor: '#c0392b',   // Deep Red
    backgroundColor: '',         // Leave empty = use system dark/light
    textColor: '',               // Leave empty = use system dark/light
    logoUrl: '',                 // Add a Firebase Storage URL here later
    bannerUrl: '',
  },

  features: {
    hasSermons: true,
    hasDailyPromises: true,
    hasWorshipSongs: true,
    hasGiving: true,
  },

  givingDetails: {
    upiId: '8000504070@ybl',
    phonepeNumber: '8000504070',
    accountName: 'Brothers in Christ Church of God',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
  },

  socialLinks: {
    youtube: '',       // Add your YouTube channel URL
    facebook: '',      // Add your Facebook page URL
    instagram: '',
    website: '',
  },

  subscriptionTier: 'premium',   // Set to premium for your own church
  memberCount: 0,
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  createdBy: 'seed_script',
};

// ─── Seed Function ────────────────────────────────────────────────────────────

async function seed() {
  try {
    console.log('🔥 Connecting to Firestore...');

    // Check if a church with this subdomain already exists
    const existing = await db
      .collection('churches')
      .where('subdomain', '==', COG_CHURCH.subdomain)
      .limit(1)
      .get();

    if (!existing.empty) {
      const docId = existing.docs[0].id;
      console.log(`⚠️  Church already exists with ID: ${docId}`);
      console.log('   Updating existing document...');
      await db.collection('churches').doc(docId).set(COG_CHURCH, { merge: true });
      console.log(`✅ Church updated successfully! Document ID: ${docId}`);
      console.log(`\n📋 Church Code: COGBLR`);
      console.log(`   Members can use this code to join your church in the app.\n`);
    } else {
      const docRef = await db.collection('churches').add(COG_CHURCH);
      console.log(`\n✅ Church created successfully!`);
      console.log(`   Document ID: ${docRef.id}`);
      console.log(`\n📋 Church Code: COGBLR`);
      console.log(`   Members can use this code to join your church in the app.`);
      console.log(`\n💡 IMPORTANT: Copy the Document ID above and save it.`);
      console.log(`   You will need it if you want to pre-link any admin accounts.\n`);
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding church:', err);
    process.exit(1);
  }
}

seed();
