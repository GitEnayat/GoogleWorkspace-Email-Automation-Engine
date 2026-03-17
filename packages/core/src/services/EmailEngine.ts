/**
 * Email Engine - Main orchestration class
 * Platform-agnostic core that coordinates email generation
 */

import { EmailConfig, ExecutionResult, ParsedTemplate, Recipient } from '../types';
import { PlatformServices } from '../providers';

export class EmailEngine {
  private services: PlatformServices;
  private defaultConfig: Partial<EmailConfig>;

  constructor(services: PlatformServices, defaultConfig: Partial<EmailConfig> = {}) {
    this.services = services;
    this.defaultConfig = defaultConfig;
  }

  /**
   * Generate a single email draft
   */
  async generateEmailDraft(
    templateName: string,
    userConfig: Partial<EmailConfig> = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const logs: any[] = [];

    const config = { ...this.defaultConfig, ...userConfig };
    const mode = config.dryRun ? 'DRY_RUN' : config.testMode ? 'TEST' : 'PROD';

    try {
      this.services.logger.info('EmailEngine', `Starting generation for: ${templateName}`, { mode });

      // 1. Load template
      const templateSource = config.templateDocumentId || '';
      const template = await this.services.template.loadTemplate(templateName, templateSource);
      this.services.logger.info('EmailEngine', 'Template loaded', { 
        subject: template.subject, 
        tagCount: template.tags.length 
      });

      // 2. Resolve recipients
      let recipients = await this.resolveRecipients(config);

      // 3. Apply test mode or default to current user if no directory is configured
      if (config.testMode || (!config.directorySheetId && recipients.length === 0)) {
        recipients = [{ 
          email: this.services.email.getCurrentUserEmail(), 
          tags: recipients.length > 0 ? recipients[0].tags : {} 
        }];
      }

      this.services.logger.info('EmailEngine', 'Recipients resolved', { count: recipients.length });

      if (recipients.length === 0) {
        throw new Error('No valid recipients found');
      }

      const finalRecipients = recipients;

      // 4. Process template for each recipient
      const draftIds: string[] = [];
      
      for (const recipient of finalRecipients) {
        // Apply dictionary replacement
        const processedTemplate = await this.applyTemplateData(template, recipient, config);
        
        // In DRY_RUN mode, we skip creating drafts
        if (config.dryRun) {
          draftIds.push('dry-run-draft-id');
          this.services.logger.info('EmailEngine', 'Dry run: skipping draft creation');
          continue;
        }

        // Check for existing draft
        const existingDraftId = await this.services.email.findDraftBySubject(processedTemplate.subject);
        
        let draftId: string;
        
        // Generate plain text version for snippet/fallback
        const plainTextBody = this.htmlToPlainText(processedTemplate.body);

        if (existingDraftId) {
          // Case 1: Update existing draft
          await this.services.email.updateDraft(
            existingDraftId,
            processedTemplate.subject,
            plainTextBody,
            processedTemplate.body // htmlBody
          );
          draftId = existingDraftId;
          this.services.logger.info('EmailEngine', 'Draft updated', { draftId });
        
        } else {
          // Case 2: Check for existing thread to reply to (if supported)
          let threadId: string | null = null;
          
          if (this.services.email.findThreadBySubject) {
             threadId = await this.services.email.findThreadBySubject(processedTemplate.subject);
          }

          if (threadId && this.services.email.createReplyDraft) {
            // Reply to existing thread
            draftId = await this.services.email.createReplyDraft(
              threadId,
              plainTextBody, // Plain text body
              [], // CC
              [], // BCC
              processedTemplate.body // htmlBody
            );
            this.services.logger.info('EmailEngine', 'Reply draft created', { draftId, threadId });
          
          } else {
            // Case 3: Create new draft
            draftId = await this.services.email.createDraft(
              processedTemplate.subject,
              plainTextBody, // Plain text body
              [recipient.email],
              undefined, // cc
              undefined, // bcc
              processedTemplate.body // htmlBody
            );
            this.services.logger.info('EmailEngine', 'Draft created', { draftId });
          }
        }

        draftIds.push(draftId);

        // Send if configured
        if (config.emailAction === 'SEND') {
          await this.services.email.sendEmail(draftId);
          this.services.logger.info('EmailEngine', 'Email sent', { draftId });
        }
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        draftIds,
        draftId: draftIds[0], // For single recipient
        recipientCount: finalRecipients.length,
        mode,
        duration,
        logs
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.services.logger.error('EmailEngine', error.message);

      return {
        success: false,
        recipientCount: 0,
        mode,
        duration,
        error: error.message,
        logs
      };
    }
  }

  /**
   * Generate multiple drafts in batch
   */
  async generateBatchDrafts(
    templateNames: string[],
    config: Partial<EmailConfig> = {}
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];

    for (const templateName of templateNames) {
      const result = await this.generateEmailDraft(templateName, config);
      results.push(result);

      // Check execution time (Apps Script limit: 6 minutes)
      const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
      if (totalDuration > 5 * 60 * 1000) { // Stop at 5 minutes to be safe
        this.services.logger.warn('EmailEngine', 'Approaching time limit, stopping batch');
        break;
      }
    }

    return results;
  }

