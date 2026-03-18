// ================================================================
// TEMPLATE VALIDATOR
// Pre-flight validation for email templates
// ================================================================
// Validates:
// - Template tab existence
// - Required section tags ([SUBJECT], [BODY])
// - Dictionary token syntax
// - Table tag format
// - Link tag format
// - Recipient configuration
// ================================================================

/**
 * Validates a template before execution.
 * 
 * @param {string} templateName - The tab name to validate
 * @param {string} [documentId] - Optional document ID (uses default if not provided)
 * @return {Object} Validation result: { valid: boolean, errors: string[], warnings: string[] }
 */
function validateTemplate(templateName, documentId) {
  const errors = [];
  const warnings = [];
  
  Logger.log(`🔍 Validating template: "${templateName}"`);
  
  // Get document ID from config if not provided
  if (!documentId) {
    documentId = CONFIG.templateDocumentId;
  }
  
  try {
    // 1. Check if document exists
    const doc = DocumentApp.openById(documentId);
    if (!doc) {
      errors.push(`Document not found: ${documentId}`);
      return { valid: false, errors, warnings };
    }
    
    // 2. Check if tab exists
    const tabs = doc.getTabs();
    const targetTab = findTabRecursive_(tabs, templateName);
    
    if (!targetTab) {
      errors.push(`Tab '${templateName}' not found in document`);
      const availableTabs = getAllTabNames_(tabs);
      if (availableTabs.length > 0) {
        errors.push(`Available tabs: ${availableTabs.join(", ")}`);
      }
      return { valid: false, errors, warnings };
    }
    
    // 3. Parse template content
    const docTab = targetTab.asDocumentTab();
    const bodyElement = docTab.getBody();
    const numChildren = bodyElement.getNumChildren();
    
    let hasSubjectTag = false;
    let hasBodyTag = false;
    let hasToTag = false;
    let hasCcTag = false;
    let subjectContent = "";
    let bodyContent = "";
    let toContent = "";
    let ccContent = "";
    let mode = "none";
    
    for (let i = 0; i < numChildren; i++) {
      const child = bodyElement.getChild(i);
      const text = child.getText().trim();
      
      if (text === "[SUBJECT]") {
        mode = "subject";
        hasSubjectTag = true;
        continue;
      }
      if (text === "[BODY]") {
        mode = "body";
        hasBodyTag = true;
        continue;
      }
      if (text === "[TO]") {
        mode = "to";
        hasToTag = true;
        continue;
      }
      if (text === "[CC]") {
        mode = "cc";
        hasCcTag = true;
        continue;
      }
      
      if (mode === "subject" && text !== "") {
        subjectContent += text + " ";
        mode = "none";
      } else if (mode === "body") {
        bodyContent += text + " ";
      } else if (mode === "to" && text !== "") {
        toContent += text + " ";
      } else if (mode === "cc" && text !== "") {
        ccContent += text + " ";
      }
    }
    
    // 4. Check required tags
    if (!hasSubjectTag) {
      errors.push("Missing required tag: [SUBJECT]");
    }
    if (!hasBodyTag) {
      errors.push("Missing required tag: [BODY]");
    }
    
    // 5. Validate content
    if (hasSubjectTag && !subjectContent.trim()) {
      errors.push("[SUBJECT] tag is present but empty");
    }
    
    if (hasBodyTag && !bodyContent.trim()) {
      warnings.push("[BODY] tag is present but appears to be empty");
    }
    
    if (!hasToTag && !hasCcTag) {
      warnings.push("No [TO] or [CC] recipients defined");
    }
    
    // 6. Validate dictionary tokens
    const allContent = subjectContent + " " + bodyContent;
    const dictErrors = validateDictionaryTokens_(allContent);
    errors.push(...dictErrors);
    
    const dictWarnings = checkDeprecatedTokens_(allContent);
    warnings.push(...dictWarnings);
    
    // 7. Validate table tags
    const tableErrors = validateTableTags_(bodyContent);
    errors.push(...tableErrors);
    
    // 8. Validate link tags
    const linkWarnings = validateLinkTags_(bodyContent);
    warnings.push(...linkWarnings);
    
    // 9. Check common mistakes
    const commonMistakes = checkCommonMistakes_(allContent);
    warnings.push(...commonMistakes);
    
  } catch (e) {
    errors.push(`Validation error: ${e.message}`);
  }
  
  const valid = errors.length === 0;
  
  if (valid && warnings.length === 0) {
    Logger.log(`✅ Template "${templateName}" is valid`);
  } else if (valid) {
    Logger.log(`⚠️ Template "${templateName}" has warnings: ${warnings.join(", ")}`);
  } else {
    Logger.log(`❌ Template "${templateName}" has errors: ${errors.join(", ")}`);
  }
  
  return { valid, errors, warnings };
}

/**
 * Validates dictionary token syntax
 * @private
 */
