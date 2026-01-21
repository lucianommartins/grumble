import { Component, inject, signal, computed, HostListener, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { FeedbackDashboardComponent } from './components/feedback-dashboard/feedback-dashboard.component';
import { LoginComponent } from './components/login/login.component';
import { SettingsComponent } from './components/settings/settings.component';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { AuthService } from './services/auth.service';
import { FeedbackService } from './services/feedback.service';
import { ThemeService } from './services/theme.service';
import { I18nService } from './i18n';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, SidebarComponent, FeedbackDashboardComponent, LoginComponent, SettingsComponent, ConfirmDialogComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  title = 'Grumble';
  authService = inject(AuthService);
  feedbackService = inject(FeedbackService);
  themeService = inject(ThemeService);
  i18n = inject(I18nService);
  showSettings = signal(false);

  // Resizable sidebar
  sidebarWidth = signal(448);
  private isResizing = false;
  private readonly minWidth = 200;
  private readonly maxWidth = 600;
  private readonly defaultWidth = 448;
  private hasLoadedCache = false;

  constructor() {
    // Auto-load cached feedback when user authenticates
    effect(() => {
      const isAuth = this.authService.isAuthenticated();
      const isLoading = this.authService.isLoading();
      console.log('[App] Effect triggered:', { isAuth, isLoading, hasLoadedCache: this.hasLoadedCache });

      if (isAuth && !isLoading && !this.hasLoadedCache) {
        this.hasLoadedCache = true;
        console.log('[App] Loading cached feedback...');
        this.feedbackService.loadCachedFeedback();
      }
    });
  }

  startResize(event: MouseEvent): void {
    this.isResizing = true;
    event.preventDefault();
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.isResizing) return;
    const newWidth = Math.min(this.maxWidth, Math.max(this.minWidth, event.clientX));
    this.sidebarWidth.set(newWidth);
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    this.isResizing = false;
  }

  resetSidebarWidth(): void {
    this.sidebarWidth.set(this.defaultWidth);
  }
}
