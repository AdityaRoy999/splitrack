export type GoogleIdentity<Credential> = { credential: Credential; email: string };
export type PendingGoogleLink = { email: string; status: 'password-required' | 'reauthentication-required' | 'link-error' };
export type GoogleLinkUser = { uid: string; email: string | null; providerData: { providerId: string }[] };

type Dependencies<Credential, User extends GoogleLinkUser> = {
  currentUser(): User | null;
  sessionVersion(): number;
  acquireCredential(): Promise<GoogleIdentity<Credential> | null>;
  linkCredential(user: User, credential: Credential): Promise<{ user: User }>;
  reauthenticate(user: User, email: string, password: string): Promise<unknown>;
  changed(pending: PendingGoogleLink | null): void;
  now?(): number;
};

export const normalizedEmail = (email: string | null | undefined) => (email || '').trim().toLowerCase();
export const hasGoogleProvider = (user: GoogleLinkUser | null | undefined) => Boolean(user?.providerData.some(provider => provider.providerId === 'google.com'));
export const authFlowError = (code: string, message: string, email?: string) => Object.assign(new Error(message), { code, ...(email ? { email } : {}) });

// OAuth credentials never enter AsyncStorage, the ledger cache, or error objects.
// A collision is held briefly in memory until the user explicitly proves the
// existing password account and asks to link it.
export class GoogleAccountLinker<Credential, User extends GoogleLinkUser> {
  private pending: (GoogleIdentity<Credential> & PendingGoogleLink & { expiresAt: number }) | null = null;
  private intentVersion = 0;
  private inFlight: Promise<boolean> | undefined;

  constructor(private readonly dependencies: Dependencies<Credential, User>) {}

  get pendingLink(): PendingGoogleLink | null {
    return this.pending && this.pending.expiresAt > this.now()
      ? { email: this.pending.email, status: this.pending.status } : null;
  }

  private now() { return this.dependencies.now?.() ?? Date.now(); }

  retain(identity: GoogleIdentity<Credential>, status: PendingGoogleLink['status'] = 'password-required') {
    const email = normalizedEmail(identity.email);
    if (!email) throw authFlowError('auth/google-email-unavailable', 'Google did not provide an email address. Choose your Google account again.');
    this.intentVersion++;
    this.pending = { ...identity, email, status, expiresAt: this.now() + 10 * 60 * 1000 };
    this.dependencies.changed(this.pendingLink);
  }

  cancel() {
    this.intentVersion++;
    this.pending = null;
    this.dependencies.changed(null);
  }

  link(password?: string): Promise<boolean> {
    if (!this.inFlight) this.inFlight = this.performLink(password).finally(() => { this.inFlight = undefined; });
    return this.inFlight;
  }

  private async performLink(password?: string): Promise<boolean> {
    const user = this.dependencies.currentUser();
    if (!user) throw authFlowError('auth/requires-login', 'Sign in to your existing account before syncing Google.');
    if (hasGoogleProvider(user)) { this.cancel(); return true; }
    if (!user.providerData.some(provider => provider.providerId === 'password')) {
      throw authFlowError('auth/google-link-not-eligible', 'Sign in using the password for your existing account before syncing Google.');
    }
    const email = normalizedEmail(user.email);
    if (!email) throw authFlowError('auth/google-email-unavailable', 'Your existing account needs an email address before syncing Google.');
    const session = this.dependencies.sessionVersion(), intent = this.intentVersion;
    const ensureSession = () => {
      if (session !== this.dependencies.sessionVersion() || intent !== this.intentVersion || this.dependencies.currentUser()?.uid !== user.uid) {
        throw authFlowError('auth/session-changed', 'Your signed-in account changed. Please start syncing Google again.');
      }
    };
    const pending = this.pending && this.pending.expiresAt > this.now() ? this.pending : null;
    const identity = pending || await this.dependencies.acquireCredential();
    ensureSession();
    if (!identity) return false;
    if (normalizedEmail(identity.email) !== email) {
      this.cancel();
      throw authFlowError('auth/google-email-mismatch', `Choose the Google account for ${user.email}. Your existing account has not changed.`, user.email || undefined);
    }
    try {
      if (password !== undefined) {
        if (!password) throw authFlowError('auth/requires-recent-login', 'Enter your existing account password to finish syncing Google.');
        await this.dependencies.reauthenticate(user, user.email!.trim(), password);
        ensureSession();
      }
      const result = await this.dependencies.linkCredential(user, identity.credential);
      ensureSession();
      if (result.user.uid !== user.uid) throw authFlowError('auth/session-changed', 'Google could not be linked to the current account.');
      this.pending = null;
      this.dependencies.changed(null);
      return true;
    } catch (error) {
      ensureSession();
      const code = (error as { code?: string } | null)?.code;
      if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
        this.pending = null;
        this.dependencies.changed(null);
      } else {
        // Retain the verified Google choice for a password retry or a transient
        // failure. The Firebase UID and all application records remain intact.
        this.pending = { ...identity, email, status: code === 'auth/requires-recent-login' ? 'reauthentication-required' : 'link-error', expiresAt: this.now() + 10 * 60 * 1000 };
        this.dependencies.changed(this.pendingLink);
      }
      throw error;
    }
  }
}
