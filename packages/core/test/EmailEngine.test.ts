/**
 * Tests for EmailEngine core functionality
 */

import { EmailEngine } from '../src/services/EmailEngine';
import { PlatformServices, EmailConfig } from '../src';

// Mock implementations for testing
class MockEmailProvider {
  createDraft = jest.fn().mockResolvedValue('draft-123');
  updateDraft = jest.fn().mockResolvedValue(undefined);
  findDraftBySubject = jest.fn().mockResolvedValue(null);
  findThreadBySubject = jest.fn().mockResolvedValue(null);
  createReplyDraft = jest.fn().mockResolvedValue('reply-draft-123');
  sendEmail = jest.fn().mockResolvedValue(undefined);
  getCurrentUserEmail = jest.fn().mockReturnValue('test@example.com');
}

class MockTemplateLoader {
  loadTemplate = jest.fn().mockResolvedValue({
    name: 'Test_Template',
    subject: 'Test Subject: {{Name}}',
    body: 'Hello {{Name}},\n\n{{GREETING}}!\n\nReport date: {{DATE:Today}}\n\nCheck the $LINK:Tracker, TEXT:Project Tracker$\n\n[Table] Sheet: sheet-123, range: A1:B2',
    tags: ['Name'],
    tableRanges: [{ source: 'sheet-123', range: 'A1:B2', preserveFormatting: true }]
  });
  getRawContent = jest.fn().mockResolvedValue('raw content');
}

class MockDataStore {
  getData = jest.fn().mockResolvedValue([['A', 'B'], [1, 2]]);
  getTabData = jest.fn().mockResolvedValue([
    { Email: 'user1@example.com', Name: 'Admin', Role: 'Admin', Team: 'Ops' },
    { Email: 'user2@example.com', Name: 'User', Role: 'User', Team: 'Dev' }
  ]);
  appendRow = jest.fn().mockResolvedValue(undefined);
}

class MockLinkRepository {
  loadLinks = jest.fn().mockResolvedValue([
    { key: 'Tracker', url: 'https://example.com/tracker', label: 'Tracker' }
  ]);
  getLink = jest.fn().mockResolvedValue(null);
}

class MockTableRenderer {
  renderTable = jest.fn().mockResolvedValue('<table><tr><td>Table Data</td></tr></table>');
}

class MockLogger {
  info = jest.fn();
  warn = jest.fn();
  error = jest.fn();
  debug = jest.fn();
}

function createMockServices(): PlatformServices {
  return {
    email: new MockEmailProvider() as any,
    template: new MockTemplateLoader() as any,
    data: new MockDataStore() as any,
    links: new MockLinkRepository() as any,
    tables: new MockTableRenderer() as any,
    logger: new MockLogger() as any
  };
}

