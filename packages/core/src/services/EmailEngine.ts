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

/**
 * The core orchestration engine for generating and sending emails.
 * It coordinates with various platform services to load templates, resolve recipients,
 * apply data, and manage email drafts/sends.
 */
export class EmailEngine {
  private services: PlatformServices;
  private defaultConfig: Partial<EmailConfig>;

  /**
   * Creates an instance of EmailEngine.
   * @param services An object containing platform-specific service implementations.
   * @param defaultConfig Optional default configuration to be merged with user-provided configs.
   */
  constructor(
    services: PlatformServices,
    defaultConfig: Partial<EmailConfig> = {},
  ) {
    this.services = services;
    this.defaultConfig = defaultConfig;
  }

  /**
   * Generates a single email draft or sends an email based on the provided template and configuration.
   * This method handles template loading, recipient resolution, data application,
   * and interaction with the email provider to create/update drafts or send emails.
   * @param templateName The name of the template to use.
   * @param userConfig Optional configuration specific to this generation task, which overrides defaults.
   * @returns A promise that resolves with the execution result.
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
      // If in test mode or no recipient directory is set, use the current user's email as the sole recipient.
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
      // Retrieves locale configuration from a spreadsheet and merges it with programmatic config.
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
          // Case 2: Check for existing thread to reply to (if supported by EmailProvider)
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
   * Generates multiple email drafts in a batch, with optional delays between each.
   * This method iterates through a list of template names, calling `generateEmailDraft` for each,
   * and includes safeguards against exceeding execution time limits.
   * @param templateNames An array of template names to process.
   * @param config Optional configuration for the batch operation.
   * @returns A promise that resolves with an array of execution results for each template.
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
   * Resolves a list of recipients by fetching data from the configured data store.
   * Filters out rows with invalid email addresses.
   * @param config The email configuration containing directory and recipient column details.
   * @returns A promise that resolves with an array of `Recipient` objects.
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

    return data
      .filter((row: any) => {
        const email = row[config.recipientEmailColumn || 'Email'];
        if (!this.isValidEmail(email)) {
          this.services.logger.warn('EmailEngine', 'Invalid email skipped', { email });
          return false;
        }
        return true;
      })
      .map((row: any) => ({
        email: row[config.recipientEmailColumn || 'Email'].trim(),
        tags: this.extractTags(row, config.recipientTagColumns || []),
      }));
  }

  /**
   * Extracts tags (key-value pairs) from a given data row based on specified tag columns.
   * @param row The data row (record) from which to extract tags.
   * @param tagColumns An array of column names to treat as tags.
   * @returns A record of extracted tags.
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
   * Escapes special regular expression characters in a string.
   * @param str The string to escape.
   * @returns The escaped string.
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Sanitize URL to prevent XSS attacks.
   * Ensures only safe protocols (http, https, mailto) are allowed.
   * @param url The URL string to sanitize.
   * @returns The sanitized URL or a placeholder if unsafe/invalid.
   */
  private sanitizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
        return '#blocked-unsafe-url';
      }
      return url;
    } catch {
      return '#invalid-url';
    }
  }

  /**
   * Escapes HTML special characters in a string to prevent XSS.
   * @param str The string to HTML escape.
   * @returns The HTML-escaped string.
   */
  private htmlEscape(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Validates if a given string is a well-formed email address.
   * Performs basic format, length, and content checks.
   * @param email The string to validate as an email address.
   * @returns True if the email is valid, false otherwise.
   */
  private isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    // Check for newlines which are invalid in email addresses
    if (email.includes('\n') || email.includes('\r')) return false;
    const trimmed = email.trim();
    // Email addresses usually have a maximum length of 254 characters
    if (trimmed.length > 254) return false;
    // Regex for basic email format validation
    return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(trimmed);
  }

  /**
   * Loads locale settings from a designated "Settings" tab within a spreadsheet/workbook.
   * @param config The email configuration, specifying `settingsSheetId` and `settingsTabName`.
   * @returns A promise that resolves with a partial `LocaleConfig` object containing settings found.
   * @example
   * // Expected tab layout for "Engine_Settings":
   * // | Setting    | Value            |
   * // |------------|------------------|
   * // | timezone   | Asia/Kuala_Lumpur|
   * // | dateFormat | dd-MMM-yyyy      |
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
            if (n >= 0 && n <= 6)
              settings.weekStartDay = n as 0 | 1 | 2 | 3 | 4 | 5 | 6;
            break;
          }
          case "timeFormat":
            if (value === "12h" || value === "24h") settings.timeFormat = value;
            break;
        }
      }

      return settings;
    } catch {
      // If the tab doesn't exist or is empty, return an empty object,
      // as defaults will be applied in `resolveLocale`.
      return {};
    }
  }

  /**
   * Resolves the final locale configuration by combining programmatic settings,
   * spreadsheet settings, and sensible defaults.
   * Priority: programmatic config.locale > Settings tab > internal defaults.
   * @param config The email configuration.
   * @param tabSettings Locale settings loaded from the configuration tab.
   * @returns A complete `Required<LocaleConfig>` object with all fields defined.
   */
  private resolveLocale(
    config: Partial<EmailConfig>,
    tabSettings: Partial<LocaleConfig>,
  ): Required<LocaleConfig> {
    const l = config.locale ?? {};
    return {
      timezone:
        l.timezone ??
        tabSettings.timezone ??
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      dateFormat: l.dateFormat ?? tabSettings.dateFormat ?? "dd-MMM-yyyy",
      locale: l.locale ?? tabSettings.locale ?? "en-GB",
      weekStartDay: l.weekStartDay ?? tabSettings.weekStartDay ?? 0,
      timeFormat: l.timeFormat ?? tabSettings.timeFormat ?? "24h",
    };
  }

  /**
   * Applies recipient-specific data and other dynamic tokens (date, time, links, tables)
   * to the template's subject and body.
   * @param template The parsed template.
   * @param recipient The current recipient for whom the email is being generated.
   * @param config The overall email configuration.
   * @param locale The resolved locale configuration.
   * @returns A promise that resolves with a new `ParsedTemplate` object containing the processed subject and body.
   */
  private async applyTemplateData(
    template: ParsedTemplate,
    recipient: Recipient,
    config: EmailConfig,
    locale: Required<LocaleConfig>,
  ): Promise<ParsedTemplate> {
    // Clean up HTML tags potentially injected by rich-text editors inside `{{ }}` tokens.
    let subject = this.healTokens(template.subject);
    let body = this.healTokens(template.body);

    // Replace recipient tags (e.g., {{FirstName}}, {{LastName}})
    // A simple regex is used here because Handlebars might conflict with custom tokens.
    for (const [key, value] of Object.entries(recipient.tags)) {
      const regex = new RegExp(`{{${key}}}`, "g");
      subject = subject.replace(regex, value);
      body = body.replace(regex, value);
    }

    // Apply date token replacements (e.g., {{DATE:Today}}, {{DATE:Next Monday}})
    body = this.applyDateTokens(body, locale);
    subject = this.applyDateTokens(subject, locale);

    // Replace time tokens (e.g., {{TIME}}, {{TIME:Asia/Kuala_Lumpur}})
    body = this.applyTimeTokens(body, locale);
    subject = this.applyTimeTokens(subject, locale);

    // Replace greeting token (e.g., {{GREETING}}) based on time of day.
    const greeting = this.getGreeting(locale);
    body = body.replace(/{{GREETING}}/g, greeting);

    // Load and inject managed links (e.g., $LINK:Key, TEXT:Label$) if `LinkRepository` is available.
    if (config.linkRepositorySheetId && this.services.links) {
      const links = await this.services.links.loadLinks(
        config.linkRepositorySheetId,
        config.linkRepositoryTabName || "Link_Registry",
      );
      body = this.injectLinks(body, links);
    }

    // Render tables (e.g., [Table] Sheet: URL, range: 'Tab'!A1:D10) if `TableRenderer` is available.
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
   * Applies date token replacements (e.g., `{{DATE:Today}}`, `{{MONTHNAME}}`) with locale-aware formatting.
   * @param text The input string (subject or body) to process.
   * @param locale The resolved locale configuration.
   * @returns The string with date tokens replaced.
   */
  private applyDateTokens(
    text: string,
    locale: Required<LocaleConfig>,
  ): string {
    const DATE_REGEX = /{{DATE:([^}]+)}}/g;
    const MONTH_REGEX = /{{MONTHNAME(?::([^}]+))?}}/g;

    let result = text.replace(DATE_REGEX, (match, token) => {
      try {
        const date = this.parseDateToken(token, locale);
        return this.formatDate(date, locale);
      } catch (e) {
        // If parsing or formatting fails, return the original match to avoid breaking the template.
        return match;
      }
    });

    result = result.replace(MONTH_REGEX, (match, offset) => {
      try {
        const date = new Date();
        // Adjust month if an offset is provided (e.g., {{MONTHNAME:+1}})
        if (offset) {
          date.setMonth(date.getMonth() + parseInt(offset, 10));
        }
        // Format month name and year according to locale
        return date.toLocaleString(locale.locale, {
          month: "long",
          year: "numeric",
          timeZone: locale.timezone,
        });
      } catch (e) {
        // If formatting fails, return the original match.
        return match;
      }
    });

    return result;
  }

  /**
   * Applies time token replacements (e.g., `{{TIME}}` or `{{TIME:timezone_label}}`).
   * @param text The input string (subject or body) to process.
   * @param locale The resolved locale configuration.
   * @returns The string with time tokens replaced.
   */
  private applyTimeTokens(
    text: string,
    locale: Required<LocaleConfig>,
  ): string {
    const TIME_REGEX = /{{TIME(?::([^}]+))?}}/g;

    return text.replace(TIME_REGEX, (match, param) => {
      try {
        // Use provided timezone parameter or fallback to configured locale timezone.
        const tz = param?.trim() || locale.timezone;
        const opts: Intl.DateTimeFormatOptions = {
          hour: "2-digit",
          minute: "2-digit",
          hour12: locale.timeFormat === "12h",
          timeZone: tz,
        };
        return new Date().toLocaleTimeString(locale.locale, opts);
      } catch (e) {
        // If formatting fails, return the original match.
        return match;
      }
    });
  }

  /**
   * Parses a date token (e.g., "Today", "Next Monday", "Today+7") into a `Date` object.
   * Handles relative dates, day arithmetic, and specific weekdays, respecting `weekStartDay` locale setting.
   * @param token The date token string to parse.
   * @param locale The resolved locale configuration for `weekStartDay`.
   * @returns A `Date` object representing the parsed date.
   */
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
      // Adjust date to the start of the week based on locale's `weekStartDay`.
      const currentDay = now.getDay();
      const diff = (currentDay - locale.weekStartDay + 7) % 7;
      now.setDate(now.getDate() - diff);
      return now;
    }

    // Day Arithmetic: Today+7, Today-1
    const mathMatch = t.match(/today([+-])(\d+)/);
    if (mathMatch) {
      const op = mathMatch[1] === "+" ? 1 : -1; // Determine if adding or subtracting days
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
      if (t.includes("next")) diff += 7; // For "next <weekday>"
      if (t.includes("last")) diff -= 7; // For "last <weekday>"
      // Adjust diff to ensure it targets the correct future or past weekday if not "next" or "last" explicitly
      else if (diff <= 0) diff += 7; // Default to next occurrence if in the past or today, unless "last" was specified.

      now.setDate(now.getDate() + diff);
      return now;
    }

    return now; // Fallback to current date if no specific token matched.
  }

  /**
   * Formats a given `Date` object into a string according to the specified `dateFormat` and `locale`.
   * @param d The `Date` object to format.
   * @param locale The resolved locale configuration containing `dateFormat` and `locale`.
   * @returns The formatted date string.
   */
  private formatDate(d: Date, locale: Required<LocaleConfig>): string {
    const fmt = locale.dateFormat;

    // Use Intl for locale-aware month names to ensure correct language and capitalization.
    const dayNum = d.getDate().toString().padStart(2, "0");
    const monthShort = d.toLocaleString(locale.locale, {
      month: "short",
      timeZone: locale.timezone,
    });
    const monthLong = d.toLocaleString(locale.locale, {
      month: "long",
      timeZone: locale.timezone,
    });
    const monthNumeric = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear().toString();
    const yearShort = year.slice(-2);

    // Replace format tokens with corresponding date parts.
    return fmt
      .replace("dd", dayNum)
      .replace("MMMM", monthLong)
      .replace("MMM", monthShort)
      .replace("MM", monthNumeric)
      .replace("yyyy", year)
      .replace("yy", yearShort);
  }

  /**
   * Generates a greeting ("Good Morning", "Good Afternoon", "Good Evening") based on the current
   * time in the configured timezone.
   * @param locale The resolved locale configuration for timezone.
   * @returns A greeting string.
   */
  private getGreeting(locale: Required<LocaleConfig>): string {
    // Get the current hour in the specified timezone using locale-aware formatting.
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
   * Injects managed links into the email body by replacing `$LINK:Key, TEXT:Label$` patterns
   * with actual HTML `<a>` tags, ensuring URLs are sanitized.
   * @param body The email body content.
   * @param links An array of `ManagedLink` objects.
   * @returns The email body with links injected.
   */
  private injectLinks(body: string, links: any[]): string {
    let result = body;
    for (const link of links) {
      const safeKey = this.escapeRegex(link.key);
      const safeUrl = this.sanitizeUrl(link.url);
      // Regex to find link patterns like $LINK:Key, TEXT:Label$
      const pattern = new RegExp(
        `\\$LINK:${safeKey},\\s*TEXT:([^\$]+)\\$`,
        'g',
      );
      result = result.replace(pattern, (_match, text) => {
        const safeText = this.htmlEscape(text.trim());
        return `<a href="${safeUrl}">${safeText}</a>`;
      });
    }
    return result;
  }

  /**
   * Renders `[Table]` tags in the email body by asynchronously calling the `TableRenderer` service
   * to convert data ranges into HTML tables.
   * @param body The email body content potentially containing `[Table]` tags.
   * @returns A promise that resolves with the email body with tables rendered.
   */
  private async renderTables(body: string): Promise<string> {
    const regex = createTableTagRegex();

    // Use a custom async replace function to handle promises within the replacement callback.
    return this.replaceAsync(body, regex, async (match, sheetId, rangeRaw) => {
      try {
        // Clean range string (remove quotes if any)
        const range = rangeRaw.replace(/['"]/g, "").trim();
        const cleanSheetId = sheetId.trim();

        if (this.services.tables) {
          return await this.services.tables.renderTable(cleanSheetId, range);
        }
        return match; // Return original match if table service is not available.
      } catch (error: any) {
        this.services.logger.error(
          "EmailEngine",
          `Failed to render table: ${error.message}`,
        );
        // Provide an error message directly in the email body if table rendering fails.
        return `<p style="color:red">[Table Error: ${error.message}]</p>`;
      }
    });
  }

  /**
   * Helper function to perform string replacement with an asynchronous callback.
   * This is necessary because `String.prototype.replace()` does not natively support async functions
   * in its replacer argument.
   * @param str The input string.
   * @param regex The regular expression to match.
   * @param asyncFn An asynchronous function to be called for each match, returning a promise of the replacement string.
   * @returns A promise that resolves with the string after all asynchronous replacements have been made.
   */
  private async replaceAsync(
    str: string,
    regex: RegExp,
    asyncFn: (match: string, ...args: any[]) => Promise<string>,
  ): Promise<string> {
    const promises: Promise<string>[] = [];

    // First pass: collect all promises generated by asyncFn for each match.
    str.replace(regex, (match, ...args) => {
      promises.push(asyncFn(match, ...args));
      return match; // Return original match for now, actual replacement happens after all promises resolve.
    });

    const replacements = await Promise.all(promises);

    // Reset regex index if global flag is set (crucial for second pass!)
    if (regex.global) regex.lastIndex = 0;

    // Second pass: replace with resolved values from the `replacements` array.
    return str.replace(regex, () => replacements.shift() || "");
  }

  /**
   * Validates a template before execution using the `TemplateValidator` service.
   * @param templateName The name of the template to validate.
   * @param sourceId The ID of the source document where the template is located.
   * @returns A promise that resolves with a `ValidationResult` object.
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
   * Strips HTML tags that rich-text editors often inject inside `{{ }}` tokens,
   * which can interfere with token parsing.
   * E.g., `{{ <b>DATE</b>:Today }}` becomes `{{DATE:Today}}`.
   * @param text The input string (e.g., template subject or body).
   * @returns The string with HTML tags removed from within `{{ }}` tokens.
   */
  private healTokens(text: string): string {
    return text.replace(/\{\{(.*?)\}\}/g, (_match, inner: string) => {
      // Remove HTML tags, replace non-breaking spaces, collapse multiple spaces, and trim.
      const clean = inner
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return "{{" + clean + "}}";
    });
  }

  /**
   * Converts an HTML string to plain text, aiming for readability.
   * Replaces common HTML tags like `<br>`, `<p>`, `<li>`, `<tr>`, `<td>` with appropriate
   * plain text equivalents (newlines, bullet points, tabs).
   * @param html The HTML string to convert.
   * @returns The plain text representation of the HTML.
   */
  private htmlToPlainText(html: string): string {
    if (!html) return "";

    return (
      html
        // Replace <br>, <p> with newlines for paragraph breaks.
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<p[^>]*>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        // Replace <li> with bullet points for list items.
        .replace(/<li>/gi, "• ")
        .replace(/<\/li>/gi, "\n")
        // Replace <tr> with newlines for table rows.
        .replace(/<\/tr>/gi, "\n")
        // Replace <td>, <th> with tabs for column separation in tables.
        .replace(/<td[^>]*>/gi, "\t")
        .replace(/<th[^>]*>/gi, "\t")
        // Remove all remaining HTML tags.
        .replace(/<[^>]+>/g, "")
        // Decode common HTML entities to their character equivalents.
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        // Collapse multiple consecutive newlines into at most two for better readability.
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    );
  }
}
