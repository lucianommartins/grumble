import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { I18nService } from '../../i18n';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (dialog.isOpen()) {
    <div class="dialog-overlay" (click)="dialog.handleCancel()">
      <div class="dialog-content" (click)="$event.stopPropagation()">
        @if (dialog.options()?.title) {
        <h3 class="dialog-title">{{ dialog.options()?.title }}</h3>
        }
        <p class="dialog-message">{{ dialog.options()?.message }}</p>
        <div class="dialog-actions">
          <button class="btn btn-ghost" (click)="dialog.handleCancel()">
            {{ dialog.options()?.cancelText || i18n.t.common.cancel }}
          </button>
          <button class="btn" [class.btn-danger]="dialog.options()?.isDanger" 
                  [class.btn-primary]="!dialog.options()?.isDanger"
                  (click)="dialog.handleConfirm()">
            {{ dialog.options()?.confirmText || i18n.t.common.confirm }}
          </button>
        </div>
      </div>
    </div>
    }
  `,
  styles: [`
    .dialog-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      animation: fadeIn 0.15s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .dialog-content {
      background: var(--color-bg-primary);
      border: 1px solid var(--color-border);
      border-radius: 12px;
      padding: 24px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      animation: slideIn 0.2s ease-out;
    }

    @keyframes slideIn {
      from { 
        opacity: 0;
        transform: scale(0.95) translateY(-10px);
      }
      to { 
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    .dialog-title {
      margin: 0 0 8px;
      font-size: 1.2rem;
      color: var(--color-text-primary);
    }

    .dialog-message {
      margin: 0 0 24px;
      color: var(--color-text-secondary);
      font-size: 0.95rem;
      line-height: 1.5;
    }

    .dialog-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .btn {
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      border: none;
      font-size: 0.9rem;
    }

    .btn-ghost {
      background: transparent;
      color: var(--color-text-secondary);
      border: 1px solid var(--color-border);
    }

    .btn-ghost:hover {
      background: var(--color-bg-secondary);
      color: var(--color-text-primary);
    }

    .btn-primary {
      background: var(--color-accent);
      color: white;
    }

    .btn-primary:hover {
      filter: brightness(1.1);
    }

    .btn-danger {
      background: #ef4444;
      color: white;
    }

    .btn-danger:hover {
      background: #dc2626;
    }
  `]
})
export class ConfirmDialogComponent {
  dialog = inject(ConfirmDialogService);
  i18n = inject(I18nService);
}
