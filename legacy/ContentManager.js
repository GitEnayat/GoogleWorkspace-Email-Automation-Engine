// ================================================================
// CONTENT MANAGER
// CMS Link Repository, Recipient Resolution, and Signature Generation
// ================================================================
// Handles:
// - Centralized link management ($LINK:Key, TEXT:Label$)
// - Distribution list resolution from spreadsheet
// - User signature generation with Base64 logo embedding
// ================================================================

// ==========================================
// CMS LINK REPOSITORY
// ==========================================

/**
 * Loads managed links from spreadsheet (CMS).
 * 
 * Expected sheet structure:
 * | Link_Key | Target_URL |
 * |----------|------------|
 * | POLICY   | https://...|
 * | HANDBOOK | https://...|
 * 
 * @param {Object} config - Configuration object with linkRepositorySheetId, linkRepositoryTabName, etc.
 * @return {Object} Map of link keys to URLs: { "POLICY": "https://...", "HANDBOOK": "https://..." }
 */
function loadLinkRepository(config) {
  const targetId = config.linkRepositorySheetId;
  const targetTab = config.linkRepositoryTabName;
  const colKeyName = config.linkKeyColumn || "Link_Key";
  const colLinkName = config.linkUrlColumn || "Target_URL";
  
  Logger.log(`🔌 CMS: Loading links from [${targetTab}]...`);
  
  try {
    const ss = SpreadsheetApp.openById(targetId);
    const sheet = ss.getSheetByName(targetTab);
    
    if (!sheet) {
      Logger.log(`⚠️ CMS Warning: Tab '${targetTab}' not found`);
      return {};
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      Logger.log("⚠️ CMS Warning: Sheet appears empty");
      return {};
    }
    
    // Identify column indices from header
    const headers = data.shift();
    const keyIndex = headers.indexOf(colKeyName);
    const linkIndex = headers.indexOf(colLinkName);
    
    if (keyIndex === -1) {
      Logger.log(`❌ CMS Error: Column '${colKeyName}' not found`);
      return {};
    }
    if (linkIndex === -1) {
      Logger.log(`❌ CMS Error: Column '${colLinkName}' not found`);
      return {};
    }
    
    // Build link map
    const linkMap = {};
    let count = 0;
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rawKey = row[keyIndex];
      const rawUrl = row[linkIndex];
      
      if (!rawKey) continue;
      
      const key = String(rawKey).trim();
      const url = String(rawUrl).trim();
      
      if (key && url) {
        linkMap[key] = url;
        count++;
      }
    }
    
    Logger.log(`✅ CMS: Loaded ${count} links`);
    return linkMap;
    
  } catch (e) {
    Logger.log(`❌ CMS Critical Error: ${e.message}`);
    return {};
  }
}

/**
 * Injects managed links into template HTML.
 * 
 * Usage in template:
 * $LINK:POLICY, TEXT:Company Policy$
 * $LINK:https://example.com, TEXT:Direct Link$
 * 
 * @param {string} bodyText - HTML body content
 * @param {Object} linkMap - Map of link keys to URLs
 * @return {string} HTML with links injected
 */
