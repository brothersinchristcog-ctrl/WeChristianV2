import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';
import { Platform } from 'react-native';

const MERCHANT_ID = 'PGTESTPAYUAT86';
const SALT_KEY = '96434309-7796-489d-8924-ab56988a6076';
const SALT_INDEX = '1';
const PHONEPE_HOST = 'https://api-preprod.phonepe.com/apis/pg-sandbox';

export class PhonePeService {
  /**
   * Initiates a payment with PhonePe and opens the secure checkout page
   * @param amount Amount in INR
   * @param userId The ID of the user making the payment
   * @param mobileNumber Optional mobile number
   * @returns An object containing success status and transactionId
   */
  static async startPaymentFlow(amount: number, userId: string, mobileNumber?: string): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      const transactionId = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
      
      // 1. Construct payload
      const payload = {
        merchantId: MERCHANT_ID,
        merchantTransactionId: transactionId,
        merchantUserId: userId,
        amount: amount * 100, // Amount in paise
        redirectUrl: `https://phonepe.com`, // Dummy callback for UAT
        redirectMode: 'REDIRECT',
        callbackUrl: `https://phonepe.com`,
        mobileNumber: mobileNumber || '',
        paymentInstrument: {
          type: 'PAY_PAGE'
        }
      };

      const payloadString = JSON.stringify(payload);
      const base64EncodedPayload = Buffer.from(payloadString).toString('base64');
      
      // 2. Checksum = sha256(base64Payload + apiEndPoint + saltKey) + ### + saltIndex
      const stringToHash = base64EncodedPayload + '/pg/v1/pay' + SALT_KEY;
      
      // Calculate SHA256 using expo-crypto
      const sha256 = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        stringToHash
      );
      
      const checksum = `${sha256}###${SALT_INDEX}`;

      // 3. Call PhonePe UAT API directly from the client (FOR TESTING ONLY)
      const response = await fetch(`${PHONEPE_HOST}/pg/v1/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': checksum,
          'X-MERCHANT-ID': MERCHANT_ID
        },
        body: JSON.stringify({
          request: base64EncodedPayload
        })
      });

      const responseData = await response.json();
      
      if (!responseData.success) {
        throw new Error(responseData.message || 'Failed to get payment redirect URL');
      }

      const redirectUrl = responseData.data.instrumentResponse.redirectInfo.url;

      // 4. Open the URL in an in-app browser
      if (Platform.OS !== 'web') {
        const result = await WebBrowser.openBrowserAsync(redirectUrl);
        if (result.type === 'cancel' || result.type === 'dismiss') {
           console.log('User closed payment browser');
        }
      } else {
        window.open(redirectUrl, '_blank');
      }

      return { success: true, transactionId };
    } catch (error: any) {
      console.error('PhonePeService startPaymentFlow error:', error);
      return { success: false, error: error.message || 'Payment initiation failed' };
    }
  }
}
