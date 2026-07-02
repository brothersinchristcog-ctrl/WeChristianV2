/**
 * ============================================================
 * ONE-TIME FIRESTORE MIGRATION SCRIPT
 * ============================================================
 * Moves old root-level collections into church-scoped paths:
 *
 *   broadcasts      → churches/{churchId}/broadcasts
 *   worshipSongs    → churches/{churchId}/worshipSongs
 *   settings        → churches/{churchId}/settings
 *   member_profiles → churches/{churchId}/members
 *
 * HOW TO RUN:
 *   cd c:\Users\sunil\we_christian\functions
 *   node migrateFirestore.cjs
 * ============================================================
 */

const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccountPath = 'C:\\Users\\sunil\\we_christian\\serviceAccountKey.json';

if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} else {
  admin.initializeApp({ projectId: 'church-mobile-app-b7e27' });
}

const db = admin.firestore();

// ── SET YOUR CHURCH DOCUMENT IDs HERE ────────────────────────
// These are the Firestore document IDs under the 'churches' collection.
// From the screenshot:
//   Faith Church       = KhmBeNWxlrxwS1hGhuw
//   Brothers in Christ = b0x97BKQYsmBRcU0jzC5
//
// Change TARGET_CHURCH_ID to whichever church you want the root data copied into.
const TARGET_CHURCH_ID = 'KhmBeNWxlrxwS1hGhuw'; // Faith Church

// Root collections to migrate → destination subcollection name
const MIGRATION_MAP = [
  { rootCollection: 'broadcasts',      churchSubcollection: 'broadcasts' },
  { rootCollection: 'worshipSongs',    churchSubcollection: 'worshipSongs' },
  { rootCollection: 'settings',        churchSubcollection: 'settings' },
  { rootCollection: 'member_profiles', churchSubcollection: 'members' },
];

async function migrateCollection(rootCollection, churchSubcollection) {
  console.log(`\n📦 Migrating: ${rootCollection} → churches/${TARGET_CHURCH_ID}/${churchSubcollection}`);

  const sourceRef = db.collection(rootCollection);
  const destRef   = db.collection('churches').doc(TARGET_CHURCH_ID).collection(churchSubcollection);

  const snapshot = await sourceRef.get();

  if (snapshot.empty) {
    console.log(`   ⚠️  No documents found in root '${rootCollection}'. Skipping.`);
    return;
  }

  console.log(`   Found ${snapshot.size} documents.`);

  let migrated = 0;
  let skipped  = 0;

  for (const doc of snapshot.docs) {
    const destDoc  = destRef.doc(doc.id);
    const destSnap = await destDoc.get();

    if (destSnap.exists) {
      console.log(`   ⏭️  Skipping ${doc.id} — already exists in destination.`);
      skipped++;
      continue;
    }

    await destDoc.set(doc.data());
    console.log(`   ✅ Migrated: ${doc.id}`);
    migrated++;
  }

  console.log(`   ✔ Done — Migrated: ${migrated}, Skipped: ${skipped}`);
}

async function run() {
  console.log('🚀 Firestore Migration Starting...');
  console.log(`   Target Church ID: ${TARGET_CHURCH_ID}\n`);

  for (const mapping of MIGRATION_MAP) {
    try {
      await migrateCollection(mapping.rootCollection, mapping.churchSubcollection);
    } catch (err) {
      console.error(`❌ Error migrating '${mapping.rootCollection}':`, err.message);
    }
  }

  console.log('\n\n🎉 Migration Complete!');
  console.log('─────────────────────────────────────────────────');
  console.log('Next steps:');
  console.log(`  1. Open Firebase Console → churches → ${TARGET_CHURCH_ID}`);
  console.log('     Confirm all subcollections (broadcasts, worshipSongs, settings, members) are there.');
  console.log('  2. Once verified, manually delete the OLD root-level collections:');
  console.log('     broadcasts, worshipSongs, settings, member_profiles');
  console.log('  3. The `users` collection is intentionally left at root (global auth).');
  console.log('─────────────────────────────────────────────────\n');
}

run().catch(console.error);
