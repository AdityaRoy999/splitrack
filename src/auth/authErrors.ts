import { errorMessage } from '../services/api';

export function authenticationError(failure: unknown) {
  switch ((failure as { code?: string } | null)?.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'The email or password is incorrect.';
    case 'auth/email-already-in-use':
      return 'This email already has an account. Sign in instead.';
    case 'auth/account-exists-with-different-credential':
      return 'This email already has an account. Sign in with its password to sync Google with the same account.';
    case 'auth/credential-already-in-use':
      return 'This Google account is already linked to another account. Choose the Google account for your existing email.';
    case 'auth/requires-recent-login':
      return 'Enter your existing account password to finish syncing Google.';
    case 'auth/provider-already-linked':
      return 'Google is already synced with this account.';
    case 'auth/google-email-mismatch':
    case 'auth/google-email-unavailable':
    case 'auth/google-link-not-eligible':
    case 'auth/google-link-expired':
    case 'auth/requires-login':
    case 'auth/session-changed':
      return errorMessage(failure);
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Check your internet connection and try again.';
    case 'auth/popup-blocked':
      return 'Allow the sign-in popup and tap Continue with Google again.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not available yet. Please use email and password.';
    default:
      return errorMessage(failure);
  }
}
