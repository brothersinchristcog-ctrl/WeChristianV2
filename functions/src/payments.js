import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
const getDb = () => getFirestore();
const PHONEPE_PROD_URL = 'https://api.phonepe.com/apis/hermes';
const PHONEPE_UAT_URL = 'https://api-preprod.phonepe.com/apis/pg-sandbox';
import * as functionsV1 from 'firebase-functions/v1';
export const processDonationV1True = functionsV1.https.onCall(async (data, context) => {
    const { amount, churchId, purpose, memberId } = data;
    if (!memberId) {
        throw new functionsV1.https.HttpsError('unauthenticated', 'User ID must be provided.');
    }
    if (!amount || !churchId) {
        throw new functionsV1.https.HttpsError('invalid-argument', 'Missing amount or churchId.');
    }
    const transactionId = `TXN_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    try {
        // 1. Fetch Church PhonePe Secrets
        const secretDoc = await getDb().collection('churches').doc(churchId).collection('secrets').doc('payment').get();
        if (!secretDoc.exists) {
            throw new functionsV1.https.HttpsError('not-found', 'Payment is not configured for this church.');
        }
        const secrets = secretDoc.data();
        if (!secrets?.phonePeMerchantId || !secrets?.phonePeSaltKey || !secrets?.phonePeSaltIndex) {
            throw new functionsV1.https.HttpsError('not-found', 'Incomplete payment configuration.');
        }
        const { phonePeMerchantId, phonePeSaltKey, phonePeSaltIndex } = secrets;
        const isUAT = phonePeMerchantId.includes('UAT') || phonePeMerchantId.includes('TEST') || phonePeMerchantId === 'PGTESTPAYUAT';
        const baseUrl = isUAT ? PHONEPE_UAT_URL : PHONEPE_PROD_URL;
        // 2. Create Transaction in Firestore
        await getDb().collection('churches').doc(churchId).collection('transactions').doc(transactionId).set({
            transactionId,
            userId: memberId,
            churchId,
            amount: Number(amount),
            purpose: purpose || 'Donation',
            status: 'PENDING',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
        // 3. Construct PhonePe Payload
        const redirectUrl = `wechristian://payment-success?txnId=${transactionId}`;
        const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
        const region = 'us-central1'; // Default Firebase region
        const webhookUrl = `https://${region}-${projectId}.cloudfunctions.net/phonepeWebhook`;
        const payloadObj = {
            merchantId: phonePeMerchantId,
            merchantTransactionId: transactionId,
            merchantUserId: memberId,
            amount: Math.round(Number(amount) * 100), // in paise
            redirectUrl,
            redirectMode: 'REDIRECT',
            callbackUrl: webhookUrl,
            paymentInstrument: {
                type: 'PAY_PAGE'
            }
        };
        const base64Payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64');
        const endpoint = '/pg/v1/pay';
        // 4. Generate Checksum
        const stringToHash = base64Payload + endpoint + phonePeSaltKey;
        const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
        const checksum = `${sha256}###${phonePeSaltIndex}`;
        // 5. Call PhonePe API
        const response = await fetch(`${baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-VERIFY': checksum
            },
            body: JSON.stringify({ request: base64Payload })
        });
        const result = await response.json();
        if (result.success && result.data?.instrumentResponse?.redirectInfo?.url) {
            return {
                success: true,
                redirectUrl: result.data.instrumentResponse.redirectInfo.url,
                transactionId
            };
        }
        else {
            console.error('PhonePe init failed', result);
            await getDb().collection('churches').doc(churchId).collection('transactions').doc(transactionId).update({
                status: 'FAILED',
                error: result.message || 'Payment initiation failed',
                updatedAt: FieldValue.serverTimestamp(),
            });
            throw new functionsV1.https.HttpsError('internal', result.message || 'Failed to initiate payment with provider.');
        }
    }
    catch (error) {
        console.error('Payment Error', error);
        throw new functionsV1.https.HttpsError('internal', error.message || 'Server error');
    }
});
export const phonepeWebhook = onRequest({ invoker: 'public' }, async (req, res) => {
    try {
        const b64Response = req.body.response;
        if (!b64Response) {
            res.status(400).send('No response field');
            return;
        }
        const decodedStr = Buffer.from(b64Response, 'base64').toString('utf8');
        const payload = JSON.parse(decodedStr);
        const transactionId = payload.data?.merchantTransactionId;
        if (!transactionId) {
            res.status(400).send('Invalid transaction id');
            return;
        }
        // Since we now store transactions under church, we must query group or know the churchId.
        // The webhook payload doesn't contain churchId by default unless we passed it.
        // We can query group for the transactionId.
        const txnQuery = await getDb().collectionGroup('transactions').where('transactionId', '==', transactionId).get();
        if (txnQuery.empty) {
            res.status(404).send('Transaction not found');
            return;
        }
        const txnDoc = txnQuery.docs[0];
        const txnData = txnDoc.data();
        const churchId = txnData.churchId;
        const secretDoc = await getDb().collection('churches').doc(churchId).collection('secrets').doc('payment').get();
        const secrets = secretDoc.data();
        if (!secrets?.phonePeSaltKey || !secrets?.phonePeSaltIndex) {
            res.status(500).send('Secrets missing');
            return;
        }
        const { phonePeSaltKey, phonePeSaltIndex } = secrets;
        const receivedVerifyHeader = req.headers['x-verify'] || req.headers['X-VERIFY'];
        const stringToHash = b64Response + phonePeSaltKey;
        const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
        const calculatedChecksum = `${sha256}###${phonePeSaltIndex}`;
        if (receivedVerifyHeader !== calculatedChecksum) {
            console.error('Checksum mismatch', { receivedVerifyHeader, calculatedChecksum });
            res.status(400).send('Checksum verification failed');
            return;
        }
        if (payload.success && payload.code === 'PAYMENT_SUCCESS') {
            await txnDoc.ref.update({
                status: 'SUCCESS',
                updatedAt: FieldValue.serverTimestamp(),
                providerReferenceId: payload.data?.transactionId || null,
                amountReceived: payload.data?.amount ? payload.data.amount / 100 : txnData.amount
            });
        }
        else {
            await txnDoc.ref.update({
                status: 'FAILED',
                error: payload.code || 'PAYMENT_ERROR',
                updatedAt: FieldValue.serverTimestamp(),
            });
        }
        res.status(200).send({ success: true });
    }
    catch (err) {
        console.error('Webhook error', err);
        res.status(500).send('Internal error');
    }
});
//# sourceMappingURL=payments.js.map