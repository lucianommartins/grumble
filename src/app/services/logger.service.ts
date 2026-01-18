import { Injectable, isDevMode } from '@angular/core';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

@Injectable({
  providedIn: 'root'
})
export class LoggerService {
  private level: LogLevel = isDevMode() ? LogLevel.DEBUG : LogLevel.WARN;
  
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(tag: string, message: string, ...data: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.log(`[${tag}] ${message}`, ...data);
    }
  }

  info(tag: string, message: string, ...data: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      console.info(`[${tag}] ${message}`, ...data);
    }
  }

  warn(tag: string, message: string, ...data: unknown[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[${tag}] ${message}`, ...data);
    }
  }

  error(tag: string, message: string, ...data: unknown[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[${tag}] ${message}`, ...data);
    }
  }
}
