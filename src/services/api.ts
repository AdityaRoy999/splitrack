import { randomUUID } from 'expo-crypto';
import { getFirebaseAuth } from './firebase';

const baseUrl = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
export class ApiError extends Error {
  constructor(message: string, public status = 0, public code = 'NETWORK_ERROR') { super(message); }
}
export const requestId = () => randomUUID();
type RequestOptions = { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown; id?: string; signal?: AbortSignal };

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!baseUrl.startsWith('https://')) throw new ApiError('This build is missing its API address.', 503, 'CONFIGURATION');
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new ApiError('Please sign in to continue.', 401, 'UNAUTHENTICATED');
  const method = options.method ?? 'GET';
  const id = method === 'GET' ? undefined : options.id ?? requestId();
  // Keep the same ID across timeouts and retries so a response lost after a
  // successful write can never create a second expense or payment.
  let refresh = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    options.signal?.addEventListener('abort', abort);
    if (options.signal?.aborted) controller.abort();
    const timeout = setTimeout(abort, 15000);
    try {
      const token = await user.getIdToken(refresh);
      if (getFirebaseAuth().currentUser?.uid !== user.uid) throw new ApiError('Your session changed. Please try again.', 401);
      const response = await fetch(`${baseUrl}${path}`, {
        method, signal: controller.signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...(id ? { 'idempotency-key': id } : {}) },
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      });
      const body = await response.json().catch(() => ({}));
      if (getFirebaseAuth().currentUser?.uid !== user.uid) throw new ApiError('Your session changed. Please try again.', 401);
      if (response.status === 401 && !refresh && attempt < 2) { refresh = true; continue; }
      if (!response.ok) throw new ApiError(body.message ?? 'The request could not be completed.', response.status, body.code);
      return body as T;
    } catch (error) {
      if (options.signal?.aborted) throw error;
      if (error instanceof ApiError && !(error.status >= 500 || error.code === 'WRITE_CONFLICT')) throw error;
      if (attempt === 2) throw error instanceof ApiError ? error : new ApiError('Could not reach SplitTrack. Check your connection and try again.');
      await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abort);
    }
  }
  throw new ApiError('Please try again.');
}

export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
