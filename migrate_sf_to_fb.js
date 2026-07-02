/**
 * migrate_sf_to_fb.js
 *
 * This script connects to your old Salesforce database, downloads all your 
 * Sermons, Events, Daily Promises, and Worship Songs, and uploads them to 
 * your new Firebase database under your specific church folder (COGBLR).
 *
 * HOW TO RUN:
 *   node migrate_sf_to_fb.js
 */

const jwt = require('jsonwebtoken');
const axios = require('axios');
const admin = require('firebase-admin');
require('dotenv').config({ path: './functions/.env' });

// 1. Initialize Firebase Admin
let db;
try {
  const serviceAccount = require('./serviceAccountKey.json');
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
  db = admin.firestore();
} catch (error) {
  console.error("❌ ERROR: Could not load serviceAccountKey.json");
  process.exit(1);
}

// Target Church ID
const CHURCH_SUBDOMAIN = 'cogblr';

// 2. Salesforce Credentials
const consumerKey = process.env.SF_CONSUMER_KEY;
const username = process.env.SF_USERNAME;
const loginUrl = process.env.SF_LOGIN_URL;
const privateKey = (process.env.SF_PRIVATE_KEY || '').replace(/\\n/g, '\n');

async function getSfAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: consumerKey,
    sub: username,
    aud: loginUrl,
    exp: now + 300
  };
  const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });
  const params = new URLSearchParams();
  params.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  params.append('assertion', token);

  const response = await axios.post(`${loginUrl}/services/oauth2/token`, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  return {
    accessToken: response.data.access_token,
    instanceUrl: response.data.instance_url
  };
}

async function fetchFromSf(instanceUrl, accessToken, query) {
  const url = `${instanceUrl}/services/data/v60.0/query?q=${encodeURIComponent(query)}`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return res.data.records;
}

async function runMigration() {
  try {
    console.log('🔍 Finding Church Document in Firebase...');
    const churchQuery = await db.collection('churches').where('subdomain', '==', CHURCH_SUBDOMAIN).limit(1).get();
    
    if (churchQuery.empty) {
      console.error('❌ Church not found in Firebase. Did you run seed_church.js?');
      process.exit(1);
    }
    const churchId = churchQuery.docs[0].id;
    console.log(`✅ Found Church ID: ${churchId}`);

    const churchRef = db.collection('churches').doc(churchId);

    console.log('\n🔐 Authenticating with Salesforce...');
    const { accessToken, instanceUrl } = await getSfAccessToken();
    console.log('✅ Connected to Salesforce');

    // --- Migrate Sermons ---
    console.log('\n📥 Migrating Sermons...');
    const sermons = await fetchFromSf(instanceUrl, accessToken, 
      'SELECT Id, Name, Title_Telugu__c, YouTube_ID__c, Sermon_Date__c, Pastor_Name__c, Duration__c, Description__c, Scripture_Reference__c FROM Sermon__c'
    );
    let sCount = 0;
    for (const record of sermons) {
      const data = {
        title: record.Name || '',
        titleTelugu: record.Title_Telugu__c || '',
        youtubeId: record.YouTube_ID__c || '',
        date: record.Sermon_Date__c || new Date().toISOString().split('T')[0],
        pastor: record.Pastor_Name__c || 'Sunil Babu',
        duration: record.Duration__c || '00:00',
        description: record.Description__c || '',
        scripture: record.Scripture_Reference__c || '',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };
      await churchRef.collection('sermons').doc(record.Id).set(data);
      sCount++;
    }
    console.log(`✅ Migrated ${sCount} Sermons`);

    // --- Migrate Daily Promises ---
    console.log('\n📥 Migrating Daily Promises...');
    const promises = await fetchFromSf(instanceUrl, accessToken, 
      'SELECT Id, Date__c, Promises__c, Promise_text_telugu__c, Devotional_Note__c, Pastor_Name__c, YouTube_ID__c, Verse_Reference_En__c FROM Daily_Promises__c'
    );
    let pCount = 0;
    for (const record of promises) {
      const data = {
        date: record.Date__c || new Date().toISOString().split('T')[0],
        verse: record.Promises__c || '',
        verseTelugu: record.Promise_text_telugu__c || '',
        verseReference: record.Verse_Reference_En__c || '',
        devotionalNote: record.Devotional_Note__c || '',
        pastor: record.Pastor_Name__c || '',
        youtubeId: record.YouTube_ID__c || '',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };
      await churchRef.collection('dailyPromises').doc(record.Id).set(data);
      pCount++;
    }
    console.log(`✅ Migrated ${pCount} Daily Promises`);

    // --- Migrate Events ---
    console.log('\n📥 Migrating Events...');
    const events = await fetchFromSf(instanceUrl, accessToken, 
      'SELECT Id, Name, Title_Telugu__c, Date__c, Time__c, End_Time__c, Location__c, Address__c, Description__c, Banner_Image_URL__c FROM Schedule_Event__c'
    );
    let eCount = 0;
    for (const record of events) {
      const data = {
        title: record.Name || '',
        titleTelugu: record.Title_Telugu__c || '',
        date: record.Date__c || new Date().toISOString().split('T')[0],
        startTime: record.Time__c || '10:00',
        endTime: record.End_Time__c || '12:00',
        location: record.Location__c || 'Church',
        address: record.Address__c || '',
        description: record.Description__c || '',
        bannerUrl: record.Banner_Image_URL__c || '',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };
      await churchRef.collection('events').doc(record.Id).set(data);
      eCount++;
    }
    console.log(`✅ Migrated ${eCount} Events`);

    // --- Migrate Worship Songs ---
    console.log('\n📥 Migrating Worship Songs...');
    const songs = await fetchFromSf(instanceUrl, accessToken, 
      'SELECT Id, Name, Song_Title_Telugu__c, Artist__c, Key_Signature__c, Lyrics__c, Category__c, YouTube_ID__c FROM Worship_Song__c'
    );
    let wCount = 0;
    for (const record of songs) {
      const data = {
        title: record.Name || '',
        titleTe: record.Song_Title_Telugu__c || '',
        artist: record.Artist__c || '',
        key: record.Key_Signature__c || '',
        lyrics: record.Lyrics__c || '',
        category: record.Category__c || '',
        youtubeId: record.YouTube_ID__c || '',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };
      await churchRef.collection('worshipSongs').doc(record.Id).set(data);
      wCount++;
    }
    console.log(`✅ Migrated ${wCount} Worship Songs`);

    console.log('\n🎉 ALL DATA MIGRATED SUCCESSFULLY! 🎉');
    console.log('You can now open the WeChristian app, and all your content will be there.');

  } catch (err) {
    console.error('❌ Migration Error:', err.response?.data || err.message);
  }
}

runMigration();
