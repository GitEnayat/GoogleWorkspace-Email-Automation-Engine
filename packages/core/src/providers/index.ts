/**
 * Provider interfaces - platform abstraction layer
 * These define contracts that different platforms must implement
 */

import { EmailDraft, EmailConfig, ParsedTemplate, Recipient, ManagedLink, ExecutionResult } from '../types';

/**
 * Email provider - abstracts email service operations.
 * Implementations will interact with specific email APIs (e.g., Gmail, Outlook).
 */
export interface EmailProvider {
  /**
   * Create a new email draft with specified subject, body, and recipients.
   * @param subject The subject line of the email.
   * @param body The plain text body of the email.
   * @param to An array of primary recipient email addresses.
   * @param cc Optional array of CC recipient email addresses.
   * @param bcc Optional array of BCC recipient email addresses.
   * @param htmlBody Optional HTML body of the email.
   * @returns A promise that resolves with the ID of the created draft.
   */
  createDraft(subject: string, body: string, to: string[], cc?: string[], bcc?: string[], htmlBody?: string): Promise<string>;
  
  /**
   * Update an existing email draft.
   * @param draftId The ID of the draft to update.
   * @param subject The new subject line for the draft.
   * @param body The new plain text body for the draft.
   * @param htmlBody Optional new HTML body for the draft.
   * @returns A promise that resolves when the draft has been updated.
   */
  updateDraft(draftId: string, subject: string, body: string, htmlBody?: string): Promise<void>;
  
  /**
   * Find an existing email draft by its subject line.
   * @param subject The subject line to search for.
   * @returns A promise that resolves with the ID of the found draft, or null if not found.
   */
  findDraftBySubject(subject: string): Promise<string | null>;

  /**
   * Find an existing email thread by its subject line.
   * This is used to create replies within an existing conversation.
   * @param subject The subject line of the thread to find.
   * @returns A promise that resolves with the thread ID, or null if not found.
   */
  findThreadBySubject?(subject: string): Promise<string | null>;

  /**
   * Create a reply draft for an existing email thread.
   * @param threadId The ID of the thread to reply to.
   * @param body The plain text body of the reply.
   * @param cc Optional array of CC recipient email addresses for the reply.
   * @param bcc Optional array of BCC recipient email addresses for the reply.
   * @param htmlBody Optional HTML body of the reply.
   * @returns A promise that resolves with the ID of the created reply draft.
   */
  createReplyDraft?(threadId: string, body: string, cc?: string[], bcc?: string[], htmlBody?: string): Promise<string>;
  
  /**
   * Send an email, either from an existing draft or directly.
   * @param draftId Optional ID of an existing draft to send.
   * @param to Optional array of primary recipient email addresses (if not sending a draft).
   * @param subject Optional subject line (if not sending a draft).
   * @param body Optional plain text body (if not sending a draft).
   * @returns A promise that resolves when the email has been sent.
   */
  sendEmail(draftId?: string, to?: string[], subject?: string, body?: string): Promise<void>;
  
  /**
   * Get the email address of the currently authenticated user.
   * @returns The email address of the current user.
   */
  getCurrentUserEmail(): string;
}

/**
 * Template loader - abstracts operations for loading and parsing templates from various sources.
 */
export interface TemplateLoader {
  /**
   * Load and parse a template by its name from a given source.
   * @param templateName The name or identifier of the template.
   * @param sourceId The ID of the source document or repository where the template is stored.
   * @returns A promise that resolves with the parsed template object.
   */
  loadTemplate(templateName: string, sourceId: string): Promise<ParsedTemplate>;
  
  /**
   * Get the raw content of a template without parsing.
   * @param templateName The name or identifier of the template.
   * @param sourceId The ID of the source document or repository.
   * @returns A promise that resolves with the raw string content of the template.
   */
  getRawContent(templateName: string, sourceId: string): Promise<string>;
}

/**
 * Data store - abstracts operations for accessing structured data (e.g., from spreadsheets, databases).
 */
export interface DataStore {
  /**
   * Get raw data from a specified sheet ID and range.
   * @param sheetId The ID of the spreadsheet or data source.
   * @param range The specific range within the data source (e.g., A1:B10).
   * @returns A promise that resolves with a 2D array of data.
   */
  getData(sheetId: string, range: string): Promise<any[][]>;
  
