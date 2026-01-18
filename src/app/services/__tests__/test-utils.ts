/**
 * Shared Test Utilities
 * 
 * Common assertion functions for all test files
 */

export function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`FAIL: ${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
  }
  console.log(`✓ ${message}`);
}

export function assertNotEqual<T>(actual: T, expected: T, message: string): void {
  if (actual === expected) {
    throw new Error(`FAIL: ${message}\n  Expected to differ from: ${expected}\n  Actual: ${actual}`);
  }
  console.log(`✓ ${message}`);
}

export function assertTrue(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}\n  Expected: true\n  Actual: false`);
  }
  console.log(`✓ ${message}`);
}

export function assertFalse(condition: boolean, message: string): void {
  if (condition) {
    throw new Error(`FAIL: ${message}\n  Expected: false\n  Actual: true`);
  }
  console.log(`✓ ${message}`);
}

export function assertThrows(fn: () => void, message: string): void {
  try {
    fn();
    throw new Error(`FAIL: ${message}\n  Expected to throw, but did not`);
  } catch (e) {
    if ((e as Error).message.startsWith('FAIL:')) throw e;
    console.log(`✓ ${message}`);
  }
}
