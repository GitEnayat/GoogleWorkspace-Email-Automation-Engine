import { TemplateLoader, ParsedTemplate, TableRange } from '@universal-email/core';
import { google, docs_v1 } from 'googleapis';
import { DocsToHtmlConverter } from '../utils/DocsToHtmlConverter';

export class NodeGoogleDocsTemplateLoader implements TemplateLoader {
  private docs: docs_v1.Docs;

  constructor(auth: any) {
    this.docs = google.docs({ version: 'v1', auth });
  }

  async loadTemplate(templateName: string, sourceId: string): Promise<ParsedTemplate> {
    const response = await this.docs.documents.get({
      documentId: sourceId
    });

    const doc = response.data;
    const { html, subject } = DocsToHtmlConverter.convertToHtml(doc, templateName);

    if (!html && !subject) {
      throw new Error(`Template '${templateName}' not found or empty in document`);
    }

    const tags = this.extractTags(html);
    const tableRanges = this.extractTableRanges(html);

    return {
      name: templateName,
      subject: subject || `${templateName} (No Subject)`,
      body: html,
      tags,
      tableRanges
    };
  }

  async getRawContent(templateName: string, sourceId: string): Promise<string> {
    const template = await this.loadTemplate(templateName, sourceId);
    return template.body;
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
