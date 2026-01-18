import { Injectable, inject, signal, effect } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, increment, onSnapshot, Unsubscribe } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { LoggerService } from './logger.service';

const STATS_DOC = 'stats/global';

@Injectable({
  providedIn: 'root'
})
export class StatsService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private logger = inject(LoggerService);

  // Global content counter (real-time)
  contentCreated = signal<number>(0);
  
  private unsubscribe: Unsubscribe | null = null;

  constructor() {
    // Subscribe to real-time updates when user logs in
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        this.subscribeToStats();
      } else {
        this.unsubscribeFromStats();
      }
    });
  }

  /**
   * Subscribe to real-time stats updates
   */
  private subscribeToStats(): void {
    if (this.unsubscribe) return;

    const statsRef = doc(this.firestore, STATS_DOC);
    this.unsubscribe = onSnapshot(statsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        this.contentCreated.set(data['contentCreated'] ?? 0);
      } else {
        this.contentCreated.set(0);
      }
    }, (error) => {
      this.logger.warn('StatsService', 'Failed to subscribe to stats:', error);
    });
  }

  private unsubscribeFromStats(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /**
   * Increment the global content counter
   * Called when content is generated
   */
  async incrementContentCreated(): Promise<void> {
    try {
      const statsRef = doc(this.firestore, STATS_DOC);
      await setDoc(statsRef, {
        contentCreated: increment(1)
      }, { merge: true });
      this.logger.debug('StatsService', 'Content counter incremented');
    } catch (error) {
      this.logger.warn('StatsService', 'Failed to increment counter:', error);
    }
  }
}
