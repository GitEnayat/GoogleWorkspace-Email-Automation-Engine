import { DataStore } from '@universal-email/core';
import * as xlsx from 'xlsx';
import * as fs from 'fs';

export class MicrosoftExcelDataStore implements DataStore {
  private workbook: xlsx.WorkBook;
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.workbook = xlsx.readFile(filePath);
  }

  async getData(sheetId: string, range: string): Promise<any[][]> {
    const worksheet = this.workbook.Sheets[sheetId];
    if (!worksheet) throw new Error(`Worksheet '${sheetId}' not found`);

    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1, range }) as any[][];
    return data;
  }

  async getTabData(sheetId: string, tabName: string): Promise<Record<string, any>[]> {
    const worksheet = this.workbook.Sheets[tabName];
    if (!worksheet) throw new Error(`Worksheet '${tabName}' not found`);

    const data = xlsx.utils.sheet_to_json(worksheet) as Record<string, any>[];
    return data;
  }

  async appendRow(sheetId: string, tabName: string, row: any[]): Promise<void> {
    const worksheet = this.workbook.Sheets[tabName];
    if (!worksheet) throw new Error(`Worksheet '${tabName}' not found`);

    xlsx.utils.sheet_add_aoa(worksheet, [row], { origin: -1 });
    xlsx.writeFile(this.workbook, this.filePath);
  }
}
