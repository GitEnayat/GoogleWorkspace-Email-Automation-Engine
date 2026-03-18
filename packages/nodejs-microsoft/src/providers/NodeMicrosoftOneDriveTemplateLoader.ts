import {
  TemplateLoader,
  ParsedTemplate,
  TableRange,
} from "@universal-email/core";
import { Client } from "@microsoft/microsoft-graph-client";
import { WordToHtmlConverter } from "../utils/WordToHtmlConverter";

export class NodeMicrosoftOneDriveTemplateLoader implements TemplateLoader {
  private client: Client;

  constructor(graphClient: Client) {
    this.client = graphClient;
  }

  async loadTemplate(
    templateName: string,
    sourceId: string,
  ): Promise<ParsedTemplate> {
    const fileContent = await this.downloadFile(sourceId);
    const fileExtension = sourceId.split(".").pop()?.toLowerCase();

    let html: string;
    let subject: string;

    if (fileExtension === "html" || fileExtension === "htm") {
      const parsed = this.parseHtmlTemplate(
        fileContent.toString("utf-8"),
        templateName,
      );
      html = parsed.html;
      subject = parsed.subject;
    } else if (fileExtension === "docx") {
      const parsed = await WordToHtmlConverter.convertToHtml(
        Buffer.from(fileContent),
        templateName,
      );
      html = parsed.html;
      subject = parsed.subject;
    } else {
      throw new Error(`Unsupported file format: ${fileExtension}`);
    }

    if (!html && !subject) {
      throw new Error(
        `Template '${templateName}' not found or empty in document`,
      );
    }

    const tags = this.extractTags(html);
    const tableRanges = this.extractTableRanges(html);

    return {
      name: templateName,
      subject: subject || `${templateName} (No Subject)`,
      body: html,
      tags,
      tableRanges,
    };
  }

  async getRawContent(templateName: string, sourceId: string): Promise<string> {
    const template = await this.loadTemplate(templateName, sourceId);
    return template.body;
  }

  private async downloadFile(sourceId: string): Promise<Buffer> {
    const response = await this.client
      .api(`/me/drive/items/${sourceId}/content`)
      .get();

    if (response instanceof ArrayBuffer) {
      return Buffer.from(response);
    }

    return Buffer.from(JSON.stringify(response));
  }

  private parseHtmlTemplate(
    html: string,
    templateName: string,
  ): { html: string; subject: string } {
    const startMarker = `{{${templateName}}}`;
    const endMarker = `{{/${templateName}}}`;

    const startIndex = html.indexOf(startMarker);
    const endIndex = html.indexOf(endMarker);

    if (startIndex === -1) {
      return { html: "", subject: "" };
    }

    const contentStart = startIndex + startMarker.length;
    const contentEnd = endIndex !== -1 ? endIndex : html.length;
    let templateContent = html.slice(contentStart, contentEnd).trim();

    let subject = "";
    const subjectMatch = templateContent.match(/{{Subject:\s*([^}]+)}}/);
    if (subjectMatch) {
      subject = subjectMatch[1].trim();
      templateContent = templateContent.replace(subjectMatch[0], "");
    }

    return {
      html: templateContent.trim(),
      subject,
    };
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
    const tableRegex = /\[Table\]\s*Sheet:\s*([^,]+),\s*range:\s*([^<]+)/g;
    const ranges: TableRange[] = [];
    let match;

    while ((match = tableRegex.exec(content)) !== null) {
      ranges.push({
        source: match[1].trim(),
        range: match[2].trim(),
        preserveFormatting: true,
      });
    }

    return ranges;
  }
}
