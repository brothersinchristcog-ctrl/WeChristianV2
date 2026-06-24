// deploy.js - Run with: node deploy.js
process.env.GOOGLE_APPLICATION_CREDENTIALS = 'C:/Users/yraje/WeChristian/functions/serviceKey.json';

const firebase = require('C:/Users/yraje/AppData/Roaming/npm/node_modules/firebase-tools');

console.log('🚀 Starting Firebase Functions deployment...');

firebase.deploy({
  only: 'functions',
  project: 'wechristian-67f07',
  cwd: 'C:/Users/yraje/WeChristian',
  force: true
}).then(() => {
  console.log('✅ Deployment complete!');
}).catch((err) => {
  console.error('❌ Deployment failed:', err.message);
  process.exit(1);
});
