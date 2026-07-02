import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
const getDb = () => getFirestore();
const PHONEPE_PROD_URL = 'https://api.phonepe.com/apis/hermes';
const PHONEPE_UAT_URL = 'https://api-preprod.phonepe.com/apis/pg-sandbox';
export const checkPaymentStatus = onCall(async (request) => {
    const { transactionId } = request.data;
    if (!transactionId) {
        throw new HttpsError('invalid-argument', 'Missing transactionId');
    }
    const txnQuery = await getDb().collectionGroup('transactions').where('transactionId', '==', transactionId).get();
    if (txnQuery.empty) {
        throw new HttpsError('not-found', 'Transaction not found');
    }
    const txnDoc = txnQuery.docs[0];
    const txnData = txnDoc.data();
    // If it's already updated by webhook, just return the status
    if (txnData.status !== 'PENDING') {
        return { status: txnData.status, error: txnData.error };
    }
    const churchId = txnData.churchId;
    const secretDoc = await getDb().collection('churches').doc(churchId).collection('secrets').doc('payment').get();
    if (!secretDoc.exists) {
        throw new HttpsError('not-found', 'Payment is not configured for this church.');
    }
    const secrets = secretDoc.data();
    if (!secrets?.phonePeMerchantId || !secrets?.phonePeSaltKey || !secrets?.phonePeSaltIndex) {
        throw new HttpsError('not-found', 'Incomplete payment configuration.');
    }
    const { phonePeMerchantId, phonePeSaltKey, phonePeSaltIndex } = secrets;
    const isUAT = phonePeMerchantId.includes('UAT') || phonePeMerchantId.includes('TEST') || phonePeMerchantId === 'PGTESTPAYUAT';
    const baseUrl = isUAT ? PHONEPE_UAT_URL : PHONEPE_PROD_URL;
    const endpoint = `/pg/v1/status/${phonePeMerchantId}/${transactionId}`;
    const stringToHash = endpoint + phonePeSaltKey;
    const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
    const checksum = `${sha256}###${phonePeSaltIndex}`;
    try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-VERIFY': checksum,
                'X-MERCHANT-ID': phonePeMerchantId
            }
        });
        const result = await response.json();
        if (result.success && result.code === 'PAYMENT_SUCCESS') {
            await txnDoc.ref.update({
                status: 'SUCCESS',
                updatedAt: FieldValue.serverTimestamp(),
                providerReferenceId: result.data?.transactionId || null,
                amountReceived: result.data?.amount ? result.data.amount / 100 : txnData.amount
            });
            return { status: 'SUCCESS' };
        }
        else if (result.code === 'PAYMENT_PENDING') {
            return { status: 'PENDING' };
        }
        else {
            await txnDoc.ref.update({
                status: 'FAILED',
                error: result.code || 'PAYMENT_ERROR',
                updatedAt: FieldValue.serverTimestamp(),
            });
            return { status: 'FAILED', error: result.code || 'PAYMENT_ERROR' };
        }
    }
    catch (error) {
        console.error('Check Status Error', error);
        throw new HttpsError('internal', 'Failed to check status with PhonePe');
    }
});
//# sourceMappingURL=checkPaymentStatus.js.map