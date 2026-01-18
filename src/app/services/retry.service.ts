/**
 * Retry utility with exponential backoff for API calls
 * Handles transient failures from Twitter, RSS, YouTube APIs
 */

import { Injectable, inject } from '@angular/core';
import { LoggerService } from './logger.service';

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: (error: any) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: (error: any) => {
    // Retry on network errors, rate limits, and server errors
    if (error?.status) {
      return error.status === 429 || // Rate limit
             error.status >= 500;     // Server errors
    }
    // Retry on generic network errors
    return error?.name === 'TypeError' || 
           error?.message?.includes('network') ||
           error?.message?.includes('fetch');
  }
};

@Injectable({
  providedIn: 'root'
})
export class RetryService {
  private logger = inject(LoggerService);

  /**
   * Execute a function with retry logic
   */
  async withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {},
    context: string = 'API call'
  ): Promise<T> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let lastError: any;
    let delay = opts.initialDelayMs;

    for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;

        // Check if we should retry
        if (attempt > opts.maxRetries || !opts.retryableErrors(error)) {
          this.logger.warn('Retry', `${context}: Failed after ${attempt} attempt(s), not retrying`, error?.message);
          throw error;
        }

        // Log retry attempt
        this.logger.info('Retry', `${context}: Attempt ${attempt} failed, retrying in ${delay}ms...`);
        
        // Wait before retrying
        await this.sleep(delay);
        
        // Increase delay for next attempt (exponential backoff)
        delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Standalone retry function for use outside DI context
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
  context: string = 'Operation'
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      if (attempt > opts.maxRetries || !opts.retryableErrors(error)) {
        throw error;
      }

      console.warn(`[Retry] ${context}: Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError;
}
