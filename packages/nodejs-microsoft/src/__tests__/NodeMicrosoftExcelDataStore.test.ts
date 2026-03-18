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

import { NodeMicrosoftExcelDataStore } from "../providers/NodeMicrosoftExcelDataStore";

describe("NodeMicrosoftExcelDataStore", () => {
  describe("getData", () => {
    it("should call correct endpoint with sheet id and range", async () => {
      const mockGet = jest.fn().mockResolvedValue({
        values: [
          ["a", "b"],
          ["1", "2"],
        ],
      });
      const mockApi = jest.fn(() => ({ get: mockGet }));
      const client = { api: mockApi };
      const dataStore = new NodeMicrosoftExcelDataStore(client as any);

      const result = await dataStore.getData("sheet-id", "Sheet1!A1:B2");

      expect(mockApi).toHaveBeenCalledWith(
        "/me/drive/items/sheet-id/workbook/worksheets/Sheet1!A1:B2",
      );
      expect(result).toEqual([
        ["a", "b"],
        ["1", "2"],
      ]);
    });

    it("should return empty array when no values", async () => {
      const mockGet = jest.fn().mockResolvedValue({});
      const mockApi = jest.fn(() => ({ get: mockGet }));
      const client = { api: mockApi };
      const dataStore = new NodeMicrosoftExcelDataStore(client as any);

      const result = await dataStore.getData("sheet-id", "Sheet1!A1");

      expect(result).toEqual([]);
    });
  });

  describe("getTabData", () => {
    it("should return array of objects using first row as headers", async () => {
      const mockGet = jest.fn().mockResolvedValue({
        values: [
          ["Name", "Age", "City"],
          ["Alice", "30", "NYC"],
          ["Bob", "25", "LA"],
        ],
      });
      const mockApi = jest.fn(() => ({ get: mockGet }));
      const client = { api: mockApi };
      const dataStore = new NodeMicrosoftExcelDataStore(client as any);

      const result = await dataStore.getTabData("sheet-id", "Sheet1");

      expect(mockApi).toHaveBeenCalledWith(
        "/me/drive/items/sheet-id/workbook/worksheets/Sheet1/usedRange",
      );
      expect(result).toEqual([
        { Name: "Alice", Age: "30", City: "NYC" },
        { Name: "Bob", Age: "25", City: "LA" },
      ]);
    });

    it("should return empty array when no data", async () => {
      const mockGet = jest.fn().mockResolvedValue({ values: [] });
      const mockApi = jest.fn(() => ({ get: mockGet }));
      const client = { api: mockApi };
      const dataStore = new NodeMicrosoftExcelDataStore(client as any);

      const result = await dataStore.getTabData("sheet-id", "Sheet1");

      expect(result).toEqual([]);
    });
  });

  describe("appendRow", () => {
    it("should append row to sheet", async () => {
      const mockPatch = jest.fn().mockResolvedValue({});

      const mockApi = jest.fn((path: string) => {
        if (path.includes("usedRange")) {
          return {
            get: jest.fn().mockResolvedValue({ address: "Sheet1!A1:C3" }),
          };
        }
        return { patch: mockPatch };
      });
      const client = { api: mockApi } as any;
      const dataStore = new NodeMicrosoftExcelDataStore(client);

      await dataStore.appendRow("sheet-id", "Sheet1", ["New", "Row", "Data"]);

      expect(mockPatch).toHaveBeenCalledWith({
        values: [["New", "Row", "Data"]],
      });
    });
  });
});
