/**
 * Template Validator - Pre-flight validation for parsed templates.
 * Provides static methods to check templates for common errors, deprecated patterns,
 * and structural issues before email generation.
 */

import { ParsedTemplate, ValidationResult, createTableTagRegex } from "../types";

/**
 * A list of known commands that are recognized within the template's dictionary tokens.
 * This helps differentiate valid commands from potentially malformed or unrecognized tags.
 */
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
   * Validates a parsed template for common errors and warnings,
   * including empty content, malformed tokens, deprecated patterns,
   * mismatched braces, and incorrect table/link tag formats.
   * @param template The `ParsedTemplate` object to validate.
   * @param knownCommands An optional array of recognized commands to check against dictionary tokens.
   * @returns A `ValidationResult` object indicating validity and listing any errors or warnings.
   */
  static validate(
    template: ParsedTemplate,
    knownCommands: string[] = KNOWN_COMMANDS,
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Combine subject and body for comprehensive content validation.
    const allContent = (template.subject || "") + " " + (template.body || "");

    // Required content checks
    if (!template.subject?.trim()) {
      errors.push("Template subject is empty");
    }
    if (!template.body?.trim()) {
      warnings.push("Template body is empty");
    }

    // Dictionary tokens validation (e.g., {{DATE:Today}})
    TemplateValidator.validateDictionaryTokens(allContent, knownCommands, errors);

    // Deprecated / suspicious patterns (e.g., single braces)
    TemplateValidator.checkDeprecatedTokens(allContent, warnings);

    // Mismatched braces (e.g., `{{` without `}}`)
    TemplateValidator.checkMismatchedBraces(allContent, warnings);

    // Table tags validation (e.g., `[Table] Sheet: URL, range: 'Tab'!A1:D10`)
    TemplateValidator.validateTableTags(template.body || "", errors);

    // Link tags validation (e.g., `$LINK:Key, TEXT:Label$`)
    TemplateValidator.validateLinkTags(template.body || "", warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validates dictionary tokens within the template content.
   * Checks for malformed nested braces and missing parameters for specific commands.
   * @param content The string content (subject or body) to scan for dictionary tokens.
   * @param knownCommands An array of strings representing recognized commands.
   * @param errors The array to which validation errors will be added.
   * @returns {void}
   */
  private static validateDictionaryTokens(
    content: string,
    knownCommands: string[],
    errors: string[],
  ): void {
    const tagRegex = /\{\{([^}]+)\}\}/g; // Matches content inside {{...}}
    let match;

    while ((match = tagRegex.exec(content)) !== null) {
      const fullTag = match[1].trim();
      const parts = fullTag.split(":").map((p) => p.trim());
      // Extract command, cleaning up any HTML tags that might be inside.
      const command = parts[0].toUpperCase().replace(/<[^>]+>/g, "").trim();

      // Skip recipient/variable placeholders (e.g., {{FirstName}}, {{SENDER_NAME}})
      // These are dynamic tags and are not part of the fixed command set.
      if (/^[A-Za-z_]+$/.test(command) && !knownCommands.includes(command)) {
        continue;
      }

      // Check for malformed nested braces within a token.
      if (fullTag.includes("{{") || fullTag.includes("}}")) {
        errors.push(
          `Malformed tag (nested braces): "{{${fullTag}}}"`,
        );
      }

      // Specific validation for DATE_FORMAT: it requires a format string.
      if (command === "DATE_FORMAT" && !parts[2]) {
        errors.push(
          `DATE_FORMAT missing format string: "{{${fullTag}}}" (expected: {{DATE_FORMAT:Today:dd/MM/yyyy}})`,
        );
      }
    }
  }

  /**
   * Checks for deprecated or suspicious token patterns, such as single-brace tokens.
   * @param content The string content to scan.
   * @param warnings The array to which validation warnings will be added.
   * @returns {void}
   */
  private static checkDeprecatedTokens(
    content: string,
    warnings: string[],
  ): void {
    // Warn if single-brace {DATE:...} is found but not double-brace {{DATE:...}}, suggesting a typo.
    if (content.includes("{DATE:") && !content.includes("{{DATE:")) {
      warnings.push(
        'Found single-brace {DATE:...} — did you mean {{DATE:...}}?',
      );
    }
  }

  /**
   * Checks for mismatched opening and closing braces (`{{` and `}}`).
   * @param content The string content to scan.
   * @param warnings The array to which validation warnings will be added.
   * @returns {void}
   */
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

  /**
   * Validates `[Table]` tags in the email body for correct sheet reference and A1 range notation.
   * @param body The email body content to scan.
   * @param errors The array to which validation errors will be added.
   * @returns {void}
   */
  private static validateTableTags(
    body: string,
    errors: string[],
  ): void {
    const regex = createTableTagRegex();
    let match;

    while ((match = regex.exec(body)) !== null) {
      const sheetRef = match[1].trim();
      // Clean up HTML tags potentially embedded in the range reference by rich text editors.
      const rangeRef = match[2].trim().replace(/<[^>]+>/g, "");

      // Sheet reference should either be a Google Sheet ID (25+ chars alphanumeric) or a full URL.
      if (!sheetRef.match(/[-\w]{25,}/) && !sheetRef.match(/^https?:\/\//)) {
        errors.push(
          `Table tag: invalid sheet reference "${sheetRef}" (expected URL or Sheet ID)`,
        );
      }

      // Range should be in A1 notation, typically 'SheetName'!A1:D10.
      const rangePattern = /^['"]?[^!'"]+['"]?![A-Z]+\d+:[A-Z]+\d+$/;
      if (!rangePattern.test(rangeRef)) {
        errors.push(
          `Table tag: invalid range "${rangeRef}" (expected format: 'Sheet'!A1:D10)`,
        );
      }
    }
  }

  /**
   * Validates `$LINK` tags in the email body, specifically checking for the presence of `TEXT:`.
   * @param body The email body content to scan.
   * @param warnings The array to which validation warnings will be added.
   * @returns {void}
   */
  private static validateLinkTags(
    body: string,
    warnings: string[],
  ): void {
    const linkTags = body.match(/\$LINK:.*?\$/g) || [];

    for (const tag of linkTags) {
      // Warn if "TEXT:" keyword is missing, as it's typically required for link labels.
      if (!tag.includes("TEXT:")) {
        warnings.push(
          `Link tag may be malformed: "${tag.substring(0, 50)}" (expected: $LINK:Key, TEXT:Label$)`,
        );
      }
    }
  }
}
