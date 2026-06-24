import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';
import axios from 'axios';

// Get these from process.env in production, using Sandbox for now
const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID || 'PGTESTPAYUAT';
const SALT_KEY = process.env.PHONEPE_SALT_KEY || '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399';
const SALT_INDEX = process.env.PHONEPE_SALT_INDEX || '1';
const ENV = process.env.PHONEPE_ENV || 'UAT'; // 'UAT' or 'PROD'

const PHONEPE_HOST = ENV === 'PROD' 
  ? 'https://api.phonepe.com/apis/hermes' 
  : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

/**
 * Initiate Payment (Called from React Native App)
 */
export const initiatePhonePePayment = onCall({ invoker: 'public' }, async (request) => {
  try {
    const { amount, userId, mobileNumber } = request.data;
    
    if (!amount || !userId) {
      throw new HttpsError('invalid-argument', 'Amount and userId are required');
    }

    const transactionId = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
    
    // Construct payload
    const payload = {
      merchantId: MERCHANT_ID,
      merchantTransactionId: transactionId,
      merchantUserId: userId,
      amount: amount * 100, // PhonePe expects amount in paise
      redirectUrl: `https://your-app-scheme.com/payment-callback`, // Replace with your deep link later
      redirectMode: 'REDIRECT',
      callbackUrl: `https://us-central1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/phonepeWebhook`,
      mobileNumber: mobileNumber || '',
      paymentInstrument: {
        type: 'PAY_PAGE'
      }
    };

    const payloadString = JSON.stringify(payload);
    const base64EncodedPayload = Buffer.from(payloadString).toString('base64');
    
    // Checksum = sha256(base64Payload + apiEndPoint + saltKey) + ### + saltIndex
    const stringToHash = base64EncodedPayload + '/pg/v1/pay' + SALT_KEY;
    const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
    const checksum = `${sha256}###${SALT_INDEX}`;

    // Call PhonePe API
    const response = await axios.post(`${PHONEPE_HOST}/pg/v1/pay`, {
      request: base64EncodedPayload
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': checksum,
        'X-MERCHANT-ID': MERCHANT_ID
      }
    });

    if (response.data && response.data.success) {
      // Save pending transaction to Firestore
      const db = getFirestore();
      await db.collection('transactions').doc(transactionId).set({
        userId,
        amount,
        status: 'PENDING',
        createdAt: FieldValue.serverTimestamp(),
        type: 'DONATION',
      });

      return { 
        success: true, 
        redirectUrl: response.data.data.instrumentResponse.redirectInfo.url,
        transactionId 
      };
    } else {
      throw new Error(response.data.message || 'Payment initiation failed');
    }

  } catch (error: any) {
    console.error('initiatePhonePePayment Error:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Webhook to receive server-to-server status updates from PhonePe
 */
export const phonepeWebhook = onRequest(async (request, response) => {
  try {
    const { response: base64Payload } = request.body;
    const xVerify = request.headers['x-verify'] as string;

    if (!base64Payload || !xVerify) {
       response.status(400).send('Invalid request');
       return;
    }

    // Verify signature
    const stringToHash = base64Payload + SALT_KEY;
    const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
    const expectedChecksum = `${sha256}###${SALT_INDEX}`;

    if (expectedChecksum !== xVerify) {
      console.error('Invalid signature');
      response.status(400).send('Invalid signature');
      return;
    }

    const decodedPayload = JSON.parse(Buffer.from(base64Payload, 'base64').toString('utf-8'));
    const { merchantTransactionId, code, amount } = decodedPayload.data;

    const db = getFirestore();
    const status = code === 'PAYMENT_SUCCESS' ? 'SUCCESS' : 'FAILED';

    await db.collection('transactions').doc(merchantTransactionId).update({
      status,
      updatedAt: FieldValue.serverTimestamp(),
      phonepeResponseCode: code
    });

    response.status(200).send('OK');
  } catch (error) {
    console.error('Webhook processing error:', error);
    response.status(500).send('Internal Server Error');
  }
});
