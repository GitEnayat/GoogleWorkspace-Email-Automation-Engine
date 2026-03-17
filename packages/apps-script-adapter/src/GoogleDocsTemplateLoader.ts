/**
 * Google Apps Script Template Loader
 * Implements TemplateLoader using DocumentApp with HTML conversion
 */

import { TemplateLoader, ParsedTemplate, TableRange } from '@universal-email/core';

export class GoogleDocsTemplateLoader implements TemplateLoader {
  async loadTemplate(templateName: string, sourceId: string): Promise<ParsedTemplate> {
    const doc = DocumentApp.openById(sourceId);
    const body = doc.getBody();
    const numChildren = body.getNumChildren();

    let isInsideTemplate = false;
    let templateHtml = '';
    let subject = '';
    
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
      if (isInsideTemplate && text.startsWith('{{') && text.endsWith('}}') && text !== `{{${templateName}}}`) {
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
        if (!subject && templateHtml === '' && text.length > 0 && !text.startsWith('{{')) {
           subject = text;
           continue; // Don't add to body
        }

        templateHtml += this.convertElementToHtml(child);
      }
    }

    if (!templateHtml && !subject) {
      throw new Error(`Template '${templateName}' not found or empty in document`);
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
      tableRanges
    };
  }

  async getRawContent(templateName: string, sourceId: string): Promise<string> {
    // Re-use loadTemplate but just return body
    const template = await this.loadTemplate(templateName, sourceId);
    return template.body;
  }

  private convertElementToHtml(element: GoogleAppsScript.Document.Element): string {
    const type = element.getType();

    if (type === DocumentApp.ElementType.PARAGRAPH) {
      const paragraph = element.asParagraph();
      const text = paragraph.getText();
      
      // Skip empty paragraphs if needed, or return <br>
      if (text.trim() === '') return '<br>';
      
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

    return '';
  }

  private getFormattedText(element: GoogleAppsScript.Document.Text | GoogleAppsScript.Document.Paragraph | GoogleAppsScript.Document.ListItem): string {
    // If it's a container (Paragraph/ListItem), get the Text element
    let textObj: GoogleAppsScript.Document.Text;
    if (element.getType() === DocumentApp.ElementType.TEXT) {
      textObj = element as GoogleAppsScript.Document.Text;
    } else {
      textObj = (element as any).editAsText(); 
    }

    const text = textObj.getText();
    if (!text) return '';

    const indices = textObj.getTextAttributeIndices();
    let html = '';

    for (let i = 0; i < indices.length; i++) {
      const start = indices[i];
      const end = (i + 1 < indices.length) ? indices[i + 1] : text.length;
      let chunk = text.substring(start, end);

      // Escape HTML special chars
      chunk = chunk
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      if (textObj.isBold(start)) chunk = `<b>${chunk}</b>`;
      if (textObj.isItalic(start)) chunk = `<i>${chunk}</i>`;
      if (textObj.isUnderline(start)) chunk = `<u>${chunk}</u>`;
      if (textObj.isStrikethrough(start)) chunk = `<s>${chunk}</s>`;

      // Color
      const color = textObj.getForegroundColor(start);
      if (color && color !== '#000000') {
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
    let html = '<table style="border-collapse: collapse; width: 100%; border: 1px solid #ccc;">';
    const numRows = table.getNumRows();

    for (let r = 0; r < numRows; r++) {
      const row = table.getRow(r);
      html += '<tr>';
      const numCells = row.getNumCells();

      for (let c = 0; c < numCells; c++) {
        const cell = row.getCell(c);
        let cellHtml = '';

        // Process cell contents (paragraphs usually)
        for (let k = 0; k < cell.getNumChildren(); k++) {
          cellHtml += this.convertElementToHtml(cell.getChild(k));
        }

        html += `<td style="border: 1px solid #ccc; padding: 8px;">${cellHtml}</td>`;
      }
      html += '</tr>';
    }

    html += '</table>';
    return html;
  }

  private extractTags(content: string): string[] {
    const tagRegex = /{{([^}:]+)(?::[^}]+)?}}/g;
    const tags = new Set<string>();
    let match;

    while ((match = tagRegex.exec(content)) !== null) {
      const tag = match[1].trim();
      if (!tag.startsWith('Subject:') && tag !== 'GREETING') {
        tags.add(tag);
      }
    }

    return Array.from(tags);
  }

  private extractTableRanges(content: string): TableRange[] {
    const tableRegex = /\[Table\]\s*Sheet:\s*([^,]+),\s*range:\s*'([^']+)'!([^\n<]+)/g; // Adjusted regex to stop at HTML tags
    const ranges: TableRange[] = [];
    let match;

    while ((match = tableRegex.exec(content)) !== null) {
      // Clean up match from potential HTML tags if they got included
      const range = match[3].split('<')[0].trim();
      
      ranges.push({
        source: match[1].trim(),
        range: `'${match[2].trim()}'!${range}`,
        preserveFormatting: true
      });
    }

    return ranges;
  }
}
