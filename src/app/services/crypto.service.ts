import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

/**
 * CryptoService provides client-side encryption for sensitive data
 * using AES-256-GCM with a key derived from the user's UID + app secret.
 * 
 * This ensures data is encrypted at rest in Firestore and never
 * transmitted in plain text.
 */
@Injectable({
  providedIn: 'root'
})
export class CryptoService {
  private authService = inject(AuthService);

  // App-specific secret from environment, combined with user UID for key derivation
  private readonly APP_SECRET = environment.appSecret;

  /**
   * Encrypt a string value
   * @returns base64 encoded encrypted data with IV prepended
   */
  async encrypt(plainText: string): Promise<string> {
    const user = this.authService.currentUser();
    if (!user) throw new Error('User not authenticated');

    const key = await this.deriveKey(user.uid);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(plainText)
    );

    // Combine IV + ciphertext and encode as base64
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  /**
   * Decrypt a previously encrypted string
   * @param encryptedData base64 encoded data with IV prepended
   */
  async decrypt(encryptedData: string): Promise<string> {
    const user = this.authService.currentUser();
    if (!user) throw new Error('User not authenticated');

    const key = await this.deriveKey(user.uid);

    // Decode base64 and extract IV + ciphertext
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  }

  /**
   * Derive an AES-256 key from user UID + app secret using PBKDF2
   */
  private async deriveKey(userId: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.APP_SECRET + userId),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // Use user ID as salt for additional uniqueness
    const salt = encoder.encode(`grumble-salt-${userId}`);

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Check if a value looks like encrypted data (base64 with minimum length)
   */
  isEncrypted(value: string): boolean {
    if (!value || value.length < 20) return false;
    try {
      const decoded = atob(value);
      return decoded.length > 12; // IV (12 bytes) + at least some ciphertext
    } catch {
      return false;
    }
  }
}
