import { Injectable, signal } from '@angular/core';

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmDialogService {
  isOpen = signal(false);
  options = signal<ConfirmDialogOptions | null>(null);
  private resolvePromise: ((value: boolean) => void) | null = null;

  confirm(options: ConfirmDialogOptions): Promise<boolean> {
    this.options.set(options);
    this.isOpen.set(true);

    return new Promise<boolean>((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  handleConfirm(): void {
    this.isOpen.set(false);
    this.resolvePromise?.(true);
    this.resolvePromise = null;
  }

  handleCancel(): void {
    this.isOpen.set(false);
    this.resolvePromise?.(false);
    this.resolvePromise = null;
  }
}
