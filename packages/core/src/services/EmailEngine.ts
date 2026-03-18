/**
 * Email Engine - Main orchestration class
 * Platform-agnostic core that coordinates email generation
 */

import {
  EmailConfig,
  ExecutionResult,
  LocaleConfig,
  ParsedTemplate,
  Recipient,
  ValidationResult,
  createTableTagRegex,
} from "../types";
import { PlatformServices } from "../providers";
import { TemplateValidator } from "./TemplateValidator";

export class EmailEngine {
  private services: PlatformServices;
  private defaultConfig: Partial<EmailConfig>;

  constructor(
    services: PlatformServices,
    defaultConfig: Partial<EmailConfig> = {},
  ) {
    this.services = services;
    this.defaultConfig = defaultConfig;
  }

  /**
   * Generate a single email draft
   */
  async generateEmailDraft(
    templateName: string,
    userConfig: Partial<EmailConfig> = {},
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const logs: any[] = [];

    const config = { ...this.defaultConfig, ...userConfig };
    const mode = config.dryRun ? "DRY_RUN" : config.testMode ? "TEST" : "PROD";

    try {
      this.services.logger.info(
        "EmailEngine",
        `Starting generation for: ${templateName}`,
        { mode },
      );

      // 1. Load template
      const templateSource = config.templateDocumentId || "";
      const template = await this.services.template.loadTemplate(
        templateName,
        templateSource,
      );
      this.services.logger.info("EmailEngine", "Template loaded", {
        subject: template.subject,
        tagCount: template.tags.length,
      });

      // 2. Resolve recipients
      let recipients = await this.resolveRecipients(config);

      // 3. Apply test mode or default to current user if no directory is configured
      if (
        config.testMode ||
        (!config.directorySheetId && recipients.length === 0)
      ) {
        recipients = [
          {
            email: this.services.email.getCurrentUserEmail(),
            tags: recipients.length > 0 ? recipients[0].tags : {},
          },
        ];
      }

      this.services.logger.info("EmailEngine", "Recipients resolved", {
        count: recipients.length,
      });

      if (recipients.length === 0) {
        throw new Error("No valid recipients found");
      }

      const finalRecipients = recipients;

      // 4. Load locale settings once (from Settings tab + programmatic overrides)
      const tabSettings = await this.loadSettingsFromStore(config);
      const locale = this.resolveLocale(config, tabSettings);

      // 5. Process template for each recipient
      const draftIds: string[] = [];

      for (const recipient of finalRecipients) {
        // Apply dictionary replacement
        const processedTemplate = await this.applyTemplateData(
          template,
          recipient,
          config,
          locale,
        );

        // In DRY_RUN mode, we skip creating drafts
        if (config.dryRun) {
          draftIds.push("dry-run-draft-id");
          this.services.logger.info(
            "EmailEngine",
            "Dry run: skipping draft creation",
          );
          continue;
        }

        // Check for existing draft
        const existingDraftId = await this.services.email.findDraftBySubject(
          processedTemplate.subject,
        );

        let draftId: string;

        // Generate plain text version for snippet/fallback
        const plainTextBody = this.htmlToPlainText(processedTemplate.body);

        if (existingDraftId) {
          // Case 1: Update existing draft
          await this.services.email.updateDraft(
            existingDraftId,
            processedTemplate.subject,
            plainTextBody,
            processedTemplate.body, // htmlBody
          );
          draftId = existingDraftId;
          this.services.logger.info("EmailEngine", "Draft updated", {
            draftId,
          });
        } else {
          // Case 2: Check for existing thread to reply to (if supported)
          let threadId: string | null = null;

          if (this.services.email.findThreadBySubject) {
            threadId = await this.services.email.findThreadBySubject(
              processedTemplate.subject,
            );
          }

          if (threadId && this.services.email.createReplyDraft) {
            // Reply to existing thread
            draftId = await this.services.email.createReplyDraft(
              threadId,
              plainTextBody, // Plain text body
              [], // CC
              [], // BCC
              processedTemplate.body, // htmlBody
            );
            this.services.logger.info("EmailEngine", "Reply draft created", {
              draftId,
              threadId,
            });
          } else {
            // Case 3: Create new draft
            draftId = await this.services.email.createDraft(
              processedTemplate.subject,
              plainTextBody, // Plain text body
              [recipient.email],
              undefined, // cc
              undefined, // bcc
              processedTemplate.body, // htmlBody
            );
            this.services.logger.info("EmailEngine", "Draft created", {
              draftId,
            });
          }
        }

        draftIds.push(draftId);

        // Send if configured
        if (config.emailAction === "SEND") {
          await this.services.email.sendEmail(draftId);
          this.services.logger.info("EmailEngine", "Email sent", { draftId });
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
        logs,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.services.logger.error("EmailEngine", error.message);

      return {
        success: false,
        recipientCount: 0,
        mode,
        duration,
        error: error.message,
        logs,
      };
    }
  }

  /**
   * Generate multiple drafts in batch
   */
  async generateBatchDrafts(
    templateNames: string[],
    config: Partial<EmailConfig> = {},
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    const batchDelayMs = config.batchDelayMs ?? 500;

    for (const templateName of templateNames) {
      const result = await this.generateEmailDraft(templateName, config);
      results.push(result);

      // Add delay between iterations for rate limiting
      if (
        batchDelayMs > 0 &&
        templateName !== templateNames[templateNames.length - 1]
      ) {
        await new Promise((resolve) => setTimeout(resolve, batchDelayMs));
      }

      // Check execution time (Apps Script limit: 6 minutes)
      const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
      if (totalDuration > 5 * 60 * 1000) {
        // Stop at 5 minutes to be safe
        this.services.logger.warn(
          "EmailEngine",
          "Approaching time limit, stopping batch",
        );
        break;
      }
    }

    return results;
  }

  /**
   * Resolve recipients from data source
   */
  private async resolveRecipients(
    config: Partial<EmailConfig>,
  ): Promise<Recipient[]> {
    if (!config.directorySheetId || !config.recipientsTabName) {
      return [];
    }

    const data = await this.services.data.getTabData(
      config.directorySheetId,
      config.recipientsTabName,
    );

    return data.map((row: any) => ({
      email: row[config.recipientEmailColumn || "Email"],
      tags: this.extractTags(row, config.recipientTagColumns || []),
    }));
  }

  /**
   * Extract tags from a row
   */
  private extractTags(
    row: Record<string, any>,
    tagColumns: string[],
  ): Record<string, string> {
    const tags: Record<string, string> = {};
    for (const col of tagColumns) {
      if (row[col]) {
        tags[col] = row[col];
      }
    }
    return tags;
  }

  /**
   * Load locale settings from a Settings tab in the spreadsheet/workbook.
   * Returns a partial LocaleConfig — only keys present in the tab are set.
   *
   * Expected tab layout (two columns):
   *   | Setting      | Value            |
   *   |--------------|------------------|
   *   | timezone     | America/New_York |
   *   | dateFormat   | MM/dd/yyyy       |
   *   | locale       | en-US            |
   *   | weekStartDay | 1                |
   *   | timeFormat   | 12h              |
   */
  private async loadSettingsFromStore(
    config: Partial<EmailConfig>,
  ): Promise<Partial<LocaleConfig>> {
    const sheetId = config.settingsSheetId ?? config.directorySheetId;
    const tabName = config.settingsTabName ?? "Engine_Settings";

    if (!sheetId) return {};

    try {
      const rows = await this.services.data.getTabData(sheetId, tabName);
      const settings: Partial<LocaleConfig> = {};

      for (const row of rows) {
        const key = (row["Setting"] ?? row["setting"] ?? "").toString().trim();
        const value = (row["Value"] ?? row["value"] ?? "").toString().trim();
        if (!key || !value) continue;

        switch (key) {
          case "timezone":
            settings.timezone = value;
            break;
          case "dateFormat":
            settings.dateFormat = value;
            break;
          case "locale":
            settings.locale = value;
            break;
          case "weekStartDay": {
            const n = parseInt(value, 10);
            if (n >= 0 && n <= 6) settings.weekStartDay = n as 0|1|2|3|4|5|6;
            break;
          }
          case "timeFormat":
            if (value === "12h" || value === "24h") settings.timeFormat = value;
            break;
        }
      }

      return settings;
    } catch {
      // Tab doesn't exist or is empty — that's fine, use defaults
      return {};
    }
  }

  /**
   * Resolve locale config with defaults for any missing fields.
   * Priority: programmatic config.locale > Settings tab > defaults
   */
  private resolveLocale(
    config: Partial<EmailConfig>,
    tabSettings: Partial<LocaleConfig>,
  ): Required<LocaleConfig> {
    const l = config.locale ?? {};
    return {
      timezone: l.timezone ?? tabSettings.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      dateFormat: l.dateFormat ?? tabSettings.dateFormat ?? "dd-MMM-yyyy",
      locale: l.locale ?? tabSettings.locale ?? "en-GB",
      weekStartDay: l.weekStartDay ?? tabSettings.weekStartDay ?? 0,
      timeFormat: l.timeFormat ?? tabSettings.timeFormat ?? "24h",
    };
  }

  /**
   * Apply data to template (dictionary replacement)
   */
  private async applyTemplateData(
    template: ParsedTemplate,
    recipient: Recipient,
    config: EmailConfig,
    locale: Required<LocaleConfig>,
  ): Promise<ParsedTemplate> {

    // Heal HTML tags injected inside {{ }} tokens by rich-text editors
    let subject = this.healTokens(template.subject);
    let body = this.healTokens(template.body);

    // Replace recipient tags
    for (const [key, value] of Object.entries(recipient.tags)) {
      const regex = new RegExp(`{{${key}}}`, "g");
      subject = subject.replace(regex, value);
      body = body.replace(regex, value);
    }

    // Replace date tokens
    body = this.applyDateTokens(body, locale);
    subject = this.applyDateTokens(subject, locale);

    // Replace time tokens
    body = this.applyTimeTokens(body, locale);
    subject = this.applyTimeTokens(subject, locale);

    // Replace greeting
    const greeting = this.getGreeting(locale);
    body = body.replace(/{{GREETING}}/g, greeting);

    // Load and inject managed links
    if (config.linkRepositorySheetId && this.services.links) {
      const links = await this.services.links.loadLinks(
        config.linkRepositorySheetId,
        config.linkRepositoryTabName || "Link_Registry",
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
      body,
    };
  }

  /**
   * Apply date token replacements with robust logic
   */
  private applyDateTokens(text: string, locale: Required<LocaleConfig>): string {
    const DATE_REGEX = /{{DATE:([^}]+)}}/g;
    const MONTH_REGEX = /{{MONTHNAME(?::([^}]+))?}}/g;

    let result = text.replace(DATE_REGEX, (match, token) => {
      try {
        const date = this.parseDateToken(token, locale);
        return this.formatDate(date, locale);
      } catch (e) {
        return match;
      }
    });

    result = result.replace(MONTH_REGEX, (match, offset) => {
      try {
        const date = new Date();
        if (offset) {
          date.setMonth(date.getMonth() + parseInt(offset, 10));
        }
        return date.toLocaleString(locale.locale, {
          month: "long",
          year: "numeric",
          timeZone: locale.timezone,
        });
      } catch (e) {
        return match;
      }
    });

    return result;
  }

  /**
   * Apply time token replacements: {{TIME}} or {{TIME:timezone_label}}
   */
  private applyTimeTokens(text: string, locale: Required<LocaleConfig>): string {
    const TIME_REGEX = /{{TIME(?::([^}]+))?}}/g;

    return text.replace(TIME_REGEX, (match, param) => {
      try {
        const tz = param?.trim() || locale.timezone;
        const opts: Intl.DateTimeFormatOptions = {
          hour: "2-digit",
          minute: "2-digit",
          hour12: locale.timeFormat === "12h",
          timeZone: tz,
        };
        return new Date().toLocaleTimeString(locale.locale, opts);
      } catch (e) {
        return match;
      }
    });
  }

