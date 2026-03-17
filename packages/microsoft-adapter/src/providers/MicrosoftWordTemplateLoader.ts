import { TemplateLoader, ParsedTemplate, TableRange } from '@universal-email/core';
import * as mammoth from 'mammoth';
import * as fs from 'fs';
import * as path from 'path';

export class MicrosoftWordTemplateLoader implements TemplateLoader {
  private baseDir: string;

  constructor(baseDir: string = '.') {
    this.baseDir = baseDir;
  }

  async loadTemplate(templateName: string, sourceId: string): Promise<ParsedTemplate> {
    const filePath = path.join(this.baseDir, sourceId || `${templateName}.docx`);
    const { value: html } = await mammoth.convertToHtml({ path: filePath });

    // Mammoth provides very clean HTML.
    // We'll extract the subject if it's there (first paragraph if not tagged)
    const subjectMatch = html.match(/{{Subject:\s*([^}]+)}}/);
    const subject = subjectMatch ? subjectMatch[1].trim() : `${templateName} (Generated)`;

    const tags = this.extractTags(html);
    const tableRanges = this.extractTableRanges(html);

    return {
      name: templateName,
      subject,
      body: html,
      tags,
      tableRanges
    };
  }

  async getRawContent(templateName: string, sourceId: string): Promise<string> {
    const filePath = path.join(this.baseDir, sourceId || `${templateName}.docx`);
    const { value: html } = await mammoth.convertToHtml({ path: filePath });
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
    const tableRegex = /\[Table\]\s*Sheet:\s*([^,]+),\s*range:\s*([^<]+)/g;
    const ranges: TableRange[] = [];
    let match;

    while ((match = tableRegex.exec(content)) !== null) {
      ranges.push({
        source: match[1].trim(),
        range: match[2].trim(),
        preserveFormatting: true
      });
    }

    return ranges;
  }
}
