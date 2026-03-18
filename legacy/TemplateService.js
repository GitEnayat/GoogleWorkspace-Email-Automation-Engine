// ================================================================
// TEMPLATE SERVICE
// Template fetching, parsing, and token replacement
// ================================================================
// Handles:
// - Google Doc template fetching
// - Section parsing ([SUBJECT], [BODY], [TO], [CC])
// - Date/time token replacement ({{DATE:Today}}, {{TIME}}, etc.)
// - Table rendering from Google Sheets
// - HTML conversion with formatting preservation
// ================================================================

// ==========================================
// MAIN TEMPLATE FETCHING
// ==========================================

/**
 * Fetches and parses a template from Google Docs.
 * 
 * @param {string} tabName - The exact tab name in the Google Doc
 * @param {string} documentId - The Google Doc ID
 * @return {Object} Template object: { subject, body, to, cc } or null if not found
 */
function fetchTemplate(tabName, documentId) {
  if (!documentId) {
    Logger.log("❌ Template error: No document ID provided");
    return null;
  }
  
  try {
    const doc = DocumentApp.openById(documentId);
    const tabs = doc.getTabs();
    const targetTab = findTabRecursive_(tabs, tabName);
    
    if (!targetTab) {
      Logger.log(`❌ Template tab not found: ${tabName}`);
      return null;
    }
    
    const bodyElement = targetTab.asDocumentTab().getBody();
    const numChildren = bodyElement.getNumChildren();
    
    let result = { subject: "", body: "", to: "", cc: "" };
    let mode = "none";
    
    for (let i = 0; i < numChildren; i++) {
      const child = bodyElement.getChild(i);
      const text = child.getText().trim();
      
      // Detect section tags
      if (text === "[SUBJECT]") { mode = "subject"; continue; }
      if (text === "[BODY]") { mode = "body"; continue; }
      if (text === "[TO]") { mode = "to"; continue; }
      if (text === "[CC]") { mode = "cc"; continue; }
      
      // Capture content
      if (mode === "subject" && text !== "") {
        result.subject = text;
        mode = "none";
      } else if (mode === "to" && text !== "") {
        result.to += text + ",";
      } else if (mode === "cc" && text !== "") {
        result.cc += text + ",";
      } else if (mode === "body") {
        result.body += convertElementToHtml_(child);
      }
    }
    
    // Process template content
    const processedSubject = applyDictionary_(result.subject);
    let processedBody = applyDictionary_(result.body);
    processedBody = processTables(processedBody);
    
    return {
      subject: processedSubject,
      body: processedBody,
      to: result.to,
      cc: result.cc
    };
    
  } catch (e) {
    Logger.log(`❌ Template fetch error: ${e.message}`);
    return null;
  }
}

/**
 * Recursively searches for a tab in nested folder structure
 * @private
 */
function findTabRecursive_(tabsList, targetName) {
  for (const tab of tabsList) {
    if (tab.getTitle() === targetName) return tab;
    const childTabs = tab.getChildTabs();
    if (childTabs.length > 0) {
      const found = findTabRecursive_(childTabs, targetName);
      if (found) return found;
    }
  }
  return null;
}

// ==========================================
// DICTIONARY TOKEN ENGINE
// ==========================================

/**
 * Processes all {{TOKEN}} tags in template content.
 * 
 * Supported tokens:
 * - {{DATE:Today}} - Current date
 * - {{DATE:Yesterday}} - Yesterday's date
 * - {{DATE:Tomorrow}} - Tomorrow's date
 * - {{DATE:Today+7}} - Date 7 days from now
 * - {{DATE:WeekStart}} - Sunday of current week
 * - {{DATE:MonthStart}} - First day of current month
 * - {{RANGE:MonthStart:Today}} - Date range
 * - {{TIME}} - Current time (MYT)
 * - {{TIME:BKK}} - Current time (Bangkok)
 * - {{MONTHNAME:0}} - Current month name (e.g., "January 2026")
 * - {{MONTHNAME:-1}} - Previous month name
 * - {{MONTHNAME:1}} - Next month name
 * - {{DATE_FORMAT:Today:dd/MM/yyyy}} - Custom date format
 * - {{GREETING}} - Time-based greeting
 * - {{ACTIVE_SPREADSHEET_LINK}} - URL of active spreadsheet
 * 
 * @param {string} text - Text containing tokens
 * @return {string} Text with tokens replaced
 */
function applyDictionary_(text) {
  if (!text) return "";
  
  // Heal HTML tags inside tokens: {{ <b>DATE</b> }} -> {{DATE}}
  const healedText = text.replace(/\{\{(.*?)\}\}/g, (match, inner) => {
    const cleanInner = inner
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return "{{" + cleanInner + "}}";
  });
  
  // Parse and replace tokens
  return healedText.replace(/\{\{(.*?)\}\}/g, function(match, content) {
    try {
      const parts = content.split(":").map(p => p.trim());
      const command = parts[0].toUpperCase();
      const param1 = parts[1] || "Today";
      const param2 = parts[2] || "Today";
      
      switch (command) {
        case "DATE":
          return formatDate_(parseDateToken_(param1));
          
        case "RANGE":
          return formatDate_(parseDateToken_(param1)) + " - " + formatDate_(parseDateToken_(param2));
          
        case "TIME":
          if (param1 === "BKK") return getRoundedTime_("Asia/Bangkok", "ICT");
          return getRoundedTime_("Asia/Kuala_Lumpur", "MYT");
          
        case "MONTHNAME":
          let d = new Date();
          if (!isNaN(Number(param1))) {
            d.setDate(1);
            d.setMonth(d.getMonth() + parseInt(param1, 10));
          } else {
            d = parseDateToken_(param1);
          }
          return Utilities.formatDate(d, Session.getScriptTimeZone(), "MMMM yyyy");
          
        case "DATE_FORMAT":
          const dateObj = parseDateToken_(param1);
          const formatStr = parts[2] || "dd-MMM-yyyy";
          return Utilities.formatDate(dateObj, Session.getScriptTimeZone(), formatStr.trim());
          
        case "ACTIVE_SPREADSHEET_LINK":
          return SpreadsheetApp.getActiveSpreadsheet().getUrl();
          
        case "GREETING":
          const h = new Date().getHours();
          if (h < 12) return "Good Morning";
          if (h < 17) return "Good Afternoon";
          return "Good Evening";
          
        default:
          return match; // Unknown token, leave as-is
      }
    } catch (e) {
      Logger.log(`❌ Dictionary error: ${content} - ${e.message}`);
      return "ERROR";
    }
  });
}

/**
 * Parses date tokens and returns a Date object
 * @private
 */
function parseDateToken_(token) {
  const now = new Date();
  const lowerToken = token.toLowerCase().trim();
  
  // Relative words
  if (lowerToken === "today") return now;
  if (lowerToken === "yesterday") { now.setDate(now.getDate() - 1); return now; }
  if (lowerToken === "tomorrow") { now.setDate(now.getDate() + 1); return now; }
  
  if (lowerToken === "monthstart") {
    now.setDate(1);
    return now;
  }
  
  if (lowerToken.includes("weekstart")) {
    const day = now.getDay();
    const diff = now.getDate() - day;
    now.setDate(diff);
    return now;
  }
  
  // Day arithmetic (Today+7, Today-3)
  if (lowerToken.startsWith("today")) {
    const operator = lowerToken.includes("+") ? 1 : (lowerToken.includes("-") ? -1 : 0);
    if (operator !== 0) {
      const numPart = lowerToken.replace(/[^0-9]/g, "");
      const days = parseInt(numPart, 10);
      if (!isNaN(days)) {
        now.setDate(now.getDate() + (days * operator));
        return now;
      }
    }
  }
  
  // Weekday logic (Monday, Next Friday, Last Sunday)
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  let targetDay = -1;
  for (let i = 0; i < days.length; i++) {
    if (lowerToken.includes(days[i])) { targetDay = i; break; }
  }
  
  if (targetDay !== -1) {
    const currentDay = now.getDay();
    let diff = targetDay - currentDay;
    
    if (lowerToken.includes("next")) {
      diff += 7;
    } else if (lowerToken.includes("last")) {
      diff -= 7;
    } else if (diff < 0) {
      diff += 7;
    }
    
    now.setDate(now.getDate() + diff);
    return now;
  }
  
  return now;
}

/**
 * Formats date as dd-MMM-yyyy
 * @private
 */
function formatDate_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "dd-MMM-yyyy");
}

/**
 * Gets rounded time in specified timezone
 * @private
 */
function getRoundedTime_(timeZone, label) {
  return Utilities.formatDate(new Date(), timeZone, "HH:mm") + (label ? " " + label : "");
}

// ==========================================
// HTML CONVERSION
// ==========================================

/**
 * Converts Google Doc element to HTML
 * @private
 */
function convertElementToHtml_(element) {
  if (element.getType() === DocumentApp.ElementType.PARAGRAPH) {
    const text = element.getText();
    if (text === "") return "<br>";
    return "<p style='margin:0;padding:0;'>" + getFormattedText_(element) + "</p>";
  }
  
  if (element.getType() === DocumentApp.ElementType.LIST_ITEM) {
    return "<li>" + getFormattedText_(element) + "</li>";
  }
  
  if (element.getType() === DocumentApp.ElementType.HORIZONTAL_RULE) {
    return "<hr style='border:0;border-top:1px solid #ccc;margin:15px 0;'>";
  }
  
  if (element.getType() === DocumentApp.ElementType.TABLE) {
    return processTableHTML_(element);
  }
  
  return "";
}

/**
 * Extracts formatted text with bold, italic, links, colors
 * @private
 */
function getFormattedText_(element) {
  const textObj = element.editAsText();
  const text = textObj.getText();
  if (!text) return "";
  
  const indices = textObj.getTextAttributeIndices();
  let html = "";
  
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    const end = (i + 1 < indices.length) ? indices[i + 1] : text.length;
    let chunk = text.substring(start, end);
    
    // Escape HTML
    chunk = chunk
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    
    // Apply formatting
    if (textObj.isBold(start)) chunk = "<b>" + chunk + "</b>";
    if (textObj.isItalic(start)) chunk = "<i>" + chunk + "</i>";
    if (textObj.isUnderline(start)) chunk = "<u>" + chunk + "</u>";
    
    // Color
    const color = textObj.getForegroundColor(start);
    if (color && color !== "#000000") {
      chunk = `<span style="color:${color}">${chunk}</span>`;
    }
    
    // Link
    const url = textObj.getLinkUrl(start);
    if (url) {
      chunk = `<a href="${url}">${chunk}</a>`;
    }
    
    html += chunk;
  }
  return html;
}

/**
 * Converts Google Doc table to HTML
 * @private
 */
function processTableHTML_(table) {
  let html = '<table style="border-collapse: collapse; width: 100%; border: 1px solid #ccc;">';
  const numRows = table.getNumRows();
  
  for (let r = 0; r < numRows; r++) {
    const row = table.getRow(r);
    html += "<tr>";
    const numCells = row.getNumCells();
    
    for (let c = 0; c < numCells; c++) {
      const cell = row.getCell(c);
      let cellHtml = "";
      
      for (let k = 0; k < cell.getNumChildren(); k++) {
        cellHtml += convertElementToHtml_(cell.getChild(k));
      }
      
      html += `<td style="border: 1px solid #ccc; padding: 8px;">${cellHtml}</td>`;
    }
    html += "</tr>";
  }
  
  html += "</table>";
  return html;
}

// ==========================================
// TABLE RENDERING FROM SHEETS
// ==========================================

/**
 * Scans HTML for [Table] tags and replaces with actual Sheet data.
 * 
 * Usage in template:
 * [Table] Sheet: https://docs.google.com/spreadsheets/d/ABC123, range: 'Sheet1'!A1:D10
 * 
 * @param {string} bodyHtml - HTML body content
 * @return {string} HTML with tables inserted
 */
function processTables(bodyHtml) {
  const regex = /\[Table\]\s*Sheet:\s*(.*?),\s*range:\s*(.*?)(?=<\/p>)/gi;
  
  return bodyHtml.replace(regex, function(match, urlPart, rawRange) {
    try {
      const ssId = getIdFromUrl_(urlPart);
      if (!ssId) {
        Logger.log("❌ Table error: Invalid Sheet ID in: " + urlPart);
        return "<p style='color:red; background:#ffe6e6; padding:5px;'>[Table Error: Invalid Sheet Link]</p>";
      }
      
      // Clean range string
      let cleanRange = rawRange.replace(/<[^>]+>/g, "")
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/\u00A0/g, " ")
        .replace(/&nbsp;/g, " ")
        .trim();
      
      // Remove trailing punctuation
      if (/[.,;]$/.test(cleanRange)) {
        cleanRange = cleanRange.slice(0, -1).trim();
      }
      
      // Auto-fix missing quotes
      cleanRange = fixMissingQuotes_(cleanRange);
      
      Logger.log(`[Table] Fetching: "${cleanRange}" from ID: ${ssId}`);
      return getHtmlTableFromSheet_(ssId, cleanRange);
      
    } catch (e) {
      Logger.log(`❌ Table error: ${e.message}`);
      return `<p style="color:red; background:#ffe6e6; padding:5px;">(Table Error: ${e.message})</p>`;
    }
  });
}

/**
 * Extracts Sheet ID from URL or smart chip
 * @private
 */
function getIdFromUrl_(url) {
  const match = url.match(/[-\w]{25,}/);
  return match ? match[0] : null;
}

/**
 * Adds quotes to sheet names if missing
 * @private
 */
function fixMissingQuotes_(rangeStr) {
  if (rangeStr.startsWith("'")) return rangeStr;
  
  const lastBang = rangeStr.lastIndexOf("!");
  if (lastBang === -1) return rangeStr;
  
  const sheetName = rangeStr.substring(0, lastBang);
  const cellRange = rangeStr.substring(lastBang + 1);
  
  return `'${sheetName}'!${cellRange}`;
}

/**
 * Fetches Sheet data and converts to formatted HTML table
 * @private
 */
function getHtmlTableFromSheet_(ssId, rangeA1) {
  const ss = SpreadsheetApp.openById(ssId);
  const range = ss.getRange(rangeA1);
  const sheet = range.getSheet();
  
  // Fetch data
  let values = range.getDisplayValues();
  
  // Trim empty rows from bottom
  let lastRowIndex = values.length - 1;
  while (lastRowIndex >= 0) {
    const isRowEmpty = values[lastRowIndex].every(cell => cell.trim() === "");
    if (!isRowEmpty) break;
    lastRowIndex--;
  }
  
  if (lastRowIndex < 0) return "<p><i>(Table contains no data)</i></p>";
  
  values = values.slice(0, lastRowIndex + 1);
  
  // Fetch formatting
  const numRows = values.length;
  const numCols = values[0].length;
  
  const backgrounds = range.getBackgrounds().slice(0, numRows);
  const fontWeights = range.getFontWeights().slice(0, numRows);
  const fontColors = range.getFontColors().slice(0, numRows);
  const fontSizes = range.getFontSizes().slice(0, numRows);
  const horizontalAligns = range.getHorizontalAlignments().slice(0, numRows);
  const verticalAligns = range.getVerticalAlignments().slice(0, numRows);
  const fontFamilies = range.getFontFamilies().slice(0, numRows);
  
  // Handle merged ranges
  const mergedRanges = range.getMergedRanges();
  let cellMeta = Array.from({ length: numRows }, () =>
    Array.from({ length: numCols }, () => ({ rowSpan: 1, colSpan: 1, skip: false }))
  );
  
  const startRowIndex = range.getRow();
  const startColIndex = range.getColumn();
  
  mergedRanges.forEach(merge => {
    const mergeStartRow = merge.getRow() - startRowIndex;
    const mergeStartCol = merge.getColumn() - startColIndex;
    const mergeNumRows = merge.getNumRows();
    const mergeNumCols = merge.getNumColumns();
    
    for (let r = 0; r < mergeNumRows; r++) {
      for (let c = 0; c < mergeNumCols; c++) {
        const targetRow = mergeStartRow + r;
        const targetCol = mergeStartCol + c;
        if (targetRow >= 0 && targetRow < numRows && targetCol >= 0 && targetCol < numCols) {
          if (r === 0 && c === 0) {
            cellMeta[targetRow][targetCol].rowSpan = mergeNumRows;
            cellMeta[targetRow][targetCol].colSpan = mergeNumCols;
          } else {
            cellMeta[targetRow][targetCol].skip = true;
          }
        }
      }
    }
  });
  
  // Build HTML
  let html = '<table style="border-collapse: collapse; border: 1px solid #ccc; font-family: Arial, sans-serif; font-size: 10pt;">';
  
  for (let i = 0; i < numRows; i++) {
    html += '<tr>';
    for (let j = 0; j < numCols; j++) {
      if (cellMeta[i][j].skip) continue;
      
      const cellText = values[i][j];
      const rowSpanAttr = cellMeta[i][j].rowSpan > 1 ? ` rowspan="${cellMeta[i][j].rowSpan}"` : "";
      const colSpanAttr = cellMeta[i][j].colSpan > 1 ? ` colspan="${cellMeta[i][j].colSpan}"` : "";
      
      const styles = [
        `border: 1px solid #ccc`,
        `padding: 5px 8px`,
        `background-color: ${backgrounds[i][j]}`,
        `color: ${fontColors[i][j]}`,
        `font-weight: ${fontWeights[i][j]}`,
        `font-size: ${fontSizes[i][j]}pt`,
        `font-family: ${fontFamilies[i][j] || 'Arial'}, sans-serif`,
        `text-align: ${horizontalAligns[i][j]}`,
        `vertical-align: ${verticalAligns[i][j]}`,
        `white-space: pre-wrap`
      ].join(";");
      
      html += `<td${rowSpanAttr}${colSpanAttr} style="${styles}">${cellText}</td>`;
    }
    html += '</tr>';
  }
  
  html += '</table>';
  return html;
}
