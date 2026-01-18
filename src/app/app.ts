import { Component, HostListener, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { FeedDashboardComponent } from './components/feed-dashboard/feed-dashboard.component';
import { ThreadPanelComponent } from './components/thread-panel/thread-panel.component';
import { LoginComponent } from './components/login/login.component';
import { SettingsComponent } from './components/settings/settings.component';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { AuthService } from './services/auth.service';
import { SyncService } from './services/sync.service';
import { I18nService } from './i18n';
import { StatsService } from './services/stats.service';
import { CommonModule } from '@angular/common';

const LAYOUT_STORAGE_KEY = 'devpulse_layout';
const MOBILE_BREAKPOINT = 768;

interface LayoutSettings {
  sidebarWidth: number;
  threadPanelWidth: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, SidebarComponent, FeedDashboardComponent, ThreadPanelComponent, LoginComponent, SettingsComponent, ConfirmDialogComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  title = 'DevPulse';
  authService = inject(AuthService);
  syncService = inject(SyncService);
  i18n = inject(I18nService);
  stats = inject(StatsService);
  showSettings = signal(false);

  // Mobile tab navigation
  isMobile = signal(typeof window !== 'undefined' ? window.innerWidth <= MOBILE_BREAKPOINT : false);
  activeTab = signal<'sources' | 'feed' | 'content'>('feed');

  // Show content tab when there's generated content
  hasGeneratedContent = computed(() => this.syncService.selectedCount() > 0);

  sidebarWidth = signal(this.loadLayout().sidebarWidth);
  threadPanelWidth = signal(this.loadLayout().threadPanelWidth);

  private resizing: 'left' | 'right' | null = null;
  private startX = 0;
  private startWidth = 0;
  private resizeHandler = () => this.checkMobile();

  private loadLayout(): LayoutSettings {
    try {
      const stored = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          sidebarWidth: parsed.sidebarWidth || 280,
          threadPanelWidth: parsed.threadPanelWidth || 400
        };
      }
    } catch { }
    return { sidebarWidth: 280, threadPanelWidth: 400 };
  }

  private saveLayout(): void {
    const layout: LayoutSettings = {
      sidebarWidth: this.sidebarWidth(),
      threadPanelWidth: this.threadPanelWidth()
    };
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  }

  startResize(event: MouseEvent, handle: 'left' | 'right'): void {
    event.preventDefault();
    this.resizing = handle;
    this.startX = event.clientX;

    if (handle === 'left') {
      this.startWidth = this.sidebarWidth();
    } else {
      this.startWidth = this.threadPanelWidth();
    }

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.resizing) return;

    const diff = event.clientX - this.startX;

    if (this.resizing === 'left') {
      const newWidth = Math.max(200, Math.min(500, this.startWidth + diff));
      this.sidebarWidth.set(newWidth);
    } else {
      // For right panel, moving right makes it smaller
      const newWidth = Math.max(300, Math.min(600, this.startWidth - diff));
      this.threadPanelWidth.set(newWidth);
    }
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    if (this.resizing) {
      this.resizing = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // Persist layout changes
      this.saveLayout();
    }
  }

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.resizeHandler);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.resizeHandler);
    }
  }

  private checkMobile(): void {
    this.isMobile.set(window.innerWidth <= MOBILE_BREAKPOINT);
  }
}

