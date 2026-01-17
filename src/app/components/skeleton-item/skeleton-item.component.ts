import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * SkeletonItemComponent displays a loading placeholder for feed items
 * with a shimmer animation effect.
 */
@Component({
  selector: 'app-skeleton-item',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="skeleton-item" [class.compact]="compact">
      <div class="skeleton-header">
        <div class="skeleton-avatar"></div>
        <div class="skeleton-meta">
          <div class="skeleton-line skeleton-name"></div>
          <div class="skeleton-line skeleton-date"></div>
        </div>
      </div>
      <div class="skeleton-content">
        <div class="skeleton-line skeleton-text long"></div>
        <div class="skeleton-line skeleton-text medium"></div>
        <div class="skeleton-line skeleton-text short"></div>
      </div>
      @if (!compact) {
      <div class="skeleton-actions">
        <div class="skeleton-button"></div>
        <div class="skeleton-button"></div>
      </div>
      }
    </div>
  `,
  styles: [`
    .skeleton-item {
      background: var(--color-bg-card);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: var(--spacing-md);
      margin-bottom: var(--spacing-sm);
    }

    .skeleton-item.compact {
      padding: var(--spacing-sm);
    }

    .skeleton-header {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      margin-bottom: var(--spacing-md);
    }

    .skeleton-avatar {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-full);
      background: var(--color-bg-secondary);
      animation: shimmer 1.5s infinite;
    }

    .skeleton-meta {
      flex: 1;
    }

    .skeleton-line {
      height: 12px;
      border-radius: var(--radius-sm);
      background: var(--color-bg-secondary);
      animation: shimmer 1.5s infinite;
    }

    .skeleton-name {
      width: 120px;
      margin-bottom: 6px;
    }

    .skeleton-date {
      width: 80px;
      height: 10px;
    }

    .skeleton-content {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .skeleton-text {
      height: 14px;
    }

    .skeleton-text.long {
      width: 100%;
    }

    .skeleton-text.medium {
      width: 80%;
    }

    .skeleton-text.short {
      width: 60%;
    }

    .skeleton-actions {
      display: flex;
      gap: var(--spacing-sm);
      margin-top: var(--spacing-md);
    }

    .skeleton-button {
      width: 80px;
      height: 32px;
      border-radius: var(--radius-md);
      background: var(--color-bg-secondary);
      animation: shimmer 1.5s infinite;
    }

    @keyframes shimmer {
      0% {
        opacity: 0.6;
      }
      50% {
        opacity: 1;
      }
      100% {
        opacity: 0.6;
      }
    }
  `]
})
export class SkeletonItemComponent {
  @Input() compact = false;
}
