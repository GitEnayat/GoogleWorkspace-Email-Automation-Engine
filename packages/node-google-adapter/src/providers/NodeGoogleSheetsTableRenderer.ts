import { TableRenderer } from '@universal-email/core';
import { google, sheets_v4 } from 'googleapis';

export class NodeGoogleSheetsTableRenderer implements TableRenderer {
  private sheets: sheets_v4.Sheets;

  constructor(auth: any) {
    this.sheets = google.sheets({ version: 'v4', auth });
  }

  async renderTable(sheetId: string, range: string): Promise<string> {
    const response = await this.sheets.spreadsheets.get({
      spreadsheetId: sheetId,
      ranges: [range],
      includeGridData: true
    });

    const spreadsheet = response.data;
    const sheet = spreadsheet.sheets?.[0];
    const data = sheet?.data?.[0];

    if (!data || !data.rowData) return '<p><i>(Table contains no data)</i></p>';

    const rowData = data.rowData;
    const columnMetadata = sheet?.basicViews?.columnMetadata || [];

    // 1. Determine table dimensions
    const numRows = rowData.length;
    const numCols = Math.max(...rowData.map(r => r.values?.length || 0));

    // 2. Fetch column widths
    const colWidths: number[] = [];
    let totalTableWidth = 0;
    for (let c = 0; c < numCols; c++) {
      let w = columnMetadata[c]?.pixelSize || 100;
      colWidths.push(w);
      totalTableWidth += w;
    }

    // 3. Handle merges (Simplified for this adapter)
    const merges = sheet?.merges || [];
    // Skip complex merge logic for now, focus on core rendering

    // 4. Build HTML
    let html = `<table style="table-layout: fixed; width: ${totalTableWidth}px; border-collapse: collapse; border: 1px solid #cccccc; font-family: Arial, sans-serif; font-size: 10pt;">`;

    // COLGROUP
    html += '<colgroup>';
    colWidths.forEach(w => { html += `<col style="width: ${w}px;">`; });
    html += '</colgroup>';

    for (let i = 0; i < numRows; i++) {
      const row = rowData[i];
      html += '<tr>';

      for (let j = 0; j < numCols; j++) {
        const cell = row.values?.[j];
        const format = cell?.effectiveFormat || {};
        const cellValue = cell?.formattedValue || '';

        // Styles
        const bg = format.backgroundColor;
        const bgColor = bg ? `rgb(${Math.round((bg.red || 0) * 255)},${Math.round((bg.green || 0) * 255)},${Math.round((bg.blue || 0) * 255)})` : '#ffffff';
        const font = format.textFormat || {};
        const textColor = font.foregroundColor ? `rgb(${Math.round((font.foregroundColor.red || 0) * 255)},${Math.round((font.foregroundColor.green || 0) * 255)},${Math.round((font.foregroundColor.blue || 0) * 255)})` : '#000000';

        const styles = [
          `border: 1px solid #cccccc`,
          `padding: 4px 6px`,
          `overflow: hidden`,
          `width: ${colWidths[j]}px`,
          `background-color: ${bgColor}`,
          `color: ${textColor}`,
          `font-weight: ${font.bold ? 'bold' : 'normal'}`,
          `font-style: ${font.italic ? 'italic' : 'normal'}`,
          `text-decoration: ${font.underline ? 'underline' : (font.strikethrough ? 'line-through' : 'none')}`,
          `font-size: ${font.fontSize || 10}pt`,
          `text-align: ${this.mapAlignment(format.horizontalAlignment)}`,
          `vertical-align: ${this.mapVerticalAlignment(format.verticalAlignment)}`,
          `white-space: pre-wrap`
        ].join(";");

        html += `<td style="${styles}">${cellValue}</td>`;
      }

      html += '</tr>';
    }

    html += '</table>';
    return html;
  }

  private mapAlignment(align?: string): string {
    switch (align) {
      case 'LEFT': return 'left';
      case 'CENTER': return 'center';
      case 'RIGHT': return 'right';
      default: return 'left';
    }
  }

  private mapVerticalAlignment(align?: string): string {
    switch (align) {
      case 'TOP': return 'top';
      case 'MIDDLE': return 'middle';
      case 'BOTTOM': return 'bottom';
      default: return 'middle';
    }
  }
}
