/**
 * Jest tests for EmailEngine
 * Tests the main orchestration class for email generation
 */

import { EmailEngine } from '../src/services/EmailEngine';
import { PlatformServices } from '../src/providers';
import { EmailConfig, ParsedTemplate, Recipient, ManagedLink } from '../src/types';

// Mock types for jest.fn()
type MockEmailProvider = {
  createDraft: jest.Mock<Promise<string>, [string, string, string[], string?, string?, string?]>;
  updateDraft: jest.Mock<Promise<void>, [string, string, string, string?]>;
  findDraftBySubject: jest.Mock<Promise<string | null>, [string]>;
  findThreadBySubject: jest.Mock<Promise<string | null>, [string]>;
  createReplyDraft: jest.Mock<Promise<string>, [string, string, string[], string[], string?]>;
  sendEmail: jest.Mock<Promise<void>, [string | undefined, string[], string | undefined, string | undefined]>;
  getCurrentUserEmail: jest.Mock<string, []>;
};

type MockTemplateLoader = {
  loadTemplate: jest.Mock<Promise<ParsedTemplate>, [string, string]>;
  getRawContent: jest.Mock<Promise<string>, [string, string]>;
};

type MockDataStore = {
  getData: jest.Mock<Promise<any[][]>, [string, string]>;
  getTabData: jest.Mock<Promise<Record<string, any>[]>, [string, string]>;
  appendRow: jest.Mock<Promise<void>, [string, string, any[]]>;
};

type MockLinkRepository = {
  loadLinks: jest.Mock<Promise<ManagedLink[]>, [string, string]>;
  getLink: jest.Mock<Promise<ManagedLink | null>, [string]>;
};

type MockLogger = {
  info: jest.Mock<void, [string, string, Record<string, any>?]>;
  warn: jest.Mock<void, [string, string, Record<string, any>?]>;
  error: jest.Mock<void, [string, string, Record<string, any>?]>;
  debug: jest.Mock<void, [string, string, Record<string, any>?]>;
};

type MockPlatformServices = {
  email: MockEmailProvider;
  template: MockTemplateLoader;
  data: MockDataStore;
  links: MockLinkRepository;
  logger: MockLogger;
};