  /**
   * Resolve recipients from data source
   */
  private async resolveRecipients(config: Partial<EmailConfig>): Promise<Recipient[]> {
    if (!config.directorySheetId || !config.recipientsTabName) {
      return [];
    }

    const data = await this.services.data.getTabData(
      config.directorySheetId,
      config.recipientsTabName
    );

    return data.map((row: any) => ({
      email: row[config.recipientEmailColumn || 'Email'],
      tags: this.extractTags(row, config.recipientTagColumns || [])
    }));
  }

  /**
   * Extract tags from a row
   */
  private extractTags(row: Record<string, any>, tagColumns: string[]): Record<string, string> {
    const tags: Record<string, string> = {};
    for (const col of tagColumns) {
      if (row[col]) {
        tags[col] = row[col];
      }
    }
    return tags;
  }

  /**
   * Apply data to template (dictionary replacement)
   */
  private async applyTemplateData(
    template: ParsedTemplate,
    recipient: Recipient,
    config: EmailConfig
  ): Promise<ParsedTemplate> {
    let subject = template.subject;
    let body = template.body;

    // Replace recipient tags
    for (const [key, value] of Object.entries(recipient.tags)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(regex, value);
      body = body.replace(regex, value);
    }

    // Replace date tokens
    body = this.applyDateTokens(body);
    subject = this.applyDateTokens(subject);

    // Replace greeting
    const greeting = this.getGreeting();
    body = body.replace(/{{GREETING}}/g, greeting);

    // Load and inject managed links
    if (config.linkRepositorySheetId && this.services.links) {
      const links = await this.services.links.loadLinks(
        config.linkRepositorySheetId,
        config.linkRepositoryTabName || 'Link_Registry'
      );
      body = this.injectLinks(body, links);
    }

    // Render tables
    if (this.services.tables) {
      body = await this.renderTables(body);
    }

    return {
      ...template,
      subject,
      body
    };
  }

  /**
   * Apply date token replacements
   */
  private applyDateTokens(text: string): string {
    return text.replace(/{{DATE:([^}]+)}}/g, (match, dateStr) => {
      const date = new Date();
      // Simple date parsing - can be enhanced
      if (dateStr.toLowerCase().includes('today')) {
        // Match DD-MMM-YYYY format (e.g., 17-Mar-2026)
        const day = date.getDate().toString().padStart(2, '0');
        const month = date.toLocaleString('en-GB', { month: 'short' });
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
      }
      // Add more date logic as needed
      return match;
    });
  }

  /**
   * Get greeting based on time of day
   */
  private getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  /**
   * Inject managed links into template
   */
  private injectLinks(body: string, links: any[]): string {
    let result = body;
    
    for (const link of links) {
      const pattern = new RegExp(`\\$LINK:${link.key},\\s*TEXT:([^$]+)\\$`, 'g');
      result = result.replace(pattern, `<a href="${link.url}">$1</a>`);
    }

    return result;
  }

  /**
   * Render tables in the body
   */
  private async renderTables(body: string): Promise<string> {
    // Regex to match [Table] Sheet: ID, range: Range
    // Captures range until < (start of tag) or end of string, handling spaces
    const regex = /\[Table\]\s*Sheet:\s*([^,]+),\s*range:\s*([^<]+?)(?=<|$)/g;
    
    return this.replaceAsync(body, regex, async (match, sheetId, rangeRaw) => {
      try {
        // Clean range string (remove quotes if any)
        const range = rangeRaw.replace(/['"]/g, '').trim();
        const cleanSheetId = sheetId.trim();
        
        if (this.services.tables) {
           return await this.services.tables.renderTable(cleanSheetId, range);
        }
        return match;
      } catch (error: any) {
        this.services.logger.error('EmailEngine', `Failed to render table: ${error.message}`);
        return `<p style="color:red">[Table Error: ${error.message}]</p>`;
      }
    });
  }

  /**
   * Helper to replace string with async callback
   */
  private async replaceAsync(str: string, regex: RegExp, asyncFn: (match: string, ...args: any[]) => Promise<string>): Promise<string> {
    const promises: Promise<string>[] = [];
    
    // First pass: collect all promises
    str.replace(regex, (match, ...args) => {
      promises.push(asyncFn(match, ...args));
      return match;
    });
    
    const replacements = await Promise.all(promises);
    
    // Reset regex index if global flag is set (crucial for second pass!)
    if (regex.global) regex.lastIndex = 0;
    
    // Second pass: replace with resolved values
    return str.replace(regex, () => replacements.shift() || '');
  }

  /**
   * Convert HTML to plain text for accessibility and snippets
   */
  private htmlToPlainText(html: string): string {
    if (!html) return '';

    return html
      // Replace <br>, <p> with newlines
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<p[^>]*>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      // Replace <li> with bullet points
      .replace(/<li>/gi, '• ')
      .replace(/<\/li>/gi, '\n')
      // Replace <tr> with newlines for tables
      .replace(/<\/tr>/gi, '\n')
      // Replace <td>, <th> with tabs
      .replace(/<td[^>]*>/gi, '\t')
      .replace(/<th[^>]*>/gi, '\t')
      // Remove all remaining HTML tags
      .replace(/<[^>]+>/g, '')
      // Decode common HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      // Collapse multiple newlines
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
