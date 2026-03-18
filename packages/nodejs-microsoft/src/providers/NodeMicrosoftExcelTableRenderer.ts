import { TableRenderer } from '@universal-email/core';
import { Client } from '@microsoft/microsoft-graph-client';

export class NodeMicrosoftExcelTableRenderer implements TableRenderer {
  private client: Client;

  constructor(graphClient: Client) {
    this.client = graphClient;
  }

  async renderTable(sheetId: string, range: string): Promise<string> {
    const [sheetName, address] = range.split('!');

    const response = await this.client
      .api(`/me/drive/items/${sheetId}/workbook/worksheets/${sheetName}/range(address='${address}')`)
      .select('values,text,format,numberFormat')
      .get();

    const values = response.values || [];
    const text = response.text || [];
    const format = response.format || {};

    if (values.length === 0) {
      return '<p><i>(Table contains no data)</i></p>';
    }

    let html = '<table style="table-layout: auto; width: 100%; border-collapse: collapse; border: 1px solid #cccccc; font-family: Arial, sans-serif; font-size: 10pt;">';

    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      html += '<tr>';

      for (let j = 0; j < row.length; j++) {
        const cellValue = text?.[i]?.[j] ?? row[j] ?? '';
        const cellFormat = format?.[i]?.[j];

        const styles = this.buildCellStyles(cellFormat, i === 0);

        html += `<td style="${styles}">${cellValue}</td>`;
      }

      html += '</tr>';
    }

    html += '</table>';
    return html;
  }

  private buildCellStyles(cellFormat: any, isHeader: boolean): string {
    const styles: string[] = [
      'border: 1px solid #cccccc',
      'padding: 4px 6px',
      'overflow: hidden',
    ];

    if (cellFormat) {
      const fill = cellFormat.fill;
      if (fill?.color) {
        styles.push(`background-color: ${this.rgbToHex(fill.color)}`);
      } else if (isHeader) {
        styles.push('background-color: #f0f0f0');
      }

      const font = cellFormat.font;
      if (font) {
        if (font.color) {
          styles.push(`color: ${this.rgbToHex(font.color)}`);
        }
        if (font.bold) {
          styles.push('font-weight: bold');
        }
        if (font.italic) {
          styles.push('font-style: italic');
        }
        if (font.underline) {
          styles.push('text-decoration: underline');
        }
        if (font.size) {
          styles.push(`font-size: ${font.size}pt`);
        }
      }

      const alignment = cellFormat.alignment;
      if (alignment) {
        if (alignment.horizontal) {
          styles.push(`text-align: ${alignment.horizontal}`);
        }
        if (alignment.vertical) {
          styles.push(`vertical-align: ${alignment.vertical}`);
        }
      }
    } else if (isHeader) {
      styles.push('background-color: #f0f0f0');
      styles.push('font-weight: bold');
    }

    styles.push('white-space: pre-wrap');

    return styles.join('; ');
  }

  private rgbToHex(color: { R?: number; G?: number; B?: number }): string {
    const r = Math.round((color.R || 0) * 255);
    const g = Math.round((color.G || 0) * 255);
    const b = Math.round((color.B || 0) * 255);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
}
