const createMockApi = (returnValue: any = {}) => {
  const chain = {
    get: jest.fn().mockResolvedValue(returnValue),
    post: jest.fn().mockResolvedValue(returnValue),
    patch: jest.fn().mockResolvedValue(returnValue),
    filter: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    top: jest.fn().mockReturnThis(),
  };
  return jest.fn(() => chain);
};

import { NodeMicrosoftEmailProvider } from '../providers/NodeMicrosoftEmailProvider';

describe('NodeMicrosoftEmailProvider', () => {
  describe('createDraft', () => {
    it('should call POST /me/mailFolders/drafts/messages with correct payload', async () => {
      const mockChain = {
        post: jest.fn().mockResolvedValue({ id: 'draft-123' }),
      };
      const mockApi = jest.fn(() => mockChain);
      const mockClient = { api: mockApi };
      
      const provider = new NodeMicrosoftEmailProvider(mockClient as any, 'me');

      const result = await provider.createDraft(
        'Test Subject',
        'Test Body',
        ['recipient@example.com'],
        ['cc@example.com'],
        ['bcc@example.com'],
        '<p>HTML Body</p>'
      );

      expect(mockApi).toHaveBeenCalledWith('/me/mailFolders/drafts/messages');
      expect(mockChain.post).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Test Subject',
          toRecipients: [{ emailAddress: { address: 'recipient@example.com' } }],
          ccRecipients: [{ emailAddress: { address: 'cc@example.com' } }],
          bccRecipients: [{ emailAddress: { address: 'bcc@example.com' } }],
          isDraft: true
        })
      );
      expect(result).toBe('draft-123');
    });

    it('should format recipients correctly', async () => {
      const mockChain = {
        post: jest.fn().mockResolvedValue({ id: 'draft-123' }),
      };
      const mockApi = jest.fn(() => mockChain);
      const mockClient = { api: mockApi };
      
      const provider = new NodeMicrosoftEmailProvider(mockClient as any, 'me');

      await provider.createDraft('Subject', 'Body', ['a@test.com', 'b@test.com']);

      expect(mockChain.post).toHaveBeenCalledWith(
        expect.objectContaining({
          toRecipients: [
            { emailAddress: { address: 'a@test.com' } },
            { emailAddress: { address: 'b@test.com' } }
          ]
        })
      );
    });
  });

  describe('sendEmail', () => {
    it('should send via draft when draftId provided', async () => {
      const mockChain = {
        post: jest.fn().mockResolvedValue({}),
      };
      const mockApi = jest.fn(() => mockChain);
      const mockClient = { api: mockApi };
      
      const provider = new NodeMicrosoftEmailProvider(mockClient as any, 'me');

      await provider.sendEmail('draft-123');

      expect(mockApi).toHaveBeenCalledWith('/me/messages/draft-123/send');
      expect(mockChain.post).toHaveBeenCalledWith({});
    });

    it('should send directly when to, subject, body provided', async () => {
      const mockChain = {
        post: jest.fn().mockResolvedValue({}),
      };
      const mockApi = jest.fn(() => mockChain);
      const mockClient = { api: mockApi };
      
      const provider = new NodeMicrosoftEmailProvider(mockClient as any, 'me');

      await provider.sendEmail(undefined, ['to@test.com'], 'Subject', 'Body');

      expect(mockApi).toHaveBeenCalledWith('/me/sendMail');
      expect(mockChain.post).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.objectContaining({
            subject: 'Subject',
            toRecipients: [{ emailAddress: { address: 'to@test.com' } }]
          })
        })
      );
    });
  });

  describe('findDraftBySubject', () => {
    it('should filter by subject and return draft id', async () => {
      const mockGet = jest.fn().mockResolvedValue({ value: [{ id: 'found-draft' }] });
      const mockChain = {
        filter: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        top: jest.fn().mockReturnThis(),
        get: mockGet,
      };
      const mockApi = jest.fn(() => mockChain);
      const mockClient = { api: mockApi };
      
      const provider = new NodeMicrosoftEmailProvider(mockClient as any, 'me');

      const result = await provider.findDraftBySubject('Test Subject');

      expect(mockApi).toHaveBeenCalledWith('/me/mailFolders/drafts/messages');
      expect(mockChain.filter).toHaveBeenCalledWith("subject eq 'Test Subject'");
      expect(result).toBe('found-draft');
    });

    it('should return null when no draft found', async () => {
      const mockGet = jest.fn().mockResolvedValue({ value: [] });
      const mockChain = {
        filter: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        top: jest.fn().mockReturnThis(),
        get: mockGet,
      };
      const mockApi = jest.fn(() => mockChain);
      const mockClient = { api: mockApi };
      
      const provider = new NodeMicrosoftEmailProvider(mockClient as any, 'me');

      const result = await provider.findDraftBySubject('Nonexistent');

      expect(result).toBeNull();
    });
  });
});
