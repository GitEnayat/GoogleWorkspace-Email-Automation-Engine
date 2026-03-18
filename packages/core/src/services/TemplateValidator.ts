/**
 * Template Validator - Pre-flight validation for parsed templates
 * Ported from legacy/TemplateValidator.js for the v2 core engine.
 */

import { ParsedTemplate, ValidationResult, createTableTagRegex } from "../types";

const KNOWN_COMMANDS = [
  "DATE",
  "RANGE",
  "TIME",
  "MONTHNAME",
  "DATE_FORMAT",
  "GREETING",
  "ACTIVE_SPREADSHEET_LINK",
];

export class TemplateValidator {
  /**
   * Validate a parsed template for common errors and warnings.
   */
  static validate(
    template: ParsedTemplate,
    knownCommands: string[] = KNOWN_COMMANDS,
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const allContent = (template.subject || "") + " " + (template.body || "");

    // Required content
    if (!template.subject?.trim()) {
      errors.push("Template subject is empty");
    }
    if (!template.body?.trim()) {
      warnings.push("Template body is empty");
    }

    // Dictionary tokens
    TemplateValidator.validateDictionaryTokens(allContent, knownCommands, errors);

    // Deprecated / suspicious patterns
    TemplateValidator.checkDeprecatedTokens(allContent, warnings);

    // Mismatched braces
    TemplateValidator.checkMismatchedBraces(allContent, warnings);

    // Table tags
    TemplateValidator.validateTableTags(template.body || "", errors);

    // Link tags
    TemplateValidator.validateLinkTags(template.body || "", warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private static validateDictionaryTokens(
    content: string,
    knownCommands: string[],
    errors: string[],
  ): void {
    const tagRegex = /\{\{([^}]+)\}\}/g;
    let match;

    while ((match = tagRegex.exec(content)) !== null) {
      const fullTag = match[1].trim();
      const parts = fullTag.split(":").map((p) => p.trim());
      const command = parts[0].toUpperCase().replace(/<[^>]+>/g, "").trim();

      // Skip recipient/variable placeholders (e.g. {{FirstName}}, {{SENDER_NAME}})
      if (/^[A-Za-z_]+$/.test(command) && !knownCommands.includes(command)) {
        continue;
      }

      // Check for malformed nested braces
      if (fullTag.includes("{{") || fullTag.includes("}}")) {
        errors.push(
          `Malformed tag (nested braces): "{{${fullTag}}}"`,
        );
      }

      // DATE_FORMAT requires a format string
      if (command === "DATE_FORMAT" && !parts[2]) {
        errors.push(
          `DATE_FORMAT missing format string: "{{${fullTag}}}" (expected: {{DATE_FORMAT:Today:dd/MM/yyyy}})`,
        );
      }
    }
  }

  private static checkDeprecatedTokens(
    content: string,
    warnings: string[],
  ): void {
    if (content.includes("{DATE:") && !content.includes("{{DATE:")) {
      warnings.push(
        'Found single-brace {DATE:...} — did you mean {{DATE:...}}?',
      );
    }
  }

  private static checkMismatchedBraces(
    content: string,
    warnings: string[],
  ): void {
    const openCount = (content.match(/\{\{/g) || []).length;
    const closeCount = (content.match(/\}\}/g) || []).length;
    if (openCount !== closeCount) {
      warnings.push(
        `Mismatched dictionary tags: ${openCount} opening '{{' vs ${closeCount} closing '}}'`,
      );
    }
  }

  private static validateTableTags(
    body: string,
    errors: string[],
  ): void {
    const regex = createTableTagRegex();
    let match;

    while ((match = regex.exec(body)) !== null) {
      const sheetRef = match[1].trim();
      const rangeRef = match[2].trim().replace(/<[^>]+>/g, "");

      // Sheet reference should be a URL or a 25+ char ID
      if (!sheetRef.match(/[-\w]{25,}/) && !sheetRef.match(/^https?:\/\//)) {
        errors.push(
          `Table tag: invalid sheet reference "${sheetRef}" (expected URL or Sheet ID)`,
        );
      }

      // Range should be in A1 notation: 'Sheet'!A1:D10
      const rangePattern = /^['"]?[^!'"]+['"]?![A-Z]+\d+:[A-Z]+\d+$/;
      if (!rangePattern.test(rangeRef)) {
        errors.push(
          `Table tag: invalid range "${rangeRef}" (expected format: 'Sheet'!A1:D10)`,
        );
      }
    }
  }

  private static validateLinkTags(
    body: string,
    warnings: string[],
  ): void {
    const linkTags = body.match(/\$LINK:.*?\$/g) || [];

    for (const tag of linkTags) {
      if (!tag.includes("TEXT:")) {
        warnings.push(
          `Link tag may be malformed: "${tag.substring(0, 50)}" (expected: $LINK:Key, TEXT:Label$)`,
        );
      }
    }
  }
}
