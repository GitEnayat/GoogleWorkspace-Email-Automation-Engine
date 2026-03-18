import { DataStore } from "@universal-email/core";
import { Client } from "@microsoft/microsoft-graph-client";

export class NodeMicrosoftExcelDataStore implements DataStore {
  private client: Client;

  constructor(graphClient: Client) {
    this.client = graphClient;
  }

  async getData(sheetId: string, range: string): Promise<any[][]> {
    const response = await this.client
      .api(`/me/drive/items/${sheetId}/workbook/worksheets/${range}`)
      .get();

    if (response.values) {
      return response.values;
    }
    return [];
  }

  async getTabData(
    sheetId: string,
    tabName: string,
  ): Promise<Record<string, any>[]> {
    const response = await this.client
      .api(
        `/me/drive/items/${sheetId}/workbook/worksheets/${tabName}/usedRange`,
      )
      .get();

    const values = response.values || [];
    if (values.length === 0) return [];

    const headers = values[0] as string[];
    const rows = values.slice(1);

    return rows.map((row: any[]) => {
      const record: Record<string, any> = {};
      headers.forEach((header: string, index: number) => {
        record[header] = row[index];
      });
      return record;
    });
  }

  async appendRow(sheetId: string, tabName: string, row: any[]): Promise<void> {
    const lastRowResponse = await this.client
      .api(
        `/me/drive/items/${sheetId}/workbook/worksheets/${tabName}/usedRange`,
      )
      .get();

    const lastRowNumber = lastRowResponse.address?.match(/:(\d+)$/);
    const nextRow = lastRowNumber ? parseInt(lastRowNumber[1], 10) + 1 : 1;

    const range = `A${nextRow}:${String.fromCharCode(65 + row.length - 1)}${nextRow}`;

    await this.client
      .api(
        `/me/drive/items/${sheetId}/workbook/worksheets/${tabName}/range(address='${range}')`,
      )
      .patch({
        values: [row],
      });
  }
}
