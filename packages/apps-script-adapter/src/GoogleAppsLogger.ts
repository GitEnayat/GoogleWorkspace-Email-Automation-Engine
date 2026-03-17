/**
 * Google Apps Script Logger
 * Implements Logger using Logger and SpreadsheetApp
 */

import { Logger } from '@universal-email/core';

export class GoogleAppsLogger implements Logger {
  private logsTabName?: string;
  private logsSheetId?: string;

  constructor(logsSheetId?: string, logsTabName?: string) {
    this.logsSheetId = logsSheetId;
    this.logsTabName = logsTabName;
  }

  info(component: string, message: string, context?: Record<string, any>): void {
    this.log('INFO', component, message, context);
  }

  warn(component: string, message: string, context?: Record<string, any>): void {
    this.log('WARN', component, message, context);
  }

  error(component: string, message: string, context?: Record<string, any>): void {
    this.log('ERROR', component, message, context);
  }

  debug(component: string, message: string, context?: Record<string, any>): void {
    this.log('DEBUG', component, message, context);
  }

  private log(
    level: string,
    component: string,
    message: string,
    context?: Record<string, any>
  ): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] [${component}] ${message}${
      context ? ' | Context: ' + JSON.stringify(context) : ''
    }`;

    // Log to Apps Script Logger
    Logger.log(logEntry);

    // Also append to spreadsheet if configured
    if (this.logsSheetId && this.logsTabName) {
      this.appendLogToSheet(level, component, message, timestamp, context);
    }
  }

  private appendLogToSheet(
    level: string,
    component: string,
    message: string,
    timestamp: string,
    context?: Record<string, any>
  ): void {
    try {
      const spreadsheet = SpreadsheetApp.openById(this.logsSheetId!);
      const sheet = spreadsheet.getSheetByName(this.logsTabName!);
      
      if (sheet) {
        sheet.appendRow([
          timestamp,
          level,
          component,
          message,
          context ? JSON.stringify(context) : ''
        ]);
      }
    } catch (error) {
      // Fallback to Logger.log if sheet logging fails
      Logger.log(`[Fallback Log] ${level}: ${message}`);
    }
  }
}
