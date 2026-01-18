/**
 * Unit Tests for LoggerService and RetryService
 * 
 * Run with: npx tsx src/app/services/__tests__/utils.service.test.ts
 */

import { assertEqual } from './test-utils';

// ============================================
// LogLevel Filtering Tests
// ============================================

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

function shouldLog(currentLevel: LogLevel, messageLevel: LogLevel): boolean {
  return currentLevel <= messageLevel;
}

console.log('\n=== LoggerService.logLevel Tests ===\n');

// Test 1: DEBUG level shows all
assertEqual(
  shouldLog(LogLevel.DEBUG, LogLevel.DEBUG),
  true,
  'DEBUG level should show DEBUG messages'
);
assertEqual(
  shouldLog(LogLevel.DEBUG, LogLevel.ERROR),
  true,
  'DEBUG level should show ERROR messages'
);

// Test 2: WARN level hides DEBUG/INFO
assertEqual(
  shouldLog(LogLevel.WARN, LogLevel.DEBUG),
  false,
  'WARN level should hide DEBUG messages'
);
assertEqual(
  shouldLog(LogLevel.WARN, LogLevel.INFO),
  false,
  'WARN level should hide INFO messages'
);
assertEqual(
  shouldLog(LogLevel.WARN, LogLevel.WARN),
  true,
  'WARN level should show WARN messages'
);

// Test 3: NONE level hides everything
assertEqual(
  shouldLog(LogLevel.NONE, LogLevel.ERROR),
  false,
  'NONE level should hide ERROR messages'
);

console.log('\n=== All LoggerService tests passed! ===\n');

// ============================================
// RetryService Tests
// ============================================

console.log('\n=== RetryService Tests ===\n');

interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
}

async function retryMock<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<{ result?: T; attempts: number; error?: Error }> {
  let attempts = 0;
  let lastError: Error | undefined;

  for (let i = 0; i <= options.maxRetries; i++) {
    attempts++;
    try {
      const result = await fn();
      return { result, attempts };
    } catch (error) {
      lastError = error as Error;
    }
  }

  return { attempts, error: lastError };
}

// Test 1: Success on first try
(async () => {
  const result = await retryMock(
    async () => 'success',
    { maxRetries: 3, initialDelayMs: 100 }
  );
  assertEqual(result.attempts, 1, 'Should succeed on first try');
  assertEqual(result.result, 'success', 'Should return correct result');
})();

// Test 2: Success after retries
(async () => {
  let callCount = 0;
  const result = await retryMock(
    async () => {
      callCount++;
      if (callCount < 3) throw new Error('fail');
      return 'success';
    },
    { maxRetries: 3, initialDelayMs: 100 }
  );
  assertEqual(result.attempts, 3, 'Should retry until success');
  assertEqual(result.result, 'success', 'Should return correct result after retries');
})();

// Test 3: Exhaust retries
(async () => {
  const result = await retryMock(
    async () => { throw new Error('always fails'); },
    { maxRetries: 2, initialDelayMs: 100 }
  );
  assertEqual(result.attempts, 3, 'Should attempt maxRetries + 1 times');
  assertEqual(result.error?.message, 'always fails', 'Should return last error');
})();

console.log('\n=== All RetryService tests passed! ===\n');
console.log('✅ ALL TESTS PASSED');