  private parseDateToken(token: string, locale: Required<LocaleConfig>): Date {
    const now = new Date();
    const t = token.toLowerCase().trim();

    if (t === "today") return now;
    if (t === "yesterday") {
      now.setDate(now.getDate() - 1);
      return now;
    }
    if (t === "tomorrow") {
      now.setDate(now.getDate() + 1);
      return now;
    }
    if (t === "monthstart") {
      now.setDate(1);
      return now;
    }
    if (t === "weekstart") {
      const currentDay = now.getDay();
      const diff = (currentDay - locale.weekStartDay + 7) % 7;
      now.setDate(now.getDate() - diff);
      return now;
    }

    // Day Arithmetic: Today+7, Today-1
    const mathMatch = t.match(/today([+-])(\d+)/);
    if (mathMatch) {
      const op = mathMatch[1] === "+" ? 1 : -1;
      const days = parseInt(mathMatch[2], 10);
      now.setDate(now.getDate() + op * days);
      return now;
    }

    // Weekday Logic: Next Monday, Last Friday
    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const targetDay = dayNames.findIndex((d) => t.includes(d));
    if (targetDay !== -1) {
      const currentDay = now.getDay();
      let diff = targetDay - currentDay;
      if (t.includes("next")) diff += 7;
      if (t.includes("last")) diff -= 7;
      if (diff === 0 && !t.includes("next") && !t.includes("last")) diff = 0;
      else if (diff <= 0 && !t.includes("last")) diff += 7;

      now.setDate(now.getDate() + diff);
      return now;
    }

    return now;
  }

