import { docs_v1 } from 'googleapis';

export class DocsToHtmlConverter {
  static convertToHtml(doc: docs_v1.Schema$Document, templateName: string): { html: string; subject: string } {
    const body = doc.body;
    if (!body || !body.content) return { html: '', subject: '' };

    let isInsideTemplate = false;
    let html = '';
    let subject = '';

    for (const element of body.content) {
      if (element.paragraph) {
        const text = this.getParagraphText(element.paragraph).trim();

        // Marker check
        if (text === `{{${templateName}}}`) {
          isInsideTemplate = true;
          continue;
        }

        if (isInsideTemplate && text.startsWith('{{') && text.endsWith('}}') && text !== `{{${templateName}}}`) {
          break;
        }

        if (isInsideTemplate) {
          // Subject tag check
          const subjectMatch = text.match(/^{{Subject:\s*(.+)}}$/);
          if (subjectMatch) {
            subject = subjectMatch[1].trim();
            continue;
          }

          // First line as subject check
          if (!subject && html === '' && text.length > 0 && !text.startsWith('{{')) {
            subject = text;
            continue;
          }

          html += this.convertParagraphToHtml(element.paragraph);
        }
      } else if (element.table && isInsideTemplate) {
        html += this.convertTableToHtml(element.table);
      } else if (element.sectionBreak && isInsideTemplate) {
        // Section breaks can be ignored or used for <hr>
      }
    }

    return { html, subject };
  }

  private static getParagraphText(paragraph: docs_v1.Schema$Paragraph): string {
    return paragraph.elements?.map(e => e.textRun?.content || '').join('') || '';
  }

  private static convertParagraphToHtml(paragraph: docs_v1.Schema$Paragraph): string {
    const text = this.getParagraphText(paragraph);
    if (text.trim() === '') return '<br>';

    const content = paragraph.elements?.map(e => this.convertTextElementToHtml(e)).join('') || '';
    
    if (paragraph.bullet) {
      return `<li>${content}</li>`;
    }

    return `<p style="margin:0;padding:0;min-height:1em;">${content}</p>`;
  }

  private static convertTextElementToHtml(element: docs_v1.Schema$ParagraphElement): string {
    if (!element.textRun) return '';

    let content = element.textRun.content || '';
    const style = element.textRun.textStyle || {};

    // Escape HTML
    content = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    if (style.bold) content = `<b>${content}</b>`;
    if (style.italic) content = `<i>${content}</i>`;
    if (style.underline) content = `<u>${content}</u>`;
    if (style.strikethrough) content = `<s>${content}</s>`;

    if (style.foregroundColor) {
      const color = style.foregroundColor.color?.rgbColor;
      if (color) {
        const r = Math.round((color.red || 0) * 255);
        const g = Math.round((color.green || 0) * 255);
        const b = Math.round((color.blue || 0) * 255);
        content = `<span style="color:rgb(${r},${g},${b})">${content}</span>`;
      }
    }

    if (style.link) {
      content = `<a href="${style.link.url}">${content}</a>`;
    }

    return content;
  }

  private static convertTableToHtml(table: docs_v1.Schema$Table): string {
    let html = '<table style="border-collapse: collapse; width: 100%; border: 1px solid #ccc;">';
    
    table.tableRows?.forEach(row => {
      html += '<tr>';
      row.tableCells?.forEach(cell => {
        let cellHtml = '';
        cell.content?.forEach(element => {
          if (element.paragraph) {
            cellHtml += this.convertParagraphToHtml(element.paragraph);
          }
        });
        html += `<td style="border: 1px solid #ccc; padding: 8px;">${cellHtml}</td>`;
      });
      html += '</tr>';
    });

    html += '</table>';
    return html;
  }
}
