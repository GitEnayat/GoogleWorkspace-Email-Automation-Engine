/**
 * Core type definitions for the Universal Email Automation Engine
 */

/**
 * Email draft representation
 */
export interface EmailDraft {
  /** Unique identifier for the email draft. */
  id: string;
  /** Subject line of the email. */
  subject: string;
  /** Plain text body of the email. */
  body: string;
  /** List of primary recipients' email addresses. */
  to: string[];
  /** Optional list of CC recipients' email addresses. */
  cc?: string[];
  /** Optional list of BCC recipients' email addresses. */
  bcc?: string[];
  /** Timestamp when the draft was created. */
  createdAt: Date;
  /** Timestamp when the draft was last updated. */
  updatedAt: Date;
}

/**
 * Template structure after parsing
 */
export interface ParsedTemplate {
  /** Name or identifier of the template. */
  name: string;
  /** Subject line extracted from the template. */
  subject: string;
  /** Body content extracted from the template, potentially HTML. */
  body: string;
  /** Optional default 'To' recipient from the template. */
  to?: string;
  /** Optional default 'CC' recipient from the template. */
  cc?: string;
  /** List of recognized placeholder tags (e.g., ['FirstName', 'Team', 'Date']). */
  tags: string[];
  /** Optional array of table ranges identified in the template. */
  tableRanges?: TableRange[];
}

/**
 * Table range from a data source (e.g., Google Sheet)
 */
export interface TableRange {
  /** Identifier of the data source (e.g., spreadsheet ID). */
  source: string;
  /** Range in A1 notation (e.g., 'Q1_Results'!A1:E10). */
  range: string;
  /** Indicates whether original formatting of the table should be preserved. */
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
  /** ID of the document containing the email template. */
  templateDocumentId?: string;

  /** ID of the spreadsheet/document containing recipient data. */
  directorySheetId?: string;
  /** Name of the tab within the directory sheet that contains recipient data. */
  recipientsTabName?: string;

  /** Column header for recipient email addresses in the directory sheet. */
  recipientEmailColumn?: string;
  /** Column headers for recipient data to be used as tags in the template. */
  recipientTagColumns?: string[];

  /** URL of the logo to include in the email. */
  logoUrl?: string;
  /** ID of the template for user signatures. */
  signatureTemplateId?: string;

  /** If true, no drafts or emails will be sent; only processing and logging occur. */
  dryRun?: boolean;
  /** If true, generates email for the current user only for testing purposes. */
  testMode?: boolean;

  /** Action to perform: 'DRAFT' to create drafts, 'SEND' to send emails. */
  emailAction?: "DRAFT" | "SEND";

  /** Delay in milliseconds between processing each email in a batch. */
  batchDelayMs?: number;

  /** Locale and regional preferences for date/time formatting. */
  locale?: LocaleConfig;

  /**
   * Sheet/workbook ID that contains the Settings tab.
   * Usually the same as directorySheetId.
   */
  settingsSheetId?: string;

  /** Tab name for engine settings. Default: "Engine_Settings" */
  settingsTabName?: string;

  /**
   * Runtime overrides or additional configuration properties.
   * @deprecated Consider using specific configuration properties instead of generic string keys.
   */
  [key: string]: any;
}

/**
 * Recipient with resolved email and metadata
 */
export interface Recipient {
  /** The email address of the recipient. */
  email: string;
  /** Key-value pairs of tags resolved for the recipient, used for template replacement. */
  tags: Record<string, string>;
  /** Optional user profile information for the recipient. */
  profile?: UserProfile;
}

/**
 * User profile for signatures
 */
export interface UserProfile {
  /** Full name of the user. */
  name: string;
  /** Job title of the user. */
  title: string;
  /** Department or team of the user. */
  department: string;
  /** Optional HTML signature content. */
  signature?: string;
}

/**
 * Link for managed URL replacement
 */
export interface ManagedLink {
  /** Unique key for the managed link. */
  key: string;
  /** The URL associated with the key. */
  url: string;
  /** Optional human-readable label for the link. */
  label?: string;
}

/**
 * Execution result of an email generation operation.
 */
export interface ExecutionResult {
  /** True if the operation was successful, false otherwise. */
  success: boolean;
  /** Optional ID of a single generated draft (if only one was generated). */
  draftId?: string;
  /** Optional list of IDs for all generated drafts in a batch operation. */
  draftIds?: string[];
  /** Number of recipients processed. */
  recipientCount: number;
  /** Mode in which the engine was run ('PROD', 'TEST', or 'DRY_RUN'). */
  mode: "PROD" | "TEST" | "DRY_RUN";
  /** Duration of the execution in milliseconds. */
  duration: number;
  /** Optional error message if the operation failed. */
  error?: string;
  /** Audit trail of log entries generated during execution. */
  logs: LogEntry[];
}

/**
 * Log entry for audit trail
 */
export interface LogEntry {
  /** Timestamp of the log entry. */
  timestamp: Date;
  /** Severity level of the log entry. */
  level: "INFO" | "WARN" | "ERROR";
  /** Component that generated the log entry (e.g., 'EmailEngine', 'TemplateLoader'). */
  component: string;
  /** The log message. */
  message: string;
  /** Optional additional context for the log entry. */
  context?: Record<string, any>;
}

/**
 * Validation result from template pre-flight checks
 */
export interface ValidationResult {
  /** True if the template is considered valid, false otherwise. */
  valid: boolean;
  /** List of error messages found during validation. */
  errors: string[];
  /** List of warning messages found during validation. */
  warnings: string[];
}

/**
 * Creates a fresh RegExp for matching [Table] directives in template HTML.
 * Returns a new instance each call to avoid global-flag lastIndex bugs.
 *
 * Matches both documented formats:
 *   [Table] Sheet: URL, range: 'Tab'!A1:E10
 *   [Table] URL, 'Tab'!A1:E10
 * @returns A new RegExp object for matching table tags.
 */
export function createTableTagRegex(): RegExp {
  return /\[Table\]\s*(?:Sheet:\s*)?([^,\s<]+),\s*(?:range:\s*)?([^<]+?)(?=<|$)/gi;
}
