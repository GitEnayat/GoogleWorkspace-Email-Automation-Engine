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

import { NodeMicrosoftExcelTableRenderer } from '../providers/NodeMicrosoftExcelTableRenderer';

describe('NodeMicrosoftExcelTableRenderer', () => {
  describe('renderTable', () => {
    it('should fetch range data with format', async () => {
      const mockGet = jest.fn().mockResolvedValue({
        values: [['Header', 'Value'], ['Data1', 'Data2']],
        text: [['Header', 'Value'], ['Data1', 'Data2']]
      });
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        get: mockGet,
      };
      const mockApi = jest.fn(() => mockChain);
      const client = { api: mockApi };
      const renderer = new NodeMicrosoftExcelTableRenderer(client as any);

      const result = await renderer.renderTable('sheet-id', 'Sheet1!A1:B2');

      expect(mockApi).toHaveBeenCalledWith(
        "/me/drive/items/sheet-id/workbook/worksheets/Sheet1/range(address='A1:B2')"
      );
      expect(mockChain.select).toHaveBeenCalledWith('values,text,format,numberFormat');
      expect(result).toContain('<table');
      expect(result).toContain('<td');
    });

    it('should return placeholder for empty data', async () => {
      const mockGet = jest.fn().mockResolvedValue({ values: [] });
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        get: mockGet,
      };
      const mockApi = jest.fn(() => mockChain);
      const client = { api: mockApi };
      const renderer = new NodeMicrosoftExcelTableRenderer(client as any);

      const result = await renderer.renderTable('sheet-id', 'Sheet1!A1');

      expect(result).toContain('Table contains no data');
    });

    it('should apply header styling', async () => {
      const mockGet = jest.fn().mockResolvedValue({
        values: [['Col1', 'Col2'], ['a', 'b']],
        text: [['Col1', 'Col2'], ['a', 'b']],
        format: [
          [{ font: { bold: true } }, { font: { bold: true } }],
          [{}, {}]
        ]
      });
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        get: mockGet,
      };
      const mockApi = jest.fn(() => mockChain);
      const client = { api: mockApi };
      const renderer = new NodeMicrosoftExcelTableRenderer(client as any);

      const result = await renderer.renderTable('sheet-id', 'Sheet1!A1:B2');

      expect(result).toContain('font-weight: bold');
      expect(result).toContain('background-color: #f0f0f0');
    });

    it('should apply cell formatting from format response', async () => {
      const mockGet = jest.fn().mockResolvedValue({
        values: [['A', 'B']],
        text: [['A', 'B']],
        format: [
          [
            { fill: { color: { R: 1, G: 0, B: 0 } } },
            {}
          ]
        ]
      });
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        get: mockGet,
      };
      const mockApi = jest.fn(() => mockChain);
      const client = { api: mockApi };
      const renderer = new NodeMicrosoftExcelTableRenderer(client as any);

      const result = await renderer.renderTable('sheet-id', 'Sheet1!A1:B1');

      expect(result).toContain('background-color: #ff0000');
    });
  });
});
