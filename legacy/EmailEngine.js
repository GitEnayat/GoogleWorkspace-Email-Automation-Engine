// ================================================================
// UNIVERSAL EMAIL AUTOMATION ENGINE
// Main Orchestration Layer
// ================================================================
// A clean, modular email automation library for Google Apps Script
// 
// Features:
// - Safe draft recycling
// - Test mode for debugging
// - Dry run mode for preview
// - Direct send option
// - Structured logging
// ================================================================

// ==========================================
// CONFIGURATION
// ==========================================

const CONFIG = {
  // Master Template Document ID
  templateDocumentId: "YOUR_TEMPLATE_DOC_ID",
  
  // Recipient Directory Spreadsheet ID
  directorySheetId: "YOUR_DIRECTORY_SHEET_ID",
  recipientsTabName: "Recipients_Master",
  senderProfilesTabName: "Sender_Profiles",
  
  // Column mappings
  recipientEmailColumn: "Email",
  recipientTagColumns: ["Role", "Team", "Department"],
  
  // CMS Link Repository
  linkRepositorySheetId: "YOUR_LINK_SHEET_ID",
  linkRepositoryTabName: "Link_Registry",
  linkKeyColumn: "Link_Key",
  linkUrlColumn: "Target_URL",
  
  // Branding
  logoFileId: "YOUR_LOGO_FILE_ID",
  signatureTemplateTab: "Signature_Template",
  
  // Logging
  logsTabName: "System_Logs",
  
  // Default action: "DRAFT", "SEND"
  defaultAction: "DRAFT"
};

// ==========================================
// MAIN ENTRY POINT
// ==========================================

/**
 * Generates an email draft from a template.
 * 
 * @param {string} templateTabName - The tab name in the Google Doc template
 * @param {Object} [options] - Optional configuration
 * @param {string} [options.action] - "DRAFT" (default), "SEND", or "DRY_RUN"
 * @param {boolean} [options.testMode] - If true, sends to current user only
 * @param {string} [options.templateDocumentId] - Override template doc ID
 * @param {string} [options.directorySheetId] - Override directory sheet ID
 * @return {Object} Result: { success: boolean, draftId: string|null, error: string|null }
 */
