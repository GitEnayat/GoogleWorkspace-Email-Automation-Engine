import mammoth from 'mammoth';

export interface ConvertedTemplate {
  html: string;
  subject: string;
}

export class WordToHtmlConverter {
  static async convertToHtml(buffer: Buffer, templateName: string): Promise<ConvertedTemplate> {
    const result = await mammoth.convertToHtml({ buffer });
    const rawHtml = result.value;

    return this.parseTemplateMarkers(rawHtml, templateName);
  }

  static async convertToHtmlFromArray(arrayBuffer: ArrayBuffer, templateName: string): Promise<ConvertedTemplate> {
    const result = await mammoth.convertToHtml({ arrayBuffer });
    const rawHtml = result.value;

    return this.parseTemplateMarkers(rawHtml, templateName);
  }

  private static parseTemplateMarkers(html: string, templateName: string): ConvertedTemplate {
    const startMarker = `{{${templateName}}}`;
    const endMarker = `{{/${templateName}}}`;
    
    const startIndex = html.indexOf(startMarker);
    const endIndex = html.indexOf(endMarker);

    if (startIndex === -1) {
      return { html: '', subject: '' };
    }

    const contentStart = startIndex + startMarker.length;
    const contentEnd = endIndex !== -1 ? endIndex : html.length;
    let templateContent = html.slice(contentStart, contentEnd).trim();

    let subject = '';
    const subjectMatch = templateContent.match(/{{Subject:\s*([^}]+)}}/);
    if (subjectMatch) {
      subject = subjectMatch[1].trim();
      templateContent = templateContent.replace(subjectMatch[0], '');
    }

    return {
      html: templateContent.trim(),
      subject
    };
  }

  static extractTags(content: string): string[] {
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

  static extractTableRanges(content: string): Array<{ source: string; range: string; preserveFormatting: boolean }> {
    const tableRegex = /\[Table\]\s*Sheet:\s*([^,]+),\s*range:\s*([^<]+)/g;
    const ranges = [];
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
