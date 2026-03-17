/*
MODULE: LoggerUtil
--------------------------------
Structured logging utility with timestamps, module names, and severity levels.
Provides consistent logging format across all modules.
Includes Sheet-based execution logging for audit trails.
--------------------------------
*/

/**
 * Log levels for structured logging
 */
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

/**
 * Current log level - adjust to control verbosity
 */
const CURRENT_LOG_LEVEL = LOG_LEVELS.INFO;

/**
 * Structured logging function
 * @param {string} level - Log level (DEBUG, INFO, WARN, ERROR)
 * @param {string} module - Module name (e.g., "MailOrchestrator", "TemplateService")
 * @param {string} message - Log message
 */
function log(level, module, message) {
  const levelUpper = level.toUpperCase();
  const levelValue = LOG_LEVELS[levelUpper] || LOG_LEVELS.INFO;

  // Skip if below current log level
  if (levelValue < CURRENT_LOG_LEVEL) return;

  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  const formatted = `[${timestamp}] [${levelUpper}] [${module}] ${message}`;

  Logger.log(formatted);
}

/**
 * Convenience methods for different log levels
 */
const Log = {
  debug: (module, message) => log('DEBUG', module, message),
  info: (module, message) => log('INFO', module, message),
  warn: (module, message) => log('WARN', module, message),
  error: (module, message) => log('ERROR', module, message)
};

/**
 * Logs a structured execution record to a Google Sheet.
 * @param {string} status - Result status (CREATED, UPDATED, ERROR, DRY_RUN, BATCH_X)
 * @param {string} templateName - Name of the template processed
 * @param {Object} details - Additional metadata (duration, user, etc)
 */
function logExecution(status, templateName, details = {}) {
  try {
    const config = new AppConfig();
    const sheetId = config.directorySheetId; // Store logs in Directory sheet for centralized data
    const tabName = config.logsTabName || "System_Logs";

    const ss = SpreadsheetApp.openById(sheetId);
    let sheet = ss.getSheetByName(tabName);

    // Create log sheet if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet(tabName);
      sheet.appendRow([
        "Timestamp",
        "User",
        "Template",
        "Status",
        "Draft ID",
        "Recipients",
        "Duration (ms)",
        "Mode",
        "Details/Error"
      ]);
      sheet.setFrozenRows(1);
      Log.info("LoggerUtil", `Created new log sheet: ${tabName}`);
    }

    const timestamp = new Date();
    const user = Session.getActiveUser().getEmail();
    const mode = details.dryRun ? "DRY_RUN" : (details.testMode ? "TEST" : "PROD");

    sheet.appendRow([
      timestamp,
      user,
      templateName,
      status,
      details.draftId || "",
      details.recipientsTo || "",
      details.duration || 0,
      mode,
      details.error || JSON.stringify(details)
    ]);

  } catch (e) {
    // Fallback if logging fails - don't break the main process
    Logger.log(`❌ Failed to write to log sheet: ${e.message}`);
  }
}
