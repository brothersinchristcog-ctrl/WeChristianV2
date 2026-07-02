/**
 * Initiate Payment (Called from React Native App)
 */
export declare const initiatePhonePePayment: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    redirectUrl: any;
    transactionId: string;
}>, unknown>;
/**
 * Webhook to receive server-to-server status updates from PhonePe
 */
export declare const phonepeWebhook: import("firebase-functions/v2/https").HttpsFunction;
//# sourceMappingURL=phonepe.d.ts.map