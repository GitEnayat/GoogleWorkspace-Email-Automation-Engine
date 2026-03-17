/**
 * Google Apps Script Table Renderer
 * Implements TableRenderer using SpreadsheetApp to generate HTML tables
 */

import { TableRenderer } from '@universal-email/core';

export class GoogleSheetsTableRenderer implements TableRenderer {
  async renderTable(sheetId: string, rangeA1: string): Promise<string> {
    const ss = SpreadsheetApp.openById(sheetId);
    
    // Parse range to handle sheet name vs range
    // rangeA1 might be "'Sheet1'!A1:B2" or just "A1:B2"
    // SpreadsheetApp.getRange(a1Notation) works on active sheet or needs sheet specified?
    // Actually ss.getRange(a1Notation) works if sheet name is included.
    
    let range: GoogleAppsScript.Spreadsheet.Range;
    try {
        range = ss.getRange(rangeA1);
    } catch (e) {
        // Fallback: try to parse sheet name manually if getRange fails (rare)
        return `<p style="color:red">[Table Error: Invalid Range '${rangeA1}']</p>`;
    }

    const sheet = range.getSheet();

    // 1. FETCH DATA & TRIM
    let values = range.getDisplayValues();

    // Logic: Scan from bottom up. Stop at first non-empty row.
    let lastRowIndex = values.length - 1;
    while (lastRowIndex >= 0) {
      const isRowEmpty = values[lastRowIndex].every(cell => cell.trim() === "");
      if (!isRowEmpty) break;
      lastRowIndex--;
    }

    if (lastRowIndex < 0) return "<p><i>(Table contains no data)</i></p>";

    const newRowCount = lastRowIndex + 1;
    values = values.slice(0, newRowCount);

    // 2. FETCH FORMATTING (Sliced to newRowCount)
    const backgrounds = range.getBackgrounds().slice(0, newRowCount);
    const fontWeights = range.getFontWeights().slice(0, newRowCount);
    const fontColors = range.getFontColors().slice(0, newRowCount);
    const fontSizes = range.getFontSizes().slice(0, newRowCount);
    const horizontalAligns = range.getHorizontalAlignments().slice(0, newRowCount);
    const verticalAligns = range.getVerticalAlignments().slice(0, newRowCount);
    const fontFamilies = range.getFontFamilies().slice(0, newRowCount);

    // 3. FETCH COLUMN WIDTHS
    const startCol = range.getColumn();
    const numCols = values[0].length;
    const colWidths: number[] = [];
    let totalTableWidth = 0;

    for (let c = 0; c < numCols; c++) {
      const colIndex = startCol + c;
      let w = sheet.getColumnWidth(colIndex);
      
      // Check for hidden columns (simulated logic as isColumnHiddenByUser might not be in type defs yet)
      // Assuming standard API availability
      if (!w || w === 0) {
        w = 100;
      }
      colWidths.push(w);
      totalTableWidth += w;
    }

    // 4. HANDLE MERGED RANGES
    const mergedRanges = range.getMergedRanges();
    const numRows = values.length;

    // Metadata matrix to track spans
    let cellMeta = Array.from({ length: numRows }, () =>
      Array.from({ length: numCols }, () => ({ rowSpan: 1, colSpan: 1, skip: false }))
    );

    const startRowIndex = range.getRow();
    const startColIndex = range.getColumn();

    mergedRanges.forEach(merge => {
      const mergeStartRow = merge.getRow() - startRowIndex;
      const mergeStartCol = merge.getColumn() - startColIndex;
      const mergeNumRows = merge.getNumRows();
      const mergeNumColumns = merge.getNumColumns();

      for (let r = 0; r < mergeNumRows; r++) {
        for (let c = 0; c < mergeNumColumns; c++) {
          const targetRow = mergeStartRow + r;
          const targetCol = mergeStartCol + c;

          // Ensure we are inside the trimmed bounds
          if (targetRow >= 0 && targetRow < numRows && targetCol >= 0 && targetCol < numCols) {
            if (r === 0 && c === 0) {
              cellMeta[targetRow][targetCol].rowSpan = mergeNumRows;
              cellMeta[targetRow][targetCol].colSpan = mergeNumColumns;
            } else {
              cellMeta[targetRow][targetCol].skip = true;
            }
          }
        }
      }
    });

    // 5. BUILD HTML
    let html = `<table style="table-layout: fixed; width: ${totalTableWidth}px; border-collapse: collapse; border: 1px solid #cccccc; font-family: Arial, sans-serif; font-size: 10pt;">`;

    // COLGROUP
    html += '<colgroup>';
    colWidths.forEach(w => { html += `<col style="width: ${w}px;">`; });
    html += '</colgroup>';

    for (let i = 0; i < numRows; i++) {
      const rHeight = sheet.getRowHeight(startRowIndex + i);
      html += `<tr style="height: ${rHeight}px;">`;

      for (let j = 0; j < numCols; j++) {
        if (cellMeta[i][j].skip) continue;

        const cellText = values[i][j];

        // Calculate width for merged cells
        let cellWidth = colWidths[j];
        if (cellMeta[i][j].colSpan > 1) {
          cellWidth = 0;
          for (let k = 0; k < cellMeta[i][j].colSpan; k++) {
            cellWidth += colWidths[j + k];
          }
        }

        // Attributes
        const rowSpanAttr = cellMeta[i][j].rowSpan > 1 ? ` rowspan="${cellMeta[i][j].rowSpan}"` : "";
        const colSpanAttr = cellMeta[i][j].colSpan > 1 ? ` colspan="${cellMeta[i][j].colSpan}"` : "";

        // Styles
        const styles = [
          `border: 1px solid #cccccc`,
          `padding: 4px 6px`,
          `overflow: hidden`,
          `width: ${cellWidth}px`,
          `min-width: ${cellWidth}px`,
          `max-width: ${cellWidth}px`,
          `background-color: ${backgrounds[i][j]}`,
          `color: ${fontColors[i][j]}`,
          `font-weight: ${fontWeights[i][j]}`,
          `font-size: ${fontSizes[i][j]}pt`,
          `font-family: ${fontFamilies[i][j] || 'Arial'}, sans-serif`,
          `text-align: ${horizontalAligns[i][j]}`,
          `vertical-align: ${verticalAligns[i][j]}`,
          `white-space: pre-wrap`
        ].join(";");

        html += `<td${rowSpanAttr}${colSpanAttr} style="${styles}">${cellText}</td>`;
      }

      html += '</tr>';
    }

    html += '</table>';
    return html;
  }
}
