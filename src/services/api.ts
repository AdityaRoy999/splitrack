import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { getFirebaseAuth } from './firebase';

const baseUrl = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
export class ApiError extends Error {
  constructor(message: string, public status = 0, public code = 'NETWORK_ERROR', public details?: { existingTransaction?: unknown }) { super(message); }
}
export const requestId = () => randomUUID();
type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown; id?: string; signal?: AbortSignal;
  rawBody?: string; expectedUid?: string; attempts?: number; timeoutMs?: number;
};

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!baseUrl.startsWith('https://')) throw new ApiError('This build is missing its API address.', 503, 'CONFIGURATION');
  const user = getFirebaseAuth().currentUser;
  if (!user || (options.expectedUid && options.expectedUid !== user.uid)) throw new ApiError('Please sign in to continue.', 401, 'UNAUTHENTICATED');
  const method = options.method ?? 'GET', id = method === 'GET' ? undefined : options.id ?? requestId();
  const encoded = options.rawBody ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined);
  let refresh = false;
  const attempts = Math.max(1, Math.min(3, options.attempts ?? 3));
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController(), abort = () => controller.abort();
    options.signal?.addEventListener('abort', abort);
    if (options.signal?.aborted) controller.abort();
    const timeout = setTimeout(abort, options.timeoutMs ?? 10000);
    let refreshTimeout: ReturnType<typeof setTimeout> | undefined;
    let cancelTokenWait = () => {};
    try {
      // The timeout also bounds token refresh while offline, before fetch begins.
      const interrupted = new Promise<never>((_, reject) => {
        const onAbort = () => reject(new ApiError('Could not reach SplitTrack. Your saved offline transactions will sync when connected.'));
        controller.signal.addEventListener('abort', onAbort, { once: true });
        cancelTokenWait = () => controller.signal.removeEventListener('abort', onAbort);
        if (controller.signal.aborted) onAbort();
      });
      const token = await Promise.race([user.getIdToken(refresh), interrupted]);
      cancelTokenWait();
      if (getFirebaseAuth().currentUser?.uid !== user.uid) throw new ApiError('Your session changed. Please sign in again.', 401, 'UNAUTHENTICATED');
      const response = await fetch(`${baseUrl}${path}`, {
        method, signal: controller.signal,
        headers: { 'X-App-Version': `${Platform.OS}/${Application.nativeBuildVersion ?? 0}/${Application.nativeApplicationVersion ?? '0.0.0'}`, 'content-type': 'application/json', authorization: `Bearer ${token}`, ...(id ? { 'idempotency-key': id } : {}) },
        ...(encoded !== undefined ? { body: encoded } : {}),
      });
      const body = await response.json().catch(() => ({}));
      if (getFirebaseAuth().currentUser?.uid !== user.uid) throw new ApiError('Your session changed. Please sign in again.', 401, 'UNAUTHENTICATED');
      if (response.status === 401 && !refresh) {
        refresh = true;
        if (attempt < attempts - 1) continue;
        // The next durable outbox retry must refresh a rejected cached token.
        await Promise.race([user.getIdToken(true), new Promise((_, reject) => { refreshTimeout = setTimeout(() => reject(new ApiError('Reconnect to renew your sign-in session.')), 5000); })]);
      }
      if (!response.ok) throw new ApiError(body.message ?? 'The request could not be completed.', response.status, body.code, body.details);
      return body as T;
    } catch (error) {
      if (options.signal?.aborted) throw error;
      if (error instanceof ApiError && !(error.status >= 500 || error.code === 'WRITE_CONFLICT')) throw error;
      if (attempt === attempts - 1) throw error instanceof ApiError ? error : new ApiError('Could not reach SplitTrack. Your saved offline transactions will sync when connected.');
      await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
    } finally {
      cancelTokenWait(); clearTimeout(timeout); clearTimeout(refreshTimeout); options.signal?.removeEventListener('abort', abort);
    }
  }
  throw new ApiError('Please try again.');
}
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