  private formatDate(d: Date, locale: Required<LocaleConfig>): string {
    const fmt = locale.dateFormat;

    // Use Intl for locale-aware month names
    const dayNum = d.getDate().toString().padStart(2, "0");
    const monthShort = d.toLocaleString(locale.locale, { month: "short", timeZone: locale.timezone });
    const monthLong = d.toLocaleString(locale.locale, { month: "long", timeZone: locale.timezone });
    const monthNumeric = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear().toString();
    const yearShort = year.slice(-2);

    return fmt
      .replace("dd", dayNum)
      .replace("MMMM", monthLong)
      .replace("MMM", monthShort)
      .replace("MM", monthNumeric)
      .replace("yyyy", year)
      .replace("yy", yearShort);
  }

  /**
   * Get greeting based on time of day in the configured timezone
   */
  private getGreeting(locale: Required<LocaleConfig>): string {
    const hour = parseInt(
      new Date().toLocaleString(locale.locale, {
        hour: "2-digit",
        hour12: false,
        timeZone: locale.timezone,
      }),
      10,
    );
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  }

  /**
   * Inject managed links into template
   */
  private injectLinks(body: string, links: any[]): string {
    let result = body;

    for (const link of links) {
      const pattern = new RegExp(
        `\\$LINK:${link.key},\\s*TEXT:([^$]+)\\$`,
        "g",
      );
      result = result.replace(pattern, `<a href="${link.url}">$1</a>`);
    }

    return result;
  }

