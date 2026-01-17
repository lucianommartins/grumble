import { Directive, ElementRef, Input, OnInit, OnDestroy, inject } from '@angular/core';

/**
 * LazyImageDirective uses IntersectionObserver to lazy-load images
 * only when they become visible in the viewport.
 * 
 * Usage: <img appLazyImage [src]="imageUrl" alt="..." />
 */
@Directive({
  selector: '[appLazyImage]',
  standalone: true
})
export class LazyImageDirective implements OnInit, OnDestroy {
  private el = inject(ElementRef);
  private observer: IntersectionObserver | null = null;
  
  @Input() set src(value: string) {
    this._src = value;
    // If already observed and visible, load immediately
    if (this.isVisible && value) {
      this.loadImage();
    }
  }
  
  private _src = '';
  private isVisible = false;
  private loaded = false;

  ngOnInit(): void {
    const element = this.el.nativeElement as HTMLImageElement;
    
    // Add placeholder styles
    element.style.backgroundColor = 'var(--color-bg-secondary, #1a1a2e)';
    element.style.transition = 'opacity 0.3s ease-out';
    element.style.opacity = '0';
    
    // Set up IntersectionObserver
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting && !this.loaded) {
              this.isVisible = true;
              this.loadImage();
            }
          });
        },
        {
          rootMargin: '50px 0px', // Start loading 50px before visible
          threshold: 0.01
        }
      );
      
      this.observer.observe(element);
    } else {
      // Fallback for browsers without IntersectionObserver
      this.loadImage();
    }
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  private loadImage(): void {
    if (this.loaded || !this._src) return;
    
    const element = this.el.nativeElement as HTMLImageElement;
    
    // Create a new image to preload
    const img = new Image();
    
    img.onload = () => {
      element.src = this._src;
      element.style.opacity = '1';
      this.loaded = true;
      
      // Disconnect observer after loading
      if (this.observer) {
        this.observer.disconnect();
      }
    };
    
    img.onerror = () => {
      // On error, still try to set src (show broken image icon)
      element.src = this._src;
      element.style.opacity = '0.5';
      this.loaded = true;
    };
    
    img.src = this._src;
  }
}
