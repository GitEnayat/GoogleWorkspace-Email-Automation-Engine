import { Logger } from '@universal-email/core';

export class MicrosoftLogger implements Logger {
  info(component: string, message: string, context?: Record<string, any>): void {
    console.log(`[${new Date().toISOString()}] INFO [${component}]: ${message}`, context || '');
  }
  warn(component: string, message: string, context?: Record<string, any>): void {
    console.warn(`[${new Date().toISOString()}] WARN [${component}]: ${message}`, context || '');
  }
  error(component: string, message: string, context?: Record<string, any>): void {
    console.error(`[${new Date().toISOString()}] ERROR [${component}]: ${message}`, context || '');
  }
  debug(component: string, message: string, context?: Record<string, any>): void {
    console.debug(`[${new Date().toISOString()}] DEBUG [${component}]: ${message}`, context || '');
  }
}