    /**
     * Render tables in the body
     */
    private async renderTables(body: string): Promise<string> {
      const regex = createTableTagRegex();
      
      return this.replaceAsync(body, regex, async (match, sheetId, rangeRaw) => {      try {
        // Clean range string (remove quotes if any)
        const range = rangeRaw.replace(/['"]/g, "").trim();
        const cleanSheetId = sheetId.trim();

        if (this.services.tables) {
          return await this.services.tables.renderTable(cleanSheetId, range);
        }
        return match;
      } catch (error: any) {
        this.services.logger.error(
          "EmailEngine",
          `Failed to render table: ${error.message}`,
        );
        return `<p style="color:red">[Table Error: ${error.message}]</p>`;
      }
    });
  }

  /**
   * Helper to replace string with async callback
   */
  private async replaceAsync(
    str: string,
    regex: RegExp,
    asyncFn: (match: string, ...args: any[]) => Promise<string>,
  ): Promise<string> {
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
    return str.replace(regex, () => replacements.shift() || "");
  }

  /**
   * Validate a template before execution
   */
  async validateTemplate(
    templateName: string,
    sourceId: string,
  ): Promise<ValidationResult> {
    const template = await this.services.template.loadTemplate(
      templateName,
      sourceId,
    );
    return TemplateValidator.validate(template);
  }

  /**
   * Strip HTML tags that rich-text editors inject inside {{ }} tokens.
   * e.g. {{ <b>DATE</b>:Today }} → {{DATE:Today}}
   */
  private healTokens(text: string): string {
    return text.replace(/\{\{(.*?)\}\}/g, (_match, inner: string) => {
      const clean = inner
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return "{{" + clean + "}}";
    });
  }

  /**
   * Convert HTML to plain text for accessibility and snippets
   */
  private htmlToPlainText(html: string): string {
    if (!html) return "";

    return (
      html
        // Replace <br>, <p> with newlines
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<p[^>]*>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        // Replace <li> with bullet points
        .replace(/<li>/gi, "• ")
        .replace(/<\/li>/gi, "\n")
        // Replace <tr> with newlines for tables
        .replace(/<\/tr>/gi, "\n")
        // Replace <td>, <th> with tabs
        .replace(/<td[^>]*>/gi, "\t")
        .replace(/<th[^>]*>/gi, "\t")
        // Remove all remaining HTML tags
        .replace(/<[^>]+>/g, "")
        // Decode common HTML entities
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        // Collapse multiple newlines
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    );
  }
}
