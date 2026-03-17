/**
 * Google Apps Script Template Loader
 * Implements TemplateLoader using DocumentApp
 */

import { TemplateLoader, ParsedTemplate, TableRange } from '@universal-email/core';

export class GoogleDocsTemplateLoader implements TemplateLoader {
  async loadTemplate(templateName: string, sourceId: string): Promise<ParsedTemplate> {
    const doc = DocumentApp.openById(sourceId);
    const body = doc.getBody();
    
    // Find the template section (assumes templates are separated by headers)
    const templateContent = this.findTemplateSection(body, templateName);
    
    if (!templateContent) {
      throw new Error(`Template '${templateName}' not found in document`);
    }

    // Parse subject (first line or {{Subject}} tag)
    const subject = this.extractSubject(templateContent);
    
    // Parse body (remaining content)
    const bodyContent = this.extractBody(templateContent);
    
    // Extract tags
    const tags = this.extractTags(templateContent);
    
    // Extract table ranges
    const tableRanges = this.extractTableRanges(templateContent);

    return {
      name: templateName,
      subject,
      body: bodyContent,
      tags,
      tableRanges
    };
  }

  async getRawContent(templateName: string, sourceId: string): Promise<string> {
    const doc = DocumentApp.openById(sourceId);
    const body = doc.getBody();
    const templateContent = this.findTemplateSection(body, templateName);
    return templateContent || '';
  }

  private findTemplateSection(body: GoogleAppsScript.Document.Body, templateName: string): string | null {
    // Search for template by header or bookmark
    // This is a simplified version - can be enhanced with bookmarks
    
    const text = body.getText();
    const templateMarker = `{{${templateName}}}`;
    const startIndex = text.indexOf(templateMarker);
    
    if (startIndex === -1) {
      return null;
    }

    // Find next template marker or end
    const nextMarker = text.indexOf('{{', startIndex + 1);
    const endIndex = nextMarker === -1 ? text.length : nextMarker;

    return text.substring(startIndex + templateMarker.length, endIndex);
  }

  private extractSubject(content: string): string {
    // Look for {{Subject: ...}} or first line
    const subjectMatch = content.match(/{{Subject:\s*([^}]+)}}/);
    if (subjectMatch) {
      return subjectMatch[1].trim();
    }
    
    // Default: use first line as subject
    const lines = content.split('\n');
    return lines[0]?.trim() || 'No Subject';
  }

  private extractBody(content: string): string {
    // Remove subject line if present
    return content.replace(/{{Subject:\s*[^}]+}}/, '').trim();
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
    const tableRegex = /\[Table\]\s*Sheet:\s*([^,]+),\s*range:\s*'([^']+)'!([^\n]+)/g;
    const ranges: TableRange[] = [];
    let match;

    while ((match = tableRegex.exec(content)) !== null) {
      ranges.push({
        source: match[1].trim(),
        range: `'${match[2].trim()}'!${match[3].trim()}`,
        preserveFormatting: true
      });
    }

    return ranges;
  }
}