function generateEmailDraft(templateTabName, options = {}) {
  const startTime = Date.now();
  const action = options.action || CONFIG.defaultAction;
  const testMode = options.testMode === true;
  const dryRun = action === "DRY_RUN";
  
  // Merge config with overrides
  const config = {
    ...CONFIG,
    templateDocumentId: options.templateDocumentId || CONFIG.templateDocumentId,
    directorySheetId: options.directorySheetId || CONFIG.directorySheetId
  };
  
  Logger.log(`🚀 Starting email generation for: "${templateTabName}"`);
  
  if (dryRun) {
    Logger.log("🧪 DRY RUN MODE: No drafts will be created");
  }
  if (testMode) {
    Logger.log("🧪 TEST MODE: Email will be sent to current user only");
  }
  
  try {
    // 1. Fetch and parse template
    const template = fetchTemplate(templateTabName, config.templateDocumentId);
    if (!template) {
      throw new Error(`Template "${templateTabName}" not found`);
    }
    Logger.log(`✅ Template fetched: "${template.subject}"`);
    
    // 2. Process CMS links
    const linkMap = loadLinkRepository(config);
    const processedBody = injectManagedLinks(template.body, linkMap);
    Logger.log(`✅ CMS links processed (${Object.keys(linkMap).length} links loaded)`);
    
    // 3. Resolve recipients
    const toKeys = parseRecipientKeys(template.to);
    const ccKeys = parseRecipientKeys(template.cc);
    let recipientsTo = toKeys.length > 0 ? resolveRecipients(config, ...toKeys).join(",") : "";
    let recipientsCc = ccKeys.length > 0 ? resolveRecipients(config, ...ccKeys).join(",") : "";
    
    // Test mode override
    const currentUserEmail = Session.getActiveUser().getEmail();
    if (testMode) {
      const originalTo = recipientsTo;
      recipientsTo = currentUserEmail;
      recipientsCc = "";
      Logger.log(`⚠️ TEST MODE: Recipients overridden from "${originalTo}" to "${recipientsTo}"`);
    }
    
    // 4. Generate signature
    const sigObj = generateUserSignature(config);
    const finalHtmlBody = processedBody + "<br><br>" + sigObj.html;
    const plainTextBody = htmlToPlainText_(finalHtmlBody);
    
    // 5. Dry run - log and return
    if (dryRun) {
      Logger.log("📋 DRY RUN SUMMARY:");
      Logger.log(`   Subject: ${template.subject}`);
      Logger.log(`   To: ${recipientsTo || "(none)"}`);
      Logger.log(`   CC: ${recipientsCc || "(none)"}`);
      Logger.log(`   Body preview: ${finalHtmlBody.substring(0, 200)}...`);
      return { success: true, draftId: null, error: null };
    }
    
    // 6. Check for existing draft to update
    const existingDraft = findExistingDraft_(template.subject);
    if (existingDraft) {
      Logger.log(`♻️ Found existing draft for "${template.subject}". Updating...`);
      
      if (action === "SEND") {
        existingDraft.update(recipientsTo, template.subject, plainTextBody, {
          htmlBody: finalHtmlBody,
          cc: recipientsCc
        });
        existingDraft.send();
        Logger.log("✅ Draft updated and sent");
        logExecution("SENT", templateTabName, { draftId: existingDraft.getId(), duration: Date.now() - startTime, recipientsTo });
        return { success: true, draftId: existingDraft.getId(), error: null };
      } else {
        existingDraft.update(recipientsTo, template.subject, plainTextBody, {
          htmlBody: finalHtmlBody,
          cc: recipientsCc
        });
        Logger.log("✅ Draft updated");
        logExecution("UPDATED", templateTabName, { draftId: existingDraft.getId(), duration: Date.now() - startTime, recipientsTo });
        return { success: true, draftId: existingDraft.getId(), error: null };
      }
    }
    
    // 7. Search for existing thread to reply to
    const threads = GmailApp.search(`subject:"${template.subject}"`, 0, 5);
    let targetThread = null;
    for (const thread of threads) {
      const originalSubject = thread.getFirstMessageSubject();
      // Skip auto-replies
      if (originalSubject.match(/^(Automatic reply|OOO|Out of Office|Absence Notice):/i)) continue;
      targetThread = thread;
      break;
    }
    
    // 8. Create new draft
    let draft;
    if (targetThread) {
      if (recipientsTo) {
        Logger.log(`⚠️ Reply-all mode: Template TO recipients will be ignored`);
      }
      draft = targetThread.createDraftReplyAll(plainTextBody, {
        htmlBody: finalHtmlBody,
        cc: recipientsCc
      });
      Logger.log("✅ New draft created (reply mode)");
    } else {
      draft = GmailApp.createDraft(recipientsTo, template.subject, plainTextBody, {
        cc: recipientsCc,
        htmlBody: finalHtmlBody
      });
      Logger.log("✅ New draft created (new thread)");
    }
    
    // 9. Send if requested
    if (action === "SEND") {
      draft.send();
      Logger.log("✅ Draft sent");
      logExecution("SENT", templateTabName, { draftId: draft.getId(), duration: Date.now() - startTime, recipientsTo });
      return { success: true, draftId: draft.getId(), error: null };
    }
    
    logExecution("CREATED", templateTabName, { draftId: draft.getId(), duration: Date.now() - startTime, recipientsTo });
    return { success: true, draftId: draft.getId(), error: null };
    
  } catch (e) {
    Logger.log(`❌ Error: ${e.message}`);
    logExecution("ERROR", templateTabName, { error: e.message, duration: Date.now() - startTime });
    return { success: false, draftId: null, error: e.message };
  }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Finds an existing draft with matching subject
 * @private
 */
function findExistingDraft_(subject) {
  try {
    const drafts = GmailApp.getDrafts();
    for (const draft of drafts) {
      const draftMessage = draft.getMessage();
      const draftSubject = draftMessage.getSubject();
      if (draftSubject && draftSubject.indexOf(subject) !== -1) {
        return draft;
      }
    }
  } catch (e) {
    Logger.log(`⚠️ Draft search warning: ${e.message}`);
  }
  return null;
}

/**
 * Parses recipient keys from template TO/CC fields
 * @private
 */
function parseRecipientKeys(rawString) {
  if (!rawString) return [];
  return rawString.split(",")
    .map(item => item.trim().replace(/^[\('"]+|[\)'"]+$/g, ""))
    .filter(item => item !== "");
}

/**
 * Converts HTML to plain text for Gmail API
 * @private
 */
function htmlToPlainText_(html) {
  if (!html) return "";
  
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<td[^>]*>/gi, "\t")
    .replace(/<th[^>]*>/gi, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Logs execution to spreadsheet
 * @private
 */
function logExecution(status, templateName, details = {}) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.directorySheetId);
    let sheet = ss.getSheetByName(CONFIG.logsTabName);
    
    // Create log sheet if needed
    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.logsTabName);
      sheet.appendRow(["Timestamp", "User", "Template", "Status", "Draft ID", "Recipients", "Duration (ms)", "Details"]);
      sheet.setFrozenRows(1);
    }
    
    const timestamp = new Date();
    const user = Session.getActiveUser().getEmail();
    
    sheet.appendRow([
      timestamp,
      user,
      templateName,
      status,
      details.draftId || "",
      details.recipientsTo || "",
      details.duration || 0,
      details.error || JSON.stringify(details)
    ]);
    
  } catch (e) {
    Logger.log(`⚠️ Logging failed: ${e.message}`);
  }
}

// ==========================================
// CONVENIENCE FUNCTIONS
// ==========================================

/**
 * Creates a draft (alias for generateEmailDraft with default action)
 */
function createDraft(templateTabName, options = {}) {
  return generateEmailDraft(templateTabName, { ...options, action: "DRAFT" });
}

/**
 * Sends email directly (alias for generateEmailDraft with SEND action)
 */
function sendEmail(templateTabName, options = {}) {
  return generateEmailDraft(templateTabName, { ...options, action: "SEND" });
}

/**
 * Previews what would happen without creating draft
 */
function previewEmail(templateTabName, options = {}) {
  return generateEmailDraft(templateTabName, { ...options, action: "DRY_RUN" });
}
