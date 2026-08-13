import { Platform } from 'react-native';
import PhonePePaymentSDK from 'react-native-phonepe-pg';
import { logger } from '@/services/logger';

const ENV = process.env.EXPO_PUBLIC_PHONEPE_ENV ?? 'sandbox';
export const PHONEPE_ENV = ENV === 'production' ? 'PRODUCTION' : 'SANDBOX';

export const PHONEPE_MERCHANT_ID =
  process.env.EXPO_PUBLIC_PHONEPE_MERCHANT_ID ?? '';

export type TransactionStatus = 'SUCCESS' | 'FAILURE' | 'INTERRUPTED';

export interface TransactionResult {
  status: TransactionStatus;
  error?: string;
}

let initialized = false;

/**
 * Initialise the PhonePe intent SDK once per app run.
 * Android-only for now (iOS shows a coming-soon state in the UI).
 */
export async function initPhonePe(flowId: string): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (!PHONEPE_MERCHANT_ID) {
    logger.warn('phonepe-pg', 'EXPO_PUBLIC_PHONEPE_MERCHANT_ID is not set');
    return false;
  }
  if (initialized) return true;

  try {
    await PhonePePaymentSDK.init(PHONEPE_ENV, PHONEPE_MERCHANT_ID, flowId, ENV !== 'production');
    initialized = true;
    return true;
  } catch (e) {
    logger.warn('phonepe-pg', 'init failed', { message: e instanceof Error ? e.message : 'unknown' });
    return false;
  }
}

/**
 * Launch the UPI mandate setup for a subscription.
 * The `paymentMode` for autopay is the string "SUBSCRIPTION".
 */
export async function startSubscriptionTransaction(
  orderId: string,
  token: string,
  flowId: string,
): Promise<TransactionResult> {
  if (Platform.OS !== 'android') {
    return { status: 'FAILURE', error: 'UPI AutoPay is only available on Android.' };
  }

  const ok = await initPhonePe(flowId);
  if (!ok) {
    return { status: 'FAILURE', error: 'Unable to initialise the PhonePe SDK. Please try again.' };
  }

  const requestBody = JSON.stringify({
    orderId,
    merchantId: PHONEPE_MERCHANT_ID,
    token,
    paymentMode: 'SUBSCRIPTION',
  });

  try {
    const result = await PhonePePaymentSDK.startTransaction(requestBody, null);
    const status = String(result?.status ?? 'FAILURE') as TransactionStatus;
    const error = result?.error ? String(result.error) : undefined;
    logger.info('phonepe-pg', 'transaction completed', { status });
    return { status, error };
  } catch (e) {
    logger.warn('phonepe-pg', 'startTransaction threw', {
      message: e instanceof Error ? e.message : 'unknown',
    });
    return { status: 'FAILURE', error: 'The PhonePe transaction could not be started.' };
  }
}
