const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config({ path: './functions/.env' });

const consumerKey = process.env.SF_CONSUMER_KEY;
const username = process.env.SF_USERNAME;
const loginUrl = process.env.SF_LOGIN_URL;
const privateKey = (process.env.SF_PRIVATE_KEY || '').replace(/\\n/g, '\n');

async function run() {
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: consumerKey, sub: username, aud: loginUrl, exp: now + 300 };
  const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });
  const params = new URLSearchParams();
  params.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  params.append('assertion', token);
  const response = await axios.post(`${loginUrl}/services/oauth2/token`, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  const { access_token, instance_url } = response.data;
  
  const getFields = async (obj) => {
    const url = `${instance_url}/services/data/v60.0/sobjects/${obj}/describe`;
    const res = await axios.get(url, { headers: { Authorization: `Bearer ${access_token}` } });
    console.log(`\n${obj} fields:`);
    res.data.fields.forEach(f => {
      if (f.name.endsWith('__c') || f.name === 'Name') console.log(f.name);
    });
  };

  await getFields('Daily_Promises__c');
}
run();