function injectManagedLinks(bodyText, linkMap) {
  if (!bodyText) return "";
  
  // Heal HTML inside $LINK tags
  const healedText = bodyText.replace(/\$LINK:([\s\S]*?),\s*TEXT:([\s\S]*?)\$/g, (match, keyPart, textPart) => {
    const cleanKey = keyPart
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const cleanText = textPart
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return "$LINK:" + cleanKey + ", TEXT:" + cleanText + "$";
  });
  
  // Replace $LINK tags with HTML anchors
  return healedText.replace(/\$LINK:(.*?),\s*TEXT:(.*?)\$/g, function(match, rawKey, rawLabel) {
    const key = rawKey.trim();
    const label = rawLabel.trim();
    
    let url = linkMap[key];
    
    // Allow direct URLs as keys
    if (!url && key.match(/^https?:\/\//i)) {
      url = key;
      Logger.log(`🔗 CMS: Using direct URL for [${label}]`);
    }
    
    if (url) {
      return `<a href="${url}" style="color: #1155cc; text-decoration: underline;">${label}</a>`;
    } else {
      Logger.log(`⚠️ CMS: Missing link key [${key}]`);
      return `<span style="background-color: #ffcccc; color: #cc0000; padding: 2px 5px; border-radius: 3px;">[MISSING LINK: ${key}]</span>`;
    }
  });
}

// ==========================================
// RECIPIENT RESOLUTION
// ==========================================

// Cache for distribution list data
let _DISTRO_CACHE_DATA = null;
let _DISTRO_CACHE_ID = null;

/**
 * Resolves recipient tags to email addresses.
 * 
 * Usage:
 * - Direct email: "john@example.com"
 * - Tag lookup: "Manager", "HR_Team"
 * 
 * @param {Object} config - Configuration with directorySheetId, recipientsTabName, etc.
 * @param {...string} args - Tags or email addresses
 * @return {string[]} Array of resolved email addresses
 */
function resolveRecipients(config, ...args) {
  if (args.length === 0) return [];
  
  const sheetId = config.directorySheetId;
  const tabName = config.recipientsTabName;
  const targetEmailCol = config.recipientEmailColumn;
  const targetTagCols = config.recipientTagColumns;
  
  // Check cache
  if (!_DISTRO_CACHE_DATA || _DISTRO_CACHE_ID !== sheetId) {
    Logger.log(`🔄 Distro: Fetching fresh data from [${tabName}]...`);
    
    try {
      const sheet = SpreadsheetApp.openById(sheetId).getSheetByName(tabName);
      if (!sheet) throw new Error(`Tab '${tabName}' not found`);
      
      const data = sheet.getDataRange().getValues();
      const headers = data.shift();
      
      // Map columns
      const emailColIndex = headers.indexOf(targetEmailCol);
      const tagIndices = targetTagCols
        .map(col => headers.indexOf(col))
        .filter(i => i !== -1);
      
      if (emailColIndex === -1) throw new Error(`Column '${targetEmailCol}' not found`);
      if (tagIndices.length === 0) throw new Error(`Tag columns ${targetTagCols} not found`);
      
      _DISTRO_CACHE_DATA = {
        rows: data,
        emailIndex: emailColIndex,
        tagIndices: tagIndices
      };
      _DISTRO_CACHE_ID = sheetId;
      
      Logger.log('✅ Distro: Data cached');
      
    } catch (e) {
      Logger.log(`❌ Distro Error: ${e.message}`);
      return [];
    }
  }
  
  // Process request
  const { rows, emailIndex, tagIndices } = _DISTRO_CACHE_DATA;
  
  const directEmails = args.filter(a => a.includes("@"));
  const lookups = args.filter(a => !a.includes("@"));
  
  const foundEmails = rows.filter(row => {
    return tagIndices.some(i => lookups.includes(row[i]));
  }).map(row => row[emailIndex]);
  
  return [...new Set([...foundEmails, ...directEmails])];
}

// ==========================================
// SIGNATURE GENERATION
// ==========================================

/**
 * Generates HTML signature for current user.
 * 
 * Expected sender profile sheet structure:
 * | UserEmail | Name | Role | PrimaryEmail | SecondaryEmail |
 * 
 * @param {Object} config - Configuration with directorySheetId, senderProfilesTabName, logoFileId, etc.
 * @return {Object} { html: string }
 */
function generateUserSignature(config) {
  const currentUserEmail = Session.getActiveUser().getEmail();
  
  // Fetch user details
  let userDetails = { name: "Automation Team", role: "Automation", email1: "", email2: "" };
  
  try {
    const sheet = SpreadsheetApp.openById(config.directorySheetId).getSheetByName(config.senderProfilesTabName);
    
    if (sheet) {
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const colMap = {};
      headers.forEach((h, i) => colMap[h.trim()] = i);
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][colMap['UserEmail']] === currentUserEmail) {
          userDetails.name = data[i][colMap['Name']] || "Automation Team";
          userDetails.role = data[i][colMap['Role']] || "Automation";
          userDetails.email1 = data[i][colMap['PrimaryEmail']] || "";
          userDetails.email2 = data[i][colMap['SecondaryEmail']] || "";
          break;
        }
      }
    } else {
      Logger.log(`⚠️ Signature Warning: Tab '${config.senderProfilesTabName}' not found`);
    }
    
  } catch (e) {
    Logger.log(`❌ Signature Error: ${e.message}`);
  }
  
  // Fetch and cache logo (Base64)
  let imgTag = "";
  
  try {
    if (config.logoFileId) {
      const cache = CacheService.getScriptCache();
      let b64 = cache.get("SIG_LOGO_B64");
      let mime = cache.get("SIG_LOGO_MIME");
      
      if (!b64) {
        const blob = DriveApp.getFileById(config.logoFileId).getBlob();
        b64 = Utilities.base64Encode(blob.getBytes());
        mime = blob.getContentType();
        
        // Check cache size limit (100KB)
        if (b64.length > 90000) {
          Logger.log(`⚠️ Logo too large for cache (${Math.round(b64.length / 1024)}KB)`);
        } else {
          cache.put("SIG_LOGO_B64", b64, 21600);
          cache.put("SIG_LOGO_MIME", mime, 21600);
          Logger.log(`✅ Logo cached (${Math.round(b64.length / 1024)}KB)`);
        }
      }
      
      imgTag = `<img src="data:${mime};base64,${b64}" width="200" style="display:block; height:auto;">`;
    }
    
  } catch (e) {
    Logger.log(`⚠️ Signature Logo Error: ${e.message}`);
  }
  
  // Fetch signature template
  const sigTemplate = fetchTemplate(config.signatureTemplateTab, config.templateDocumentId);
  let html = sigTemplate ? sigTemplate.body : "{{Sender_Name}}<br>{{Sender_Role}}<br>{{Signature_Logo}}";
  
  // Replace placeholders
  return {
    html: html
      .replace(/\{\{Sender_Name\}\}/g, userDetails.name)
      .replace(/\{\{Sender_Role\}\}/g, userDetails.role)
      .replace(/\{\{First_Email\}\}/g, userDetails.email1)
      .replace(/\{\{Second_Email\}\}/g, userDetails.email2)
      .replace(/\{\{Signature_Logo\}\}/g, imgTag)
  };
}

// ==========================================
// BACKWARD COMPATIBILITY ALIASES
// ==========================================

/**
 * Alias for loadLinkRepository (legacy naming)
 */
function getLinkDatabase(config) {
  return loadLinkRepository(config);
}

/**
 * Alias for injectManagedLinks (legacy naming)
 */
function parseLinkTags(bodyText, linkMap) {
  return injectManagedLinks(bodyText, linkMap);
}

/**
 * Alias for resolveRecipients (legacy naming)
 */
function getDistroEmails(config, ...args) {
  return resolveRecipients(config, ...args);
}

/**
 * Alias for generateUserSignature (legacy naming)
 */
function getUserGmailSignature(config) {
  return generateUserSignature(config);
}
