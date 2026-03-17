/**
 * Google Apps Script Providers
 * All platform implementations merged into a single file
 */

import {
  Logger,
  DataStore,
  LinkRepository,
  ManagedLink,
  TableRenderer,
  TemplateLoader,
  ParsedTemplate,
  TableRange,
  EmailProvider,
} from "@universal-email/core";

/**
 * Google Apps Script Logger
 * Logs to the Apps Script execution log (View > Logs).
 */
export class GoogleAppsLogger implements Logger {
  info(component: string, message: string): void {
    Logger.log(`[INFO] ${component}: ${message}`);
  }
  warn(component: string, message: string): void {
    Logger.log(`[WARN] ${component}: ${message}`);
  }
  error(component: string, message: string): void {
    Logger.log(`[ERROR] ${component}: ${message}`);
  }
  debug(component: string, message: string): void {
    Logger.log(`[DEBUG] ${component}: ${message}`);
  }
}

/**
 * Google Apps Script Data Store
 * Implements DataStore using SpreadsheetApp
 */
export class GoogleSheetsDataStore implements DataStore {
  async getData(sheetId: string, range: string): Promise<any[][]> {
    const spreadsheet = SpreadsheetApp.openById(sheetId);

    // Parse range (e.g., "'Q1_Results'!A1:E10" or "A1:E10")
    const { sheetName, range: cellRange } = this.parseRange(range);

    const sheet = sheetName
      ? spreadsheet.getSheetByName(sheetName)
      : spreadsheet.getSheets()[0];

    if (!sheet) {
      throw new Error(`Sheet '${sheetName}' not found`);
    }

    const dataRange = sheet.getRange(cellRange || "A1:Z1000");
    return dataRange.getValues();
  }

  async getTabData(
    sheetId: string,
    tabName: string,
  ): Promise<Record<string, any>[]> {
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheet = spreadsheet.getSheetByName(tabName);

    if (!sheet) {
      throw new Error(`Tab '${tabName}' not found`);
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0] as string[];
    const rows = data.slice(1);

    return rows.map((row) => {
      const record: Record<string, any> = {};
      headers.forEach((header, index) => {
        record[header] = row[index];
      });
      return record;
    });
  }

  async appendRow(sheetId: string, tabName: string, row: any[]): Promise<void> {
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheet = spreadsheet.getSheetByName(tabName);

    if (!sheet) {
      throw new Error(`Tab '${tabName}' not found`);
    }

    sheet.appendRow(row);
  }

  private parseRange(range: string): { sheetName?: string; range: string } {
    // Parse "'Sheet Name'!A1:B2" or "A1:B2"
    const match = range.match(/^'([^']+)'!(.+)$/);
    if (match) {
      return { sheetName: match[1], range: match[2] };
    }
    return { range };
  }
}

/**
 * Google Apps Script Link Repository
 * Implements LinkRepository using SpreadsheetApp
 */
export class GoogleAppsLinkRepository implements LinkRepository {
  private linkCache: Map<string, ManagedLink> = new Map();
  private loaded: boolean = false;

  async loadLinks(sourceId: string, tabName: string): Promise<ManagedLink[]> {
    const spreadsheet = SpreadsheetApp.openById(sourceId);
    const sheet = spreadsheet.getSheetByName(tabName);

    if (!sheet) {
      throw new Error(`Tab '${tabName}' not found`);
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0] as string[];
    const rows = data.slice(1);

    const linkKeyIndex = headers.findIndex(
      (h) => h.toLowerCase().includes("link_key") || h.toLowerCase() === "key",
    );
    const urlIndex = headers.findIndex(
      (h) =>
        h.toLowerCase().includes("target_url") ||
        h.toLowerCase().includes("url"),
    );
    const labelIndex = headers.findIndex(
      (h) =>
        h.toLowerCase().includes("label") || h.toLowerCase().includes("text"),
    );

    if (linkKeyIndex === -1 || urlIndex === -1) {
      throw new Error(
        "Link repository must have Link_Key and Target_URL columns",
      );
    }

    this.linkCache.clear();
    const links = rows
      .filter((row) => row[linkKeyIndex] && row[urlIndex])
      .map((row) => {
        const link: ManagedLink = {
          key: row[linkKeyIndex] as string,
          url: row[urlIndex] as string,
          label: labelIndex !== -1 ? (row[labelIndex] as string) : undefined,
        };
        this.linkCache.set(link.key, link);
        return link;
      });

    this.loaded = true;
    return links;
  }

  async getLink(key: string): Promise<ManagedLink | null> {
    if (!this.loaded) {
      throw new Error(
        "Links have not been loaded yet. Call loadLinks() first.",
      );
    }
    return this.linkCache.get(key) ?? null;
  }
}

/**
 * Google Apps Script Table Renderer
 * Implements TableRenderer using SpreadsheetApp to generate HTML tables
 */
export class GoogleSheetsTableRenderer implements TableRenderer {
  private extractId(input: string): string {
    // If it's a URL, extract the ID between /d/ and /edit
    const match = input.match(/[-\w]{25,}/);
    return match ? match[0] : input.trim();
  }

  async renderTable(sheetIdInput: string, rangeA1: string): Promise<string> {
    const sheetId = this.extractId(sheetIdInput);
    const ss = SpreadsheetApp.openById(sheetId);

    // Parse range to handle sheet name vs range
    // rangeA1 might be "'Sheet1'!A1:B2" or just "A1:B2"
    // SpreadsheetApp.getRange(a1Notation) works on active sheet or needs sheet specified?
    // Actually ss.getRange(a1Notation) works if sheet name is included.

    let range: GoogleAppsScript.Spreadsheet.Range;
    try {
      range = ss.getRange(rangeA1);
    } catch (e) {
      // Fallback: try to parse sheet name manually if getRange fails (rare)
      return `<p style="color:red">[Table Error: Invalid Range '${rangeA1}']</p>`;
    }

    const sheet = range.getSheet();

    // 1. FETCH DATA & TRIM
    let values = range.getDisplayValues();

    // Logic: Scan from bottom up. Stop at first non-empty row.
    let lastRowIndex = values.length - 1;
    while (lastRowIndex >= 0) {
      const isRowEmpty = values[lastRowIndex].every(
        (cell) => cell.trim() === "",
      );
      if (!isRowEmpty) break;
      lastRowIndex--;
    }

    if (lastRowIndex < 0) return "<p><i>(Table contains no data)</i></p>";

    const newRowCount = lastRowIndex + 1;
    values = values.slice(0, newRowCount);

    // 2. FETCH FORMATTING (Sliced to newRowCount)
    const backgrounds = range.getBackgrounds().slice(0, newRowCount);
    const fontWeights = range.getFontWeights().slice(0, newRowCount);
    const fontColors = range.getFontColors().slice(0, newRowCount);
    const fontSizes = range.getFontSizes().slice(0, newRowCount);
    const horizontalAligns = range
      .getHorizontalAlignments()
      .slice(0, newRowCount);
    const verticalAligns = range.getVerticalAlignments().slice(0, newRowCount);
    const fontFamilies = range.getFontFamilies().slice(0, newRowCount);

    // 3. FETCH COLUMN WIDTHS
    const startCol = range.getColumn();
    const numCols = values[0].length;
    const colWidths: number[] = [];
    let totalTableWidth = 0;

    for (let c = 0; c < numCols; c++) {
      const colIndex = startCol + c;
      let w = sheet.getColumnWidth(colIndex);

      // Check for hidden columns (simulated logic as isColumnHiddenByUser might not be in type defs yet)
      // Assuming standard API availability
      if (!w || w === 0) {
        w = 100;
      }
      colWidths.push(w);
      totalTableWidth += w;
    }

    // 4. HANDLE MERGED RANGES
    const mergedRanges = range.getMergedRanges();
    const numRows = values.length;

    // Metadata matrix to track spans
    let cellMeta = Array.from({ length: numRows }, () =>
      Array.from({ length: numCols }, () => ({
        rowSpan: 1,
        colSpan: 1,
        skip: false,
      })),
    );

    const startRowIndex = range.getRow();
    const startColIndex = range.getColumn();

    mergedRanges.forEach((merge) => {
      const mergeStartRow = merge.getRow() - startRowIndex;
      const mergeStartCol = merge.getColumn() - startColIndex;
      const mergeNumRows = merge.getNumRows();
      const mergeNumColumns = merge.getNumColumns();

      for (let r = 0; r < mergeNumRows; r++) {
        for (let c = 0; c < mergeNumColumns; c++) {
          const targetRow = mergeStartRow + r;
          const targetCol = mergeStartCol + c;

          // Ensure we are inside the trimmed bounds
          if (
            targetRow >= 0 &&
            targetRow < numRows &&
            targetCol >= 0 &&
            targetCol < numCols
          ) {
            if (r === 0 && c === 0) {
              cellMeta[targetRow][targetCol].rowSpan = mergeNumRows;
              cellMeta[targetRow][targetCol].colSpan = mergeNumColumns;
            } else {
              cellMeta[targetRow][targetCol].skip = true;
            }
          }
        }
      }
    });

    // 5. BUILD HTML
    let html = `<table style="table-layout: fixed; width: ${totalTableWidth}px; border-collapse: collapse; border: 1px solid #cccccc; font-family: Arial, sans-serif; font-size: 10pt;">`;

    // COLGROUP
    html += "<colgroup>";
    colWidths.forEach((w) => {
      html += `<col style="width: ${w}px;">`;
    });
    html += "</colgroup>";

    for (let i = 0; i < numRows; i++) {
      const rHeight = sheet.getRowHeight(startRowIndex + i);
      html += `<tr style="height: ${rHeight}px;">`;

      for (let j = 0; j < numCols; j++) {
        if (cellMeta[i][j].skip) continue;

        const cellText = values[i][j];

        // Calculate width for merged cells
        let cellWidth = colWidths[j];
        if (cellMeta[i][j].colSpan > 1) {
          cellWidth = 0;
          for (let k = 0; k < cellMeta[i][j].colSpan; k++) {
            cellWidth += colWidths[j + k];
          }
        }

        // Attributes
        const rowSpanAttr =
          cellMeta[i][j].rowSpan > 1
            ? ` rowspan="${cellMeta[i][j].rowSpan}"`
            : "";
        const colSpanAttr =
          cellMeta[i][j].colSpan > 1
            ? ` colspan="${cellMeta[i][j].colSpan}"`
            : "";

        // Styles
        const styles = [
          `border: 1px solid #cccccc`,
          `padding: 4px 6px`,
          `overflow: hidden`,
          `width: ${cellWidth}px`,
          `min-width: ${cellWidth}px`,
          `max-width: ${cellWidth}px`,
          `background-color: ${backgrounds[i][j]}`,
          `color: ${fontColors[i][j]}`,
          `font-weight: ${fontWeights[i][j]}`,
          `font-size: ${fontSizes[i][j]}pt`,
          `font-family: ${fontFamilies[i][j] || "Arial"}, sans-serif`,
          `text-align: ${horizontalAligns[i][j]}`,
          `vertical-align: ${verticalAligns[i][j]}`,
          `white-space: pre-wrap`,
        ].join(";");

        html += `<td${rowSpanAttr}${colSpanAttr} style="${styles}">${cellText}</td>`;
      }

      html += "</tr>";
    }

    html += "</table>";
    return html;
  }
}

/**
 * Google Apps Script Template Loader
 * Implements TemplateLoader using DocumentApp with HTML conversion
 */
export class GoogleDocsTemplateLoader implements TemplateLoader {
  async loadTemplate(
    templateName: string,
    sourceId: string,
  ): Promise<ParsedTemplate> {
    const doc = DocumentApp.openById(sourceId);
    const body = doc.getBody();
    const numChildren = body.getNumChildren();

    let isInsideTemplate = false;
    let templateHtml = "";
    let subject = "";

    // Iterate through document elements to find the template section
    for (let i = 0; i < numChildren; i++) {
      const child = body.getChild(i);
      const text = child.asParagraph().getText().trim(); // Basic text check for markers

      // Check for start marker: {{TemplateName}}
      if (text === `{{${templateName}}}`) {
        isInsideTemplate = true;
        continue;
      }

      // Check for end of template (start of next one)
      if (
        isInsideTemplate &&
        text.startsWith("{{") &&
        text.endsWith("}}") &&
        text !== `{{${templateName}}}`
      ) {
        break;
      }

      if (isInsideTemplate) {
        // Check for explicit Subject tag
        const subjectMatch = text.match(/^{{Subject:\s*(.+)}}$/);
        if (subjectMatch) {
          subject = subjectMatch[1].trim();
          continue; // Don't add to body
        }

        // Check if first line and no subject yet (and not a tag)
        if (
          !subject &&
          templateHtml === "" &&
          text.length > 0 &&
          !text.startsWith("{{")
        ) {
          subject = text;
          continue; // Don't add to body
        }

        templateHtml += this.convertElementToHtml(child);
      }
    }

    if (!templateHtml && !subject) {
      throw new Error(
        `Template '${templateName}' not found or empty in document`,
      );
    }

    // Extract tags from the generated HTML
    const tags = this.extractTags(templateHtml);

    // Extract table ranges
    const tableRanges = this.extractTableRanges(templateHtml);

    // If subject wasn't found in body, default it
    if (!subject) subject = `${templateName} (No Subject)`;

    return {
      name: templateName,
      subject,
      body: templateHtml,
      tags,
      tableRanges,
    };
  }

  async getRawContent(templateName: string, sourceId: string): Promise<string> {
    // Re-use loadTemplate but just return body
    const template = await this.loadTemplate(templateName, sourceId);
    return template.body;
  }

  private convertElementToHtml(
    element: GoogleAppsScript.Document.Element,
  ): string {
    const type = element.getType();

    if (type === DocumentApp.ElementType.PARAGRAPH) {
      const paragraph = element.asParagraph();
      const text = paragraph.getText();

      // Skip empty paragraphs if needed, or return <br>
      if (text.trim() === "") return "<br>";

      return `<p style="margin:0;padding:0;min-height:1em;">${this.getFormattedText(paragraph)}</p>`;
    }

    if (type === DocumentApp.ElementType.LIST_ITEM) {
      const listItem = element.asListItem();
      return `<li>${this.getFormattedText(listItem)}</li>`;
    }

    if (type === DocumentApp.ElementType.TABLE) {
      return this.processTableHTML(element.asTable());
    }

    if (type === DocumentApp.ElementType.HORIZONTAL_RULE) {
      return '<hr style="border:0;border-top:1px solid #ccc;margin:15px 0;">';
    }

    return "";
  }

  private getFormattedText(
    element:
      | GoogleAppsScript.Document.Text
      | GoogleAppsScript.Document.Paragraph
      | GoogleAppsScript.Document.ListItem,
  ): string {
    // If it's a container (Paragraph/ListItem), get the Text element
    let textObj: GoogleAppsScript.Document.Text;
    if (element.getType() === DocumentApp.ElementType.TEXT) {
      textObj = element as GoogleAppsScript.Document.Text;
    } else {
      textObj = (element as any).editAsText();
    }

    const text = textObj.getText();
    if (!text) return "";

    const indices = textObj.getTextAttributeIndices();
    let html = "";

    for (let i = 0; i < indices.length; i++) {
      const start = indices[i];
      const end = i + 1 < indices.length ? indices[i + 1] : text.length;
      let chunk = text.substring(start, end);

      // Escape HTML special chars
      chunk = chunk
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      if (textObj.isBold(start)) chunk = `<b>${chunk}</b>`;
      if (textObj.isItalic(start)) chunk = `<i>${chunk}</i>`;
      if (textObj.isUnderline(start)) chunk = `<u>${chunk}</u>`;
      if (textObj.isStrikethrough(start)) chunk = `<s>${chunk}</s>`;

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

  private processTableHTML(table: GoogleAppsScript.Document.Table): string {
    let html =
      '<table style="border-collapse: collapse; width: 100%; border: 1px solid #ccc;">';
    const numRows = table.getNumRows();

    for (let r = 0; r < numRows; r++) {
      const row = table.getRow(r);
      html += "<tr>";
      const numCells = row.getNumCells();

      for (let c = 0; c < numCells; c++) {
        const cell = row.getCell(c);
        let cellHtml = "";

        // Process cell contents (paragraphs usually)
        for (let k = 0; k < cell.getNumChildren(); k++) {
          cellHtml += this.convertElementToHtml(cell.getChild(k));
        }

        html += `<td style="border: 1px solid #ccc; padding: 8px;">${cellHtml}</td>`;
      }
      html += "</tr>";
    }

    html += "</table>";
    return html;
  }

  private extractTags(content: string): string[] {
    const tagRegex = /{{([^}:]+)(?::[^}]+)?}}/g;
    const tags = new Set<string>();
    let match;

    while ((match = tagRegex.exec(content)) !== null) {
      const tag = match[1].trim();
      if (!tag.startsWith("Subject:") && tag !== "GREETING") {
        tags.add(tag);
      }
    }

    return Array.from(tags);
  }

  private extractTableRanges(content: string): TableRange[] {
    const tableRegex =
      /\[Table\]\s*Sheet:\s*([^,]+),\s*range:\s*'([^']+)'!([^\n<]+)/g; // Adjusted regex to stop at HTML tags
    const ranges: TableRange[] = [];
    let match;

    while ((match = tableRegex.exec(content)) !== null) {
      // Clean up match from potential HTML tags if they got included
      const range = match[3].split("<")[0].trim();

      ranges.push({
        source: match[1].trim(),
        range: `'${match[2].trim()}'!${range}`,
        preserveFormatting: true,
      });
    }

    return ranges;
  }
}

/**
 * Google Apps Script Email Provider
 * Implements EmailProvider using GmailApp
 */
export class GoogleAppsEmailProvider implements EmailProvider {
  createDraft(
    subject: string,
    body: string,
    to: string[],
    cc?: string[],
    bcc?: string[],
    htmlBody?: string,
  ): Promise<string> {
    const draft = GmailApp.createDraft(to.join(","), subject, body, {
      cc: cc?.join(","),
      bcc: bcc?.join(","),
      htmlBody: htmlBody,
    });
    return Promise.resolve(draft.getId());
  }

  updateDraft(
    draftId: string,
    subject: string,
    body: string,
    htmlBody?: string,
  ): Promise<void> {
    const draft = GmailApp.getDraft(draftId);
    draft.update(draft.getMessage().getTo(), subject, body, {
      htmlBody: htmlBody,
    });
    return Promise.resolve();
  }

  async findDraftBySubject(subject: string): Promise<string | null> {
    const drafts = GmailApp.getDrafts();
    for (const draft of drafts) {
      const message = draft.getMessage();
      const draftSubject = message.getSubject();
      if (draftSubject && draftSubject.includes(subject)) {
        return draft.getId();
      }
    }
    return null;
  }

  async findThreadBySubject(subject: string): Promise<string | null> {
    const threads = GmailApp.search(`subject:"${subject}"`, 0, 5);
    for (const thread of threads) {
      const originalSubject = thread.getFirstMessageSubject();
      // Skip OOO and auto-replies
      if (
        !originalSubject.match(
          /^(Automatic reply|OOO|Out of Office|Absence Notice):/i,
        )
      ) {
        return thread.getId();
      }
    }
    return null;
  }

  async createReplyDraft(
    threadId: string,
    body: string,
    cc?: string[],
    bcc?: string[],
    htmlBody?: string,
  ): Promise<string> {
    const thread = GmailApp.getThreadById(threadId);
    if (!thread) {
      throw new Error(`Thread with ID ${threadId} not found`);
    }

    const draft = thread.createDraftReplyAll(body, {
      htmlBody: htmlBody,
      cc: cc?.join(","),
      bcc: bcc?.join(","),
    });

    return draft.getId();
  }

  async sendEmail(
    draftId?: string,
    to?: string[],
    subject?: string,
    body?: string,
  ): Promise<void> {
    if (draftId) {
      const draft = GmailApp.getDraft(draftId);
      draft.send();
    } else if (to && subject && body) {
      GmailApp.sendEmail(to.join(","), subject, body, {
        htmlBody: body,
      });
    }
    return Promise.resolve();
  }

  getCurrentUserEmail(): string {
    return Session.getActiveUser().getEmail();
  }
}
