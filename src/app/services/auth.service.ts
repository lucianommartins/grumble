import { Injectable, inject, signal } from '@angular/core';
import { Auth, signInWithPopup, signOut, GoogleAuthProvider, User, onAuthStateChanged } from '@angular/fire/auth';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private googleProvider = new GoogleAuthProvider();

  currentUser = signal<AppUser | null>(null);
  isAuthenticated = signal(false);
  isLoading = signal(true);
  authError = signal<string | null>(null);

  constructor() {
    // Listen for auth state changes
    onAuthStateChanged(this.auth, (user) => {
      this.isLoading.set(false);
      if (user) {
        this.currentUser.set(this.mapUser(user));
        this.isAuthenticated.set(true);
      } else {
        this.currentUser.set(null);
        this.isAuthenticated.set(false);
      }
    });
  }

  private mapUser(user: User): AppUser {
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL
    };
  }

  private readonly ALLOWED_DOMAIN = 'google.com';
  private readonly ALLOWED_EMAILS = ['tabatha.sk@gmail.com', 'lucianomelomartins@gmail.com'];

  async signInWithGoogle(): Promise<AppUser | null> {
    this.authError.set(null);
    try {
      const result = await signInWithPopup(this.auth, this.googleProvider);
      const user = result.user;

      // Validate email domain OR specific allowed emails
      const isAllowedDomain = user.email?.endsWith(`@${this.ALLOWED_DOMAIN}`);
      const isAllowedEmail = this.ALLOWED_EMAILS.includes(user.email || '');

      if (!isAllowedDomain && !isAllowedEmail) {
        const errorMsg = `Acesso restrito a emails @${this.ALLOWED_DOMAIN}`;
        this.authError.set(errorMsg);
        await signOut(this.auth);
        throw new Error(errorMsg);
      }

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

