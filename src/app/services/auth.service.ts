import { Injectable, inject, signal, computed } from '@angular/core';
import { Auth, signInWithPopup, signOut, GoogleAuthProvider, User, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

export type UserRole = 'admin' | 'reporter';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
}

interface RolesConfig {
  admins: string[];
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private googleProvider = new GoogleAuthProvider();

  currentUser = signal<AppUser | null>(null);
  isAuthenticated = signal(false);
  isLoading = signal(true);
  authError = signal<string | null>(null);

  // Admin emails loaded from Firestore
  private adminEmails = signal<string[]>([]);

  // Computed role getters for convenience
  userRole = computed<UserRole | null>(() => this.currentUser()?.role ?? null);
  isAdmin = computed(() => this.userRole() === 'admin');
  isReporter = computed(() => this.userRole() === 'reporter');

  constructor() {
    // Listen for auth state changes
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        // Load admin list from Firestore before determining role
        await this.loadAdminEmails();
        this.currentUser.set(this.mapUser(user));
        this.isAuthenticated.set(true);
      } else {
        this.currentUser.set(null);
        this.isAuthenticated.set(false);
      }
      this.isLoading.set(false);
    });
  }

  /**
   * Load admin emails from Firestore config/roles document
   * Structure: config/roles { admins: ["email1@google.com", "email2@google.com"] }
   */
  private async loadAdminEmails(): Promise<void> {
    try {
      const rolesDoc = doc(this.firestore, 'config', 'roles');
      const snapshot = await getDoc(rolesDoc);

      if (snapshot.exists()) {
        const data = snapshot.data() as RolesConfig;
        this.adminEmails.set(data.admins?.map(e => e.toLowerCase()) || []);
        console.log('[AuthService] Loaded admin emails from Firestore:', this.adminEmails().length);
      } else {
        console.warn('[AuthService] config/roles document not found, all users will be reporters');
        this.adminEmails.set([]);
      }
    } catch (error) {
      console.error('[AuthService] Failed to load admin emails:', error);
      this.adminEmails.set([]);
    }
  }

  private determineRole(email: string | null): UserRole {
    if (!email) return 'reporter';
    const emailLower = email.toLowerCase();
    const isAdmin = this.adminEmails().includes(emailLower);
    console.log('[AuthService] Determining role:', {
      email: emailLower,
      adminEmails: this.adminEmails(),
      isAdmin
    });
    return isAdmin ? 'admin' : 'reporter';
  }

  private mapUser(user: User): AppUser {
    const role = this.determineRole(user.email);
    console.log('[AuthService] Mapped user:', user.email, '→', role);
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      role
    };
  }

  private readonly ALLOWED_DOMAIN = 'google.com';

  async signInWithGoogle(): Promise<AppUser | null> {
    this.authError.set(null);
    try {
      const result = await signInWithPopup(this.auth, this.googleProvider);
      const user = result.user;

      // Validate email domain - @google.com only
      const isAllowedDomain = user.email?.endsWith(`@${this.ALLOWED_DOMAIN}`);

      if (!isAllowedDomain) {
        const errorMsg = `Access restricted to @${this.ALLOWED_DOMAIN} emails`;
        this.authError.set(errorMsg);
        await signOut(this.auth);
        throw new Error(errorMsg);
      }

      // Load admin list and map user
      await this.loadAdminEmails();
      return this.mapUser(user);
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      // Don't override domain error with generic error
      if (!this.authError()) {
        this.authError.set(error.message || 'Erro ao fazer login');
      }
      throw error;
    }
  }

  async signOut(): Promise<void> {
    try {
      await signOut(this.auth);
      this.authError.set(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }
}
