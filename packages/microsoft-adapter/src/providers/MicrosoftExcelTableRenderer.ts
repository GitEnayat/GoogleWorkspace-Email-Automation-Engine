import { TableRenderer } from '@universal-email/core';
import * as xlsx from 'xlsx';

export class MicrosoftExcelTableRenderer implements TableRenderer {
  private workbook: xlsx.WorkBook;

  constructor(filePath: string) {
    this.workbook = xlsx.readFile(filePath);
  }

  async renderTable(sheetId: string, range: string): Promise<string> {
    const worksheet = this.workbook.Sheets[sheetId];
    if (!worksheet) throw new Error(`Worksheet '${sheetId}' not found`);

    // Clean up range
    const cleanRange = range.replace(/['"]/g, '').trim();

    // Use xlsx to generate HTML table from range
    const options: xlsx.Sheet2HTMLOpts = {
      header: '',
      footer: '',
      id: 'excel-table'
    };

    if (cleanRange) {
        // Unfortunately xlsx.utils.sheet_to_html doesn't take range directly, 
        // we have to slice it first or use a sub-range
        const data = xlsx.utils.sheet_to_json(worksheet, { header: 1, range: cleanRange }) as any[][];
        const newSheet = xlsx.utils.aoa_to_sheet(data);
        return xlsx.utils.sheet_to_html(newSheet, options);
    }

    return xlsx.utils.sheet_to_html(worksheet, options);
  }
}
