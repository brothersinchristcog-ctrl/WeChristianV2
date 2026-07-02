const crypto = require('crypto');
const axios = require('axios');

const MERCHANT_ID = 'PGTESTPAYUAT86';
const SALT_KEY = '96434309-7796-489d-8924-ab56988a6076';
const SALT_INDEX = '1';
const PHONEPE_HOST = 'https://api-preprod.phonepe.com/apis/pg-sandbox';

async function test() {
  const transactionId = `TXN${Date.now()}`;
  
  const payload = {
    merchantId: MERCHANT_ID,
    merchantTransactionId: transactionId,
    merchantUserId: 'MUID123',
    amount: 10000,
    redirectUrl: 'https://webhook.site/redirect',
    redirectMode: 'REDIRECT',
    callbackUrl: 'https://webhook.site/callback',
    mobileNumber: '9999999999',
    paymentInstrument: {
      type: 'PAY_PAGE'
    }
  };

  const payloadString = JSON.stringify(payload);
  const base64EncodedPayload = Buffer.from(payloadString).toString('base64');
  
  const stringToHash = base64EncodedPayload + '/pg/v1/pay' + SALT_KEY;
  const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
  const checksum = `${sha256}###${SALT_INDEX}`;

  try {
    const response = await axios.post(`${PHONEPE_HOST}/pg/v1/pay`, {
      request: base64EncodedPayload
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': checksum,
        'X-MERCHANT-ID': MERCHANT_ID
      }
    });

    console.log('Success:', response.data);
  } catch (err) {
    console.error('Error:', err.response ? err.response.data : err.message);
  }
}

test();
