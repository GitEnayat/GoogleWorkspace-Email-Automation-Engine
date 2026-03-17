/**
 * Provider interfaces - platform abstraction layer
 * These define contracts that different platforms must implement
 */

import { EmailDraft, EmailConfig, ParsedTemplate, Recipient, ManagedLink, ExecutionResult } from '../types';

/**
 * Email provider - abstracts email service operations
 */
export interface EmailProvider {
  /**
   * Create a new email draft
   */
  createDraft(subject: string, body: string, to: string[], cc?: string[], bcc?: string[]): Promise<string>;
  
  /**
   * Update an existing draft
   */
  updateDraft(draftId: string, subject: string, body: string): Promise<void>;
  
  /**
   * Find draft by subject
   */
  findDraftBySubject(subject: string): Promise<string | null>;
  
  /**
   * Send an email (from draft or directly)
   */
  sendEmail(draftId?: string, to?: string[], subject?: string, body?: string): Promise<void>;
  
  /**
   * Get current user's email (for test mode)
   */
  getCurrentUserEmail(): string;
}

/**
 * Template loader - abstracts template source operations
 */
export interface TemplateLoader {
  /**
   * Load and parse a template by name
   */
  loadTemplate(templateName: string, sourceId: string): Promise<ParsedTemplate>;
  
  /**
   * Get raw template content
   */
  getRawContent(templateName: string, sourceId: string): Promise<string>;
}

/**
 * Data store - abstracts data source operations (e.g., Google Sheets)
 */
export interface DataStore {
  /**
   * Get data from a range
   */
  getData(sheetId: string, range: string): Promise<any[][]>;
  
  /**
   * Get all values from a tab
   */
  getTabData(sheetId: string, tabName: string): Promise<Record<string, any>[]>;
  
  /**
   * Append a row to a sheet
   */
  appendRow(sheetId: string, tabName: string, row: any[]): Promise<void>;
}

/**
 * Link repository - manages URL mappings
 */
export interface LinkRepository {
  /**
   * Load all managed links
   */
  loadLinks(sourceId: string, tabName: string): Promise<ManagedLink[]>;
  
  /**
   * Get a single link by key
   */
  getLink(key: string): Promise<ManagedLink | null>;
}

/**
 * Logger - abstracts logging operations
 */
export interface Logger {
  info(component: string, message: string, context?: Record<string, any>): void;
  warn(component: string, message: string, context?: Record<string, any>): void;
  error(component: string, message: string, context?: Record<string, any>): void;
  debug(component: string, message: string, context?: Record<string, any>): void;
}

/**
 * Cache - abstracts caching operations
 */
export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Complete platform interface - combines all providers
 */
export interface PlatformServices {
  email: EmailProvider;
  template: TemplateLoader;
  data: DataStore;
  links?: LinkRepository;
  logger: Logger;
  cache?: Cache;
}