  /**
   * Get data from a specific tab/sheet, structured as an array of records (key-value pairs).
   * @param sheetId The ID of the spreadsheet or data source.
   * @param tabName The name of the tab or sheet to retrieve data from.
   * @returns A promise that resolves with an array of records.
   */
  getTabData(sheetId: string, tabName: string): Promise<Record<string, any>[]>;
  
  /**
   * Append a new row of data to a specified sheet and tab.
   * @param sheetId The ID of the spreadsheet or data source.
   * @param tabName The name of the tab or sheet to append to.
   * @param row The array of values representing the row to append.
   * @returns A promise that resolves when the row has been appended.
   */
  appendRow(sheetId: string, tabName: string, row: any[]): Promise<void>;
}

/**
 * Link repository - manages URL mappings for dynamic link injection.
 */
export interface LinkRepository {
  /**
   * Load all managed links from a given source and tab.
   * @param sourceId The ID of the source document or repository.
   * @param tabName The name of the tab or sheet containing link definitions.
   * @returns A promise that resolves with an array of ManagedLink objects.
   */
  loadLinks(sourceId: string, tabName: string): Promise<ManagedLink[]>;
  
  /**
   * Get a single managed link by its key.
   * @param key The key of the link to retrieve.
   * @returns A promise that resolves with the ManagedLink object, or null if not found.
   */
  getLink(key: string): Promise<ManagedLink | null>;
}

/**
 * Table renderer - abstracts the process of rendering data tables into HTML.
 */
export interface TableRenderer {
  /**
   * Render a table from a data source range into an HTML string.
   * @param sheetId The ID of the spreadsheet or data source.
   * @param range The specific range within the data source to render.
   * @returns A promise that resolves with the HTML string representation of the table.
   */
  renderTable(sheetId: string, range: string): Promise<string>;
}

/**
 * Logger - abstracts logging operations, allowing different logging implementations.
 */
export interface Logger {
  /**
   * Logs an informational message.
   * @param component The component generating the log.
   * @param message The log message.
   * @param context Optional additional context data.
   */
  info(component: string, message: string, context?: Record<string, any>): void;
  /**
   * Logs a warning message.
   * @param component The component generating the log.
   * @param message The log message.
   * @param context Optional additional context data.
   */
  warn(component: string, message: string, context?: Record<string, any>): void;
  /**
   * Logs an error message.
   * @param component The component generating the log.
   * @param message The log message.
   * @param context Optional additional context data.
   */
  error(component: string, message: string, context?: Record<string, any>): void;
  /**
   * Logs a debug message.
   * @param component The component generating the log.
   * @param message The log message.
   * @param context Optional additional context data.
   */
  debug(component: string, message: string, context?: Record<string, any>): void;
}

/**
 * Cache - abstracts caching operations for storing and retrieving data.
 */
export interface Cache {
  /**
   * Retrieves a value from the cache.
   * @param key The key associated with the cached value.
   * @returns A promise that resolves with the cached value, or null if not found.
   */
  get<T>(key: string): Promise<T | null>;
  /**
   * Stores a value in the cache.
   * @param key The key to associate with the value.
   * @param value The value to store.
   * @param ttlSeconds Optional time-to-live for the cached value in seconds.
   * @returns A promise that resolves when the value has been set.
   */
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  /**
   * Removes a value from the cache.
   * @param key The key of the value to remove.
   * @returns A promise that resolves when the value has been removed.
   */
  remove(key: string): Promise<void>;
  /**
   * Clears all entries from the cache.
   * @returns A promise that resolves when the cache has been cleared.
   */
  clear(): Promise<void>;
}

/**
 * Complete platform interface - combines all required and optional services.
 * This object is passed to the EmailEngine to provide platform-specific functionalities.
 */
export interface PlatformServices {
  /** Email provider for sending and managing drafts. */
  email: EmailProvider;
  /** Template loader for fetching and parsing email templates. */
  template: TemplateLoader;
  /** Data store for accessing recipient data and other configurations. */
  data: DataStore;
  /** Optional link repository for managing dynamic links. */
  links?: LinkRepository;
  /** Optional table renderer for converting data ranges into HTML tables. */
  tables?: TableRenderer; // Optional for now
  /** Logger for capturing operational logs and errors. */
  logger: Logger;
  /** Optional cache for improving performance. */
  cache?: Cache;
}