function validateDictionaryTokens_(content) {
  const errors = [];
  const validCommands = [
    "DATE", "RANGE", "TIME", "MONTHNAME",
    "DATE_FORMAT", "GREETING", "ACTIVE_SPREADSHEET_LINK"
  ];
  
  const tagRegex = /\{\{([^}]+)\}\}/g;
  let match;
  
  while ((match = tagRegex.exec(content)) !== null) {
    const fullTag = match[1].trim();
    const parts = fullTag.split(":").map(p => p.trim());
    const command = parts[0].toUpperCase();
    const cleanCommand = command.replace(/<[^>]+>/g, "").trim();
    
    // Check for unknown commands
    if (!validCommands.includes(cleanCommand)) {
      // Allow variable placeholders like {{SENDER_NAME}}
      if (!/^[A-Z_]+$/.test(cleanCommand)) {
        errors.push(`Unknown dictionary command: "${cleanCommand}" in tag "{{${fullTag}}}"`);
      }
    }
    
    // Check for malformed tags
    if (fullTag.includes("{{") || fullTag.includes("}}")) {
      errors.push(`Malformed tag (nested braces): "{{${fullTag}}}"`);
    }
    
    // Check DATE_FORMAT has format string
    if (cleanCommand === "DATE_FORMAT" && !parts[2]) {
      errors.push(`DATE_FORMAT missing format string: "{{${fullTag}}}" (expected: {{DATE_FORMAT:Today:dd/MM/yyyy}})`);
    }
  }
  
  return errors;
}

/**
 * Checks for deprecated or problematic tokens
 * @private
 */
function checkDeprecatedTokens_(content) {
  const warnings = [];
  
  // Check for single-brace tags
  if (content.includes("{DATE:") && !content.includes("{{DATE:")) {
    warnings.push("Found single-brace {DATE:...} - did you mean {{DATE:...}}?");
  }
  
  // Check for old TIME syntax
  if (content.includes("{{TIME:BKK}}") && content.includes("{{TIME:KUL}}")) {
    warnings.push("Both BKK and KUL time zones used - ensure this is intentional");
  }
  
  return warnings;
}

/**
 * Validates table tag format
 * @private
 */
function validateTableTags_(content) {
  const errors = [];
  
  // Find all [Table] tags
  const tableRegex = /\[Table\]\s*Sheet:\s*([^,]+),\s*range:\s*([^\$]+?)(?:<\/p>|\n|$)/gi;
  let match;
  
  while ((match = tableRegex.exec(content)) !== null) {
    const sheetRef = match[1].trim();
    const rangeRef = match[2].trim().replace(/<[^>]+>/g, "");
    
    // Check sheet reference looks valid
    if (!sheetRef.match(/[-\w]{25,}/) && !sheetRef.match(/^https?:\/\//)) {
      errors.push(`Table tag: Invalid sheet reference "${sheetRef}" (expected URL or Sheet ID)`);
    }
    
    // Validate A1 notation
    const rangePattern = /^['"]?[^!'"]+['"]?![A-Z]+\d+:[A-Z]+\d+$/;
    if (!rangePattern.test(rangeRef)) {
      errors.push(`Table tag: Invalid range "${rangeRef}" (expected format: 'Sheet'!A1:D10)`);
    }
  }
  
  return errors;
}

/**
 * Validates link tag format
 * @private
 */
function validateLinkTags_(content) {
  const warnings = [];
  
  // Find all $LINK tags
  const linkTags = content.match(/\$LINK:.*?\$/g) || [];
  
  linkTags.forEach(tag => {
    if (!tag.includes("TEXT:")) {
      warnings.push(`Link tag may be malformed: "${tag.substring(0, 50)}..." (expected: $LINK:Key, TEXT:Label$)`);
    }
  });
  
  return warnings;
}

/**
 * Checks for common mistakes
 * @private
 */
function checkCommonMistakes_(content) {
  const warnings = [];
  
  // Check for excessive whitespace
  if (content.match(/\n\s*\n\s*\n/)) {
    warnings.push("Multiple consecutive empty lines detected");
  }
  
  // Check for very long subject lines
  const subjectMatch = content.match(/\[SUBJECT\]\s*([^{]+)/);
  if (subjectMatch && subjectMatch[1].length > 100) {
    warnings.push("Subject line is very long (>100 chars) - may be truncated in email clients");
  }
  
  // Check for mismatched braces
  const openBraces = (content.match(/\{\{/g) || []).length;
  const closeBraces = (content.match(/\}\}/g) || []).length;
  if (openBraces !== closeBraces) {
    warnings.push(`Mismatched dictionary tags: ${openBraces} opening '{{' vs ${closeBraces} closing '}}'`);
  }
  
  return warnings;
}

/**
 * Gets all tab names recursively
 * @private
 */
function getAllTabNames_(tabsList) {
  const names = [];
  for (const tab of tabsList) {
    names.push(tab.getTitle());
    const childTabs = tab.getChildTabs();
    if (childTabs.length > 0) {
      names.push(...getAllTabNames_(childTabs));
    }
  }
  return names;
}

/**
 * Validates multiple templates in batch
 * 
 * @param {string[]} templateNames - Array of template names to validate
 * @param {string} [documentId] - Optional document ID
 * @return {Object} Batch validation results
 */
function validateTemplatesBatch(templateNames, documentId) {
  Logger.log(`🔍 Batch validating ${templateNames.length} templates...`);
  
  const results = {
    valid: [],
    invalid: [],
    total: templateNames.length
  };
  
  templateNames.forEach(name => {
    const result = validateTemplate(name, documentId);
    if (result.valid) {
      results.valid.push({ name, warnings: result.warnings });
    } else {
      results.invalid.push({ name, errors: result.errors, warnings: result.warnings });
    }
  });
  
  Logger.log(`✅ Batch validation complete: ${results.valid.length} valid, ${results.invalid.length} invalid`);
  
  return results;
}

/**
 * Quick validation check - returns true if template is usable
 * 
 * @param {string} templateName - The tab name to check
 * @param {string} [documentId] - Optional document ID
 * @return {boolean} True if template is valid
 */
function isTemplateValid(templateName, documentId) {
  const result = validateTemplate(templateName, documentId);
  return result.valid;
}