describe('EmailEngine', () => {
  let mockServices: MockPlatformServices;
  let engine: EmailEngine;

  const mockTemplate: ParsedTemplate = {
    name: 'tpl',
    subject: 'Test Subject',
    body: 'Hello {{FirstName}}',
    tags: ['FirstName'],
    tableRanges: [],
  };

  // Flat row format matching what getTabData returns from the spreadsheet
  const mockRecipients: Record<string, any>[] = [
    { Email: 'r@test.com', FirstName: 'Alice' },
  ];

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Email provider mocks
    mockServices = {
      email: {
        createDraft: jest.fn().mockResolvedValue('draft-123'),
        updateDraft: jest.fn().mockResolvedValue(undefined),
        findDraftBySubject: jest.fn().mockResolvedValue(null),
        findThreadBySubject: jest.fn().mockResolvedValue(null),
        createReplyDraft: jest.fn().mockResolvedValue('reply-draft-123'),
        sendEmail: jest.fn().mockResolvedValue(undefined),
        getCurrentUserEmail: jest.fn().mockReturnValue('user@test.com'),
      },
      template: {
        loadTemplate: jest.fn().mockResolvedValue(mockTemplate),
        getRawContent: jest.fn().mockResolvedValue('raw content'),
      },
      data: {
        getData: jest.fn().mockResolvedValue([]),
        // Return recipients for the Recipients tab, empty for settings tab
        getTabData: jest.fn().mockImplementation((_sheetId: string, tabName: string) =>
          Promise.resolve(tabName === 'Recipients' ? mockRecipients : [])
        ),
        appendRow: jest.fn().mockResolvedValue(undefined),
      },
      links: {
        loadLinks: jest.fn().mockResolvedValue([]),
        getLink: jest.fn().mockResolvedValue(null),
      },
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
    };

    engine = new EmailEngine(mockServices as unknown as PlatformServices, {
      directorySheetId: 'sheet-123',
      recipientsTabName: 'Recipients',
      recipientEmailColumn: 'Email',
      recipientTagColumns: ['FirstName'],
    });
  });

  describe('DRY_RUN mode', () => {
    it('should NOT call email.createDraft when dryRun is true', async () => {
      const config: Partial<EmailConfig> = {
        dryRun: true,
        directorySheetId: 'sheet-123',
        recipientsTabName: 'Recipients',
      };

      const result = await engine.generateEmailDraft('test-template', config);

      // Verify draft was not created
      expect(mockServices.email.createDraft).not.toHaveBeenCalled();
      
      // Verify result indicates dry run
      expect(result.success).toBe(true);
      expect(result.mode).toBe('DRY_RUN');
      expect(result.draftIds).toEqual(['dry-run-draft-id']);
    });

    it('should still load template and resolve recipients in DRY_RUN', async () => {
      const config: Partial<EmailConfig> = {
        dryRun: true,
      };

      await engine.generateEmailDraft('test-template', config);

      expect(mockServices.template.loadTemplate).toHaveBeenCalledWith(
        'test-template',
        ''
      );
      expect(mockServices.data.getTabData).toHaveBeenCalledWith(
        'sheet-123',
        'Recipients'
      );
    });
  });

  describe('TEST mode', () => {
    it('should call createDraft with getCurrentUserEmail result when testMode is true', async () => {
      const config: Partial<EmailConfig> = {
        testMode: true,
        directorySheetId: 'sheet-123',
        recipientsTabName: 'Recipients',
      };

      const result = await engine.generateEmailDraft('test-template', config);

      // Verify draft was created with test user email
      expect(mockServices.email.createDraft).toHaveBeenCalledWith(
        'Test Subject',
        'Hello Alice',
        ['user@test.com'],
        undefined,
        undefined,
        'Hello Alice'
      );

      // Verify result
      expect(result.success).toBe(true);
      expect(result.mode).toBe('TEST');
      expect(result.draftIds).toEqual(['draft-123']);
      expect(result.recipientCount).toBe(1);
    });

    it('should use test user email even when recipients exist in data source', async () => {
      const config: Partial<EmailConfig> = {
        testMode: true,
      };

      await engine.generateEmailDraft('test-template', config);

      // Should still load recipients but override with test user
      expect(mockServices.data.getTabData).toHaveBeenCalled();
      expect(mockServices.email.createDraft).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        ['user@test.com'],
        undefined,
        undefined,
        expect.any(String)
      );
    });
  });

  describe('PROD mode', () => {
    it('should call createDraft with recipient from dataStore', async () => {
      const config: Partial<EmailConfig> = {
        directorySheetId: 'sheet-123',
        recipientsTabName: 'Recipients',
      };

      const result = await engine.generateEmailDraft('test-template', config);

      // Verify draft was created with actual recipient
      expect(mockServices.email.createDraft).toHaveBeenCalledWith(
        'Test Subject',
        'Hello Alice',
        ['r@test.com'],
        undefined,
        undefined,
        'Hello Alice'
      );

      // Verify result
      expect(result.success).toBe(true);
      expect(result.mode).toBe('PROD');
      expect(result.draftIds).toEqual(['draft-123']);
      expect(result.recipientCount).toBe(1);
    });

    it('should update existing draft if found by subject', async () => {
      mockServices.email.findDraftBySubject.mockResolvedValue('existing-draft-456');

      const config: Partial<EmailConfig> = {
        directorySheetId: 'sheet-123',
        recipientsTabName: 'Recipients',
      };

      await engine.generateEmailDraft('test-template', config);

      // Should update instead of create
      expect(mockServices.email.createDraft).not.toHaveBeenCalled();
      expect(mockServices.email.updateDraft).toHaveBeenCalledWith(
        'existing-draft-456',
        'Test Subject',
        'Hello Alice',
        'Hello Alice'
      );
    });

    it('should create reply draft if thread exists and createReplyDraft is available', async () => {
      mockServices.email.findDraftBySubject.mockResolvedValue(null);
      mockServices.email.findThreadBySubject.mockResolvedValue('thread-789');

      const config: Partial<EmailConfig> = {
        directorySheetId: 'sheet-123',
        recipientsTabName: 'Recipients',
      };

      await engine.generateEmailDraft('test-template', config);

      // Should create reply instead of new draft
      expect(mockServices.email.createDraft).not.toHaveBeenCalled();
      expect(mockServices.email.createReplyDraft).toHaveBeenCalledWith(
        'thread-789',
        'Hello Alice',
        [],
        [],
        'Hello Alice'
      );
    });

    it('should send email if emailAction is SEND', async () => {
      const config: Partial<EmailConfig> = {
        directorySheetId: 'sheet-123',
        recipientsTabName: 'Recipients',
        emailAction: 'SEND',
      };

      await engine.generateEmailDraft('test-template', config);

      expect(mockServices.email.sendEmail).toHaveBeenCalledWith('draft-123');
    });

    it('should NOT send email if emailAction is not SEND', async () => {
      const config: Partial<EmailConfig> = {
        directorySheetId: 'sheet-123',
        recipientsTabName: 'Recipients',
        emailAction: 'DRAFT',
      };

      await engine.generateEmailDraft('test-template', config);

      expect(mockServices.email.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('Template processing', () => {
    it('should apply recipient tags to template', async () => {
      const config: Partial<EmailConfig> = {
        directorySheetId: 'sheet-123',
        recipientsTabName: 'Recipients',
      };

      await engine.generateEmailDraft('test-template', config);

      expect(mockServices.email.createDraft).toHaveBeenCalledWith(
        expect.any(String),
        'Hello Alice',
        expect.any(Array),
        undefined,
        undefined,
        'Hello Alice'
      );
    });

    it('should apply date tokens in template', async () => {
      const templateWithDate: ParsedTemplate = {
        ...mockTemplate,
        body: 'Meeting on {{DATE:Today}}',
      };
      mockServices.template.loadTemplate.mockResolvedValue(templateWithDate);

      const config: Partial<EmailConfig> = {
        directorySheetId: 'sheet-123',
        recipientsTabName: 'Recipients',
      };

      await engine.generateEmailDraft('test-template', config);

      const callArgs = mockServices.email.createDraft.mock.calls[0];
      const body = callArgs[1]; // plain text body (index 1, after subject)
      expect(body).toContain('Meeting on');
    });

    it('should apply greeting based on time of day', async () => {
      const templateWithGreeting: ParsedTemplate = {
        ...mockTemplate,
        body: '{{GREETING}} {{FirstName}}',
      };
      mockServices.template.loadTemplate.mockResolvedValue(templateWithGreeting);

      const config: Partial<EmailConfig> = {
        directorySheetId: 'sheet-123',
        recipientsTabName: 'Recipients',
      };

      await engine.generateEmailDraft('test-template', config);

      const callArgs = mockServices.email.createDraft.mock.calls[0];
      const body = callArgs[5]; // html body
      expect(body).toMatch(/Good (Morning|Afternoon|Evening) Alice/);
    });
  });

  describe('Error handling', () => {
    it('should return failure result when template loading fails', async () => {
      mockServices.template.loadTemplate.mockRejectedValue(new Error('Template not found'));

      const config: Partial<EmailConfig> = {
        dryRun: true,
      };

      const result = await engine.generateEmailDraft('non-existent-template', config);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Template not found');
      expect(mockServices.logger.error).toHaveBeenCalled();
    });

    it('should return failure result when no recipients found', async () => {
      mockServices.data.getTabData.mockResolvedValue([]);

      const config: Partial<EmailConfig> = {
        directorySheetId: 'sheet-123',
        recipientsTabName: 'Recipients',
      };

      const result = await engine.generateEmailDraft('test-template', config);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No valid recipients found');
    });

    it('should return failure result when email creation fails', async () => {
      mockServices.email.createDraft.mockRejectedValue(new Error('Email service unavailable'));

      const config: Partial<EmailConfig> = {
        testMode: true,
      };

      const result = await engine.generateEmailDraft('test-template', config);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email service unavailable');
    });
  });

  describe('Batch processing', () => {
    it('should generate drafts for multiple templates', async () => {
      const config: Partial<EmailConfig> = {
        testMode: true,
        batchDelayMs: 0, // Skip delay for faster tests
      };

      const results = await engine.generateBatchDrafts(
        ['template-1', 'template-2'],
        config
      );

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(mockServices.email.createDraft).toHaveBeenCalledTimes(2);
    });

    it('should add delay between template processing', async () => {
      const config: Partial<EmailConfig> = {
        testMode: true,
        batchDelayMs: 100,
      };

      const startTime = Date.now();
      await engine.generateBatchDrafts(['template-1', 'template-2'], config);
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Locale and settings', () => {
    it('should use default locale when no settings provided', async () => {
      const config: Partial<EmailConfig> = {
        testMode: true,
      };

      await engine.generateEmailDraft('test-template', config);

      // Should use system timezone and default locale
      expect(mockServices.template.loadTemplate).toHaveBeenCalled();
      expect(mockServices.email.createDraft).toHaveBeenCalled();
    });

    it('should apply custom locale from config', async () => {
      const config: Partial<EmailConfig> = {
        testMode: true,
        locale: {
          timezone: 'America/New_York',
          locale: 'en-US',
          dateFormat: 'MM/dd/yyyy',
          timeFormat: '12h',
          weekStartDay: 0,
        },
      };

      await engine.generateEmailDraft('test-template', config);

      expect(mockServices.email.createDraft).toHaveBeenCalled();
    });
  });

  describe('Link injection', () => {
    it('should inject managed links when linkRepositorySheetId is configured', async () => {
      const mockLinks: ManagedLink[] = [
        { key: 'website', url: 'https://example.com' },
      ];
      mockServices.links.loadLinks.mockResolvedValue(mockLinks);

      const templateWithLink: ParsedTemplate = {
        ...mockTemplate,
        body: 'Visit $LINK:website, TEXT:our website$',
      };
      mockServices.template.loadTemplate.mockResolvedValue(templateWithLink);

      const config: Partial<EmailConfig> = {
        testMode: true,
        linkRepositorySheetId: 'links-sheet-123',
        linkRepositoryTabName: 'Link_Registry',
      };

      await engine.generateEmailDraft('test-template', config);

      expect(mockServices.links.loadLinks).toHaveBeenCalledWith(
        'links-sheet-123',
        'Link_Registry'
      );

      const callArgs = mockServices.email.createDraft.mock.calls[0];
      const body = callArgs[5]; // html body
      expect(body).toContain('<a href="https://example.com">our website</a>');
    });
  });

  describe('Validation', () => {
    it('should validate template before execution', async () => {
      const result = await engine.validateTemplate('test-template', 'source-123');

      expect(mockServices.template.loadTemplate).toHaveBeenCalledWith(
        'test-template',
        'source-123'
      );
      expect(result).toHaveProperty('valid');
    });
  });
});
