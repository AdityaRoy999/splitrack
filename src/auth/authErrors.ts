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
      return 'Sign in using the method already linked to this email.';
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