describe('EmailEngine', () => {
  let engine: EmailEngine;
  let services: PlatformServices;

  beforeEach(() => {
    services = createMockServices();
    engine = new EmailEngine(services);
  });

  describe('constructor', () => {
    it('should create engine with services', () => {
      expect(engine).toBeDefined();
    });

    it('should accept default config', () => {
      const defaultConfig: Partial<EmailConfig> = {
        emailAction: 'SEND',
        testMode: true
      };
      const engineWithConfig = new EmailEngine(services, defaultConfig);
      expect(engineWithConfig).toBeDefined();
    });
  });

  describe('generateEmailDraft', () => {
    it('should generate draft successfully', async () => {
      const result = await engine.generateEmailDraft('Test_Template', {
        directorySheetId: 'sheet-123',
        recipientsTabName: 'Recipients'
      });

      expect(result.success).toBe(true);
      expect(result.draftId).toBe('draft-123');
      expect(result.recipientCount).toBeGreaterThan(0);
      expect(result.mode).toBe('PROD');
    });

    it('should run in DRY_RUN mode', async () => {
      const result = await engine.generateEmailDraft('Test_Template', {
        dryRun: true
      });

      expect(result.mode).toBe('DRY_RUN');
    });

    it('should run in TEST mode', async () => {
      const result = await engine.generateEmailDraft('Test_Template', {
        testMode: true
      });

      expect(result.mode).toBe('TEST');
      expect(result.recipientCount).toBe(1);
    });

    it('should update existing draft if found', async () => {
      (services.email.findDraftBySubject as jest.Mock).mockResolvedValue('existing-draft-456');
      
      const result = await engine.generateEmailDraft('Test_Template');

      expect(services.email.updateDraft).toHaveBeenCalledWith(
        'existing-draft-456',
        expect.any(String),
        expect.any(String), // Plain text
        expect.any(String)  // HTML
      );
      expect(result.draftId).toBe('existing-draft-456');
    });

    it('should create reply draft if thread is found', async () => {
      (services.email.findDraftBySubject as jest.Mock).mockResolvedValue(null);
      (services.email.findThreadBySubject as jest.Mock).mockResolvedValue('thread-789');
      
      const result = await engine.generateEmailDraft('Test_Template');

      expect(services.email.createReplyDraft).toHaveBeenCalledWith(
        'thread-789',
        expect.any(String), // Plain text
        expect.any(Array),  // CC
        expect.any(Array),  // BCC
        expect.any(String)  // HTML
      );
      expect(result.draftId).toBe('reply-draft-123');
    });

    it('should send email if emailAction is SEND', async () => {
      await engine.generateEmailDraft('Test_Template', {
        emailAction: 'SEND'
      });

      expect(services.email.sendEmail).toHaveBeenCalled();
    });

    it('should handle template not found error', async () => {
      (services.template.loadTemplate as jest.Mock).mockRejectedValue(
        new Error('Template not found')
      );

      const result = await engine.generateEmailDraft('Non_Existent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Template not found');
    });

    it('should handle no recipients error', async () => {
      (services.data.getTabData as jest.Mock).mockResolvedValue([]);

      const result = await engine.generateEmailDraft('Test_Template', {
        directorySheetId: 'sheet-123',
        recipientsTabName: 'Recipients'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No valid recipients');
    });
  });

  describe('generateBatchDrafts', () => {
    it('should generate multiple drafts', async () => {
      const results = await engine.generateBatchDrafts(
        ['Template1', 'Template2'],
        { 
          directorySheetId: 'sheet-123',
          recipientsTabName: 'Recipients'
        }
      );

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });
  });

  describe('template processing', () => {
    it('should replace recipient tags', async () => {
      await engine.generateEmailDraft('Test_Template', {
        directorySheetId: 'sheet-123',
        recipientsTabName: 'Recipients',
        recipientTagColumns: ['Name', 'Role', 'Team']
      });

      // Verify template was processed with recipient data
      expect(services.email.createDraft).toHaveBeenCalledWith(
        expect.stringContaining('Admin'), // Subject should have Role value
        expect.any(String),
        expect.any(Array),
        undefined,
        undefined,
        expect.any(String)
      );
    });

    it('should replace GREETING token based on time', async () => {
      await engine.generateEmailDraft('Test_Template');

      expect(services.email.createDraft).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringMatching(/Good (Morning|Afternoon|Evening)/),
        expect.any(Array),
        undefined,
        undefined,
        expect.any(String)
      );
    });

    it('should replace DATE tokens', async () => {
      await engine.generateEmailDraft('Test_Template');

      const draftCall = (services.email.createDraft as jest.Mock).mock.calls[0];
      const htmlBody = draftCall[5]; // htmlBody is 6th arg
      
      // DATE:Today should be replaced with actual date
      expect(htmlBody).not.toContain('{{DATE:Today}}');
      expect(htmlBody).toMatch(/\d{2}-[A-Za-z]{3}-\d{4}/);
    });

    it('should inject managed links', async () => {
      await engine.generateEmailDraft('Test_Template', {
        linkRepositorySheetId: 'links-123',
        linkRepositoryTabName: 'Links'
      });

      // Verify links were injected
      expect(services.email.createDraft).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Array),
        undefined,
        undefined,
        expect.stringContaining('<a href=')
      );
    });

    it('should render tables', async () => {
      await engine.generateEmailDraft('Test_Template', {
        directorySheetId: 'sheet-123',
        recipientsTabName: 'Recipients'
      });

      expect(services.tables?.renderTable).toHaveBeenCalledWith('sheet-123', 'A1:B2');
      
      const draftCall = (services.email.createDraft as jest.Mock).mock.calls[0];
      const htmlBody = draftCall[5];
      expect(htmlBody).toContain('<table><tr><td>Table Data</td></tr></table>');
    });
  });

  describe('recipient resolution', () => {
    it('should resolve recipients from data store', async () => {
      const result = await engine.generateEmailDraft('Test_Template', {
        directorySheetId: 'sheet-123',
        recipientsTabName: 'Recipients',
        recipientEmailColumn: 'Email',
        recipientTagColumns: ['Role', 'Team']
      });

      expect(result.recipientCount).toBe(2);
    });

    it('should return empty array if no directory configured', async () => {
      const result = await engine.generateEmailDraft('Test_Template');

      // In test mode, still has 1 recipient (current user)
      expect(result.recipientCount).toBe(1);
    });
  });
});
