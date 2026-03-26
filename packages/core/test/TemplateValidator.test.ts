import { TemplateValidator } from '../src/services/TemplateValidator';
import { ParsedTemplate } from '../src/types';

describe('TemplateValidator', () => {
  // Helper to call private static methods
  const priv = (method: string, ...args: any[]) =>
    (TemplateValidator as any)[method](...args);

  describe('validateDictionaryTokens', () => {
    it('passes for known command tokens', () => {
      const errors: string[] = [];
      priv('validateDictionaryTokens', '{{DATE:Today}} {{TIME:Now}}', ['DATE', 'TIME'], errors);
      expect(errors).toHaveLength(0);
    });

    it('passes for variable placeholders like {{FirstName}}', () => {
      const errors: string[] = [];
      priv('validateDictionaryTokens', 'Hello {{FirstName}}, from {{SENDER_NAME}}', ['DATE'], errors);
      expect(errors).toHaveLength(0);
    });

    it('errors on malformed nested braces', () => {
      const errors: string[] = [];
      priv('validateDictionaryTokens', '{{DATE:{{Today}}}}', ['DATE'], errors);
      expect(errors).toContain('Malformed tag (nested braces): "{{DATE:{{Today}}"');
    });

    it('errors on DATE_FORMAT missing format string', () => {
      const errors: string[] = [];
      priv('validateDictionaryTokens', '{{DATE_FORMAT:Today}}', ['DATE_FORMAT'], errors);
      expect(errors).toContain(
        'DATE_FORMAT missing format string: "{{DATE_FORMAT:Today}}" (expected: {{DATE_FORMAT:Today:dd/MM/yyyy}})',
      );
    });

    it('passes for DATE_FORMAT with proper format string', () => {
      const errors: string[] = [];
      priv('validateDictionaryTokens', '{{DATE_FORMAT:Today:dd/MM/yyyy}}', ['DATE_FORMAT'], errors);
      expect(errors).toHaveLength(0);
    });

    it('handles tags with extra whitespace', () => {
      const errors: string[] = [];
      priv('validateDictionaryTokens', '{{ DATE:Today }}', ['DATE'], errors);
      expect(errors).toHaveLength(0);
    });
  });

  describe('checkDeprecatedTokens', () => {
    it('passes when no deprecated tokens present', () => {
      const warnings: string[] = [];
      priv('checkDeprecatedTokens', '{{DATE:Today}} {{TIME:Now}}', warnings);
      expect(warnings).toHaveLength(0);
    });

    it('warns on single-brace DATE pattern', () => {
      const warnings: string[] = [];
      priv('checkDeprecatedTokens', '{DATE:Today} is the date', warnings);
      expect(warnings).toContain("Found single-brace {DATE:...} — did you mean {{DATE:...}}?");
    });

    it('does not warn when double-brace DATE is also present', () => {
      const warnings: string[] = [];
      priv('checkDeprecatedTokens', '{DATE:Today} and {{DATE:Tomorrow}}', warnings);
      expect(warnings).toHaveLength(0);
    });

    it('passes for content with no DATE at all', () => {
      const warnings: string[] = [];
      priv('checkDeprecatedTokens', 'Hello world', warnings);
      expect(warnings).toHaveLength(0);
    });
  });

  describe('checkMismatchedBraces', () => {
    it('passes when braces are balanced', () => {
      const warnings: string[] = [];
      priv('checkMismatchedBraces', '{{DATE:Today}} and {{TIME:Now}}', warnings);
      expect(warnings).toHaveLength(0);
    });

    it('passes with no braces', () => {
      const warnings: string[] = [];
      priv('checkMismatchedBraces', 'Plain text', warnings);
      expect(warnings).toHaveLength(0);
    });

    it('warns on more opening than closing braces', () => {
      const warnings: string[] = [];
      priv('checkMismatchedBraces', '{{DATE:Today and {{TIME:Now}}', warnings);
      expect(warnings).toContain("Mismatched dictionary tags: 2 opening '{{' vs 1 closing '}}'");
    });

    it('warns on more closing than opening braces', () => {
      const warnings: string[] = [];
      priv('checkMismatchedBraces', '{{DATE:Today}} and TIME:Now}}', warnings);
      expect(warnings).toContain("Mismatched dictionary tags: 1 opening '{{' vs 2 closing '}}'");
    });
  });

  describe('validateTableTags', () => {
    // Table tag format matched by createTableTagRegex():
    //   [Table] <sheetIdOrUrl>, 'SheetName'!A1:D10
    it('passes for valid table tag with URL and proper range', () => {
      const errors: string[] = [];
      priv('validateTableTags', "[Table] https://sheets.google.com/abc, 'Sheet1'!A1:D10", errors);
      expect(errors).toHaveLength(0);
    });

    it('passes for valid table tag with 25+ char sheet ID', () => {
      const errors: string[] = [];
      priv('validateTableTags', "[Table] abcdefghijklmnopqrstuvwxy1, 'Data'!A1:Z100", errors);
      expect(errors).toHaveLength(0);
    });

    it('errors on short/invalid sheet reference', () => {
      const errors: string[] = [];
      priv('validateTableTags', "[Table] short, 'Sheet'!A1:B2", errors);
      expect(errors.some(e => e.includes('invalid sheet reference'))).toBe(true);
    });

    it('errors on range missing sheet name (bare A1:B2)', () => {
      const errors: string[] = [];
      priv('validateTableTags', '[Table] https://sheets.google.com/abc, A1:B2', errors);
      expect(errors.some(e => e.includes('invalid range'))).toBe(true);
    });

    it('errors on invalid range format', () => {
      const errors: string[] = [];
      priv('validateTableTags', '[Table] https://sheets.google.com/abc, InvalidRange', errors);
      expect(errors.some(e => e.includes('invalid range'))).toBe(true);
    });

    it('handles body without any table tags', () => {
      const errors: string[] = [];
      priv('validateTableTags', 'No table tags here', errors);
      expect(errors).toHaveLength(0);
    });
  });

  describe('validateLinkTags', () => {
    it('passes for valid link tag with TEXT', () => {
      const warnings: string[] = [];
      priv('validateLinkTags', 'Click: $LINK:UrlKey, TEXT:Click Me$', warnings);
      expect(warnings).toHaveLength(0);
    });

    it('warns on link tag missing TEXT', () => {
      const warnings: string[] = [];
      priv('validateLinkTags', '$LINK:UrlKey$', warnings);
      expect(warnings).toContain(
        'Link tag may be malformed: "$LINK:UrlKey$" (expected: $LINK:Key, TEXT:Label$)',
      );
    });

    it('warns only on malformed tags in mixed content', () => {
      const warnings: string[] = [];
      priv('validateLinkTags', '$LINK:Key1, TEXT:Label1$ and $LINK:Key2$', warnings);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('$LINK:Key2$');
    });

    it('handles body without link tags', () => {
      const warnings: string[] = [];
      priv('validateLinkTags', 'No link tags here', warnings);
      expect(warnings).toHaveLength(0);
    });
  });

  describe('validate (public API)', () => {
    const base: ParsedTemplate = { name: 'test', subject: 'Subject', body: 'Body', tags: [] };

    it('returns valid for a well-formed template', () => {
      const result = TemplateValidator.validate(base);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('errors on empty subject', () => {
      const result = TemplateValidator.validate({ ...base, subject: '' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Template subject is empty');
    });

    it('errors on whitespace-only subject', () => {
      const result = TemplateValidator.validate({ ...base, subject: '   ' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Template subject is empty');
    });

    it('warns on empty body', () => {
      const result = TemplateValidator.validate({ ...base, body: '' });
      expect(result.warnings).toContain('Template body is empty');
    });

    it('warns on whitespace-only body', () => {
      const result = TemplateValidator.validate({ ...base, body: '   ' });
      expect(result.warnings).toContain('Template body is empty');
    });

    it('warns on single-brace DATE in body', () => {
      const result = TemplateValidator.validate({ ...base, body: '{DATE:Today}' });
      expect(result.warnings).toContain("Found single-brace {DATE:...} — did you mean {{DATE:...}}?");
    });

    it('warns on mismatched braces', () => {
      const result = TemplateValidator.validate({ ...base, body: '{{DATE:Today' });
      expect(result.warnings.some(w => w.includes('Mismatched'))).toBe(true);
    });

    it('uses custom known commands', () => {
      const result = TemplateValidator.validate(
        { ...base, body: '{{CUSTOM_CMD:Value}}' },
        ['CUSTOM_CMD'],
      );
      expect(result.valid).toBe(true);
    });

    it('collects both errors and warnings together', () => {
      const result = TemplateValidator.validate({ ...base, subject: '', body: '{DATE:Old}' });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});
