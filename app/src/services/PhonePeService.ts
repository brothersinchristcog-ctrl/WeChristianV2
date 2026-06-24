import functions from '@react-native-firebase/functions';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

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
      const initiatePayment = functions().httpsCallable('initiatePhonePePayment');
      
      // 1. Call backend to get the payment URL
      const response = await initiatePayment({ amount, userId, mobileNumber });
      const data = response.data as { success: boolean; redirectUrl: string; transactionId: string };
      
      if (!data.success || !data.redirectUrl) {
        throw new Error('Failed to get payment redirect URL');
      }

      // 2. Open the URL in an in-app browser
      if (Platform.OS !== 'web') {
        const result = await WebBrowser.openBrowserAsync(data.redirectUrl);
        
        // When the user closes the browser, we assume they completed the flow
        // The backend webhook will handle actual status verification
        if (result.type === 'cancel' || result.type === 'dismiss') {
           // User closed the browser early
           console.log('User closed payment browser');
        }
      } else {
        // Fallback for web
        window.open(data.redirectUrl, '_blank');
      }

      return { success: true, transactionId: data.transactionId };
    } catch (error: any) {
      console.error('PhonePeService startPaymentFlow error:', error);
      return { success: false, error: error.message || 'Payment initiation failed' };
    }
  }
}
