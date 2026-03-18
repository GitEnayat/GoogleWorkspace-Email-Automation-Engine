/**
 * Core type definitions for the Universal Email Automation Engine
 */

/**
 * Email draft representation
 */
export interface EmailDraft {
  id: string;
  subject: string;
  body: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Template structure after parsing
 */
export interface ParsedTemplate {
  name: string;
  subject: string;
  body: string;
  to?: string;
  cc?: string;
  tags: string[]; // e.g., ['FirstName', 'Team', 'Date']
  tableRanges?: TableRange[];
}

/**
 * Table range from a data source (e.g., Google Sheet)
 */
export interface TableRange {
  source: string; // e.g., spreadsheet ID
  range: string; // e.g., 'Q1_Results'!A1:E10
  preserveFormatting: boolean;
}

/**
 * Locale and regional preferences for date/time formatting.
 * All fields are optional — sensible defaults are applied by the engine.
 */
export interface LocaleConfig {
  /** IANA timezone (e.g. "Asia/Kuala_Lumpur", "America/New_York"). Default: system local */
  timezone?: string;

  /** Date format string using Intl tokens. Default: "dd-MMM-yyyy" */
  dateFormat?: string;

  /** Locale tag for month/day names (e.g. "en-GB", "ms-MY"). Default: "en-GB" */
  locale?: string;

  /** Day the week starts on: 0 = Sunday, 1 = Monday, … 6 = Saturday. Default: 0 (Sunday) */
  weekStartDay?: 0 | 1 | 2 | 3 | 4 | 5 | 6;

  /** Time format: "12h" or "24h". Default: "24h" */
  timeFormat?: "12h" | "24h";
}

/**
 * Configuration for email generation
 */
export interface EmailConfig {
  // Template source
  templateDocumentId?: string;

  // Data source
  directorySheetId?: string;
  recipientsTabName?: string;

  // Recipient resolution
  recipientEmailColumn?: string;
  recipientTagColumns?: string[];

  // Branding
  logoUrl?: string;
  signatureTemplateId?: string;

  // Execution mode
  dryRun?: boolean;
  testMode?: boolean;

  // Action: create draft or send
  emailAction?: "DRAFT" | "SEND";

  // Batch rate limiting
  batchDelayMs?: number;

  // Locale / regional preferences
  locale?: LocaleConfig;

  /**
   * Sheet/workbook ID that contains the Settings tab.
   * Usually the same as directorySheetId.
   */
  settingsSheetId?: string;

  /** Tab name for engine settings. Default: "Engine_Settings" */
  settingsTabName?: string;

  // Runtime overrides
  [key: string]: any;
}

/**
 * Recipient with resolved email and metadata
 */
export interface Recipient {
  email: string;
  tags: Record<string, string>;
  profile?: UserProfile;
}

/**
 * User profile for signatures
 */
export interface UserProfile {
  name: string;
  title: string;
  department: string;
  signature?: string;
}

/**
 * Link for managed URL replacement
 */
export interface ManagedLink {
  key: string;
  url: string;
  label?: string;
}

/**
 * Execution result
 */
export interface ExecutionResult {
  success: boolean;
  draftId?: string;
  draftIds?: string[];
  recipientCount: number;
  mode: "PROD" | "TEST" | "DRY_RUN";
  duration: number;
  error?: string;
  logs: LogEntry[];
}

/**
 * Log entry for audit trail
 */
export interface LogEntry {
  timestamp: Date;
  level: "INFO" | "WARN" | "ERROR";
  component: string;
  message: string;
  context?: Record<string, any>;
}

/**
 * Validation result from template pre-flight checks
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Creates a fresh RegExp for matching [Table] directives in template HTML.
 * Returns a new instance each call to avoid global-flag lastIndex bugs.
 *
 * Matches both documented formats:
 *   [Table] Sheet: URL, range: 'Tab'!A1:D10
 *   [Table] URL, 'Tab'!A1:D10
 */
export function createTableTagRegex(): RegExp {
  return /\[Table\]\s*(?:Sheet:\s*)?([^,\s<]+),\s*(?:range:\s*)?([^<]+?)(?=<|$)/gi;
}
