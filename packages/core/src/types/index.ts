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
  emailAction?: 'DRAFT' | 'SEND';
  
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
  mode: 'PROD' | 'TEST' | 'DRY_RUN';
  duration: number;
  error?: string;
  logs: LogEntry[];
}

/**
 * Log entry for audit trail
 */
export interface LogEntry {
  timestamp: Date;
  level: 'INFO' | 'WARN' | 'ERROR';
  component: string;
  message: string;
  context?: Record<string, any>;
}
