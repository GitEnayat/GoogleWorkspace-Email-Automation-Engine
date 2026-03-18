import { NodeMicrosoftOneDriveTemplateLoader } from '../providers/NodeMicrosoftOneDriveTemplateLoader';

const createMockClient = () => {
  const mockApi = jest.fn(() => ({
    get: jest.fn().mockResolvedValue('<html>content</html>')
  }));
  return { api: mockApi };
};

describe('NodeMicrosoftOneDriveTemplateLoader', () => {
  let loader: NodeMicrosoftOneDriveTemplateLoader;
  let mockClient: any;

  beforeEach(() => {
    mockClient = createMockClient();
    loader = new NodeMicrosoftOneDriveTemplateLoader(mockClient);
  });

  describe('loadTemplate', () => {
    it('should download HTML file and parse template markers', async () => {
      const mockApi = jest.fn(() => ({
        get: jest.fn().mockResolvedValue(
          '<html>{{mytemplate}}{{Subject:My Subject}}<p>Hello {{name}}</p>{{/mytemplate}}</html>'
        )
      }));
      const client = { api: mockApi } as any;
      const templateLoader = new NodeMicrosoftOneDriveTemplateLoader(client);

      const result = await templateLoader.loadTemplate('mytemplate', 'file-id.html');

      expect(result.name).toBe('mytemplate');
      expect(result.subject).toBe('My Subject');
      expect(result.body).toContain('Hello {{name}}');
      expect(result.tags).toContain('name');
    });

    it('should throw for unsupported file format', async () => {
      const mockApi = jest.fn(() => ({
        get: jest.fn().mockResolvedValue({})
      }));
      const client = { api: mockApi } as any;
      const templateLoader = new NodeMicrosoftOneDriveTemplateLoader(client);

      await expect(
        templateLoader.loadTemplate('tpl', 'file-id.xyz')
      ).rejects.toThrow('Unsupported file format');
    });

    it('should throw when template not found', async () => {
      const mockApi = jest.fn(() => ({
        get: jest.fn().mockResolvedValue('<html>no template here</html>')
      }));
      const client = { api: mockApi } as any;
      const templateLoader = new NodeMicrosoftOneDriveTemplateLoader(client);

      await expect(
        templateLoader.loadTemplate('nonexistent', 'file-id.html')
      ).rejects.toThrow("Template 'nonexistent' not found or empty");
    });

    it('should extract table ranges from template', async () => {
      const mockApi = jest.fn(() => ({
        get: jest.fn().mockResolvedValue(
          '<html>{{mytable}}{{Subject:Table}}[Table] Sheet: Sheet1, range: A1:B10{{/mytable}}</html>'
        )
      }));
      const client = { api: mockApi } as any;
      const templateLoader = new NodeMicrosoftOneDriveTemplateLoader(client);

      const result = await templateLoader.loadTemplate('mytable', 'file-id.html');

      expect(result.tableRanges).toEqual([
        { source: 'Sheet1', range: 'A1:B10', preserveFormatting: true }
      ]);
    });
  });

  describe('getRawContent', () => {
    it('should return raw body content', async () => {
      const mockApi = jest.fn(() => ({
        get: jest.fn().mockResolvedValue(
          '<html>{{tpl}}raw content{{/tpl}}</html>'
        )
      }));
      const client = { api: mockApi } as any;
      const templateLoader = new NodeMicrosoftOneDriveTemplateLoader(client);

      const result = await templateLoader.getRawContent('tpl', 'file-id.html');

      expect(result).toBe('raw content');
    });
  });
});
