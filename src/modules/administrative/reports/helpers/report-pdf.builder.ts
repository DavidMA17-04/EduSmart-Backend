import PDFDocument from 'pdfkit';

export type PdfLayout = 'portrait' | 'landscape';

export interface PdfTableColumn {
  header: string;
  widthRatio: number;
  align?: 'left' | 'center' | 'right';
}

interface ResolvedColumn {
  header: string;
  width: number;
  align: 'left' | 'center' | 'right';
}

const MARGIN = 40;
const FOOTER_HEIGHT = 36;
const CELL_PADDING = 4;
const HEADER_FONT_SIZE = 8;
const BODY_FONT_SIZE = 8;
const TITLE_COLOR = '#1F4E79';
const HEADER_BG = '#1F4E79';
const ZEBRA_BG = '#F2F4F7';
const BORDER_COLOR = '#D0D5DD';
const MUTED_COLOR = '#667085';

export class ReportPdfBuilder {
  private readonly doc: PDFKit.PDFDocument;
  private readonly chunks: Buffer[] = [];
  private tableColumns: ResolvedColumn[] = [];
  private streamError: Error | null = null;

  constructor(layout: PdfLayout, documentTitle: string) {
    this.doc = new PDFDocument({
      size: 'A4',
      layout,
      margin: MARGIN,
      bufferPages: true,
      autoFirstPage: true,
      info: {
        Title: documentTitle,
        Author: 'EduSmart',
        Creator: 'EduSmart',
      },
    });

    this.doc.on('data', (chunk: Buffer | Uint8Array) => {
      this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    this.doc.on('error', (error: Error) => {
      this.streamError = error;
    });
  }

  drawHeader(title: string, recordCount: number, generatedAt: string): void {
    this.doc.font('Helvetica-Bold').fontSize(11).fillColor(TITLE_COLOR);
    this.doc.text('EduSmart', MARGIN, MARGIN, {
      width: this.contentWidth,
      align: 'left',
    });

    this.doc.moveDown(0.2);
    this.doc.font('Helvetica-Bold').fontSize(16).fillColor(TITLE_COLOR);
    this.doc.text(title, { width: this.contentWidth });

    this.doc.moveDown(0.25);
    this.doc.font('Helvetica').fontSize(9).fillColor(MUTED_COLOR);
    this.doc.text(`Generado: ${generatedAt}`, { width: this.contentWidth });
    this.doc.text(`Registros exportados: ${recordCount}`, {
      width: this.contentWidth,
    });

    this.doc.moveDown(0.4);
    const lineY = this.doc.y;
    this.doc
      .moveTo(MARGIN, lineY)
      .lineTo(MARGIN + this.contentWidth, lineY)
      .strokeColor(BORDER_COLOR)
      .lineWidth(1)
      .stroke();
    this.doc.moveDown(0.6);
  }

  drawEmptyState(): void {
    this.doc.font('Helvetica').fontSize(10).fillColor(MUTED_COLOR);
    this.doc.text('No hay registros para los filtros seleccionados.', {
      width: this.contentWidth,
    });
  }

  drawTable(columns: PdfTableColumn[], rows: string[][]): void {
    this.tableColumns = this.resolveColumns(columns);
    this.drawTableHeader();

    rows.forEach((row, index) => {
      this.drawTableRow(row, index % 2 === 1);
    });
  }

  toBuffer(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      let settled = false;

      const fail = (error: Error): void => {
        if (settled) {
          return;
        }
        settled = true;
        reject(error);
      };

      if (this.streamError) {
        fail(this.streamError);
        this.doc.end();
        return;
      }

      this.doc.on('end', () => {
        if (settled) {
          return;
        }
        if (this.streamError) {
          fail(this.streamError);
          return;
        }
        settled = true;
        resolve(Buffer.concat(this.chunks));
      });

      this.doc.on('error', (error: Error) => {
        fail(error);
      });

      try {
        this.drawPageNumbers();
        this.doc.end();
      } catch (error) {
        const normalized =
          error instanceof Error ? error : new Error(String(error));
        this.doc.end();
        fail(normalized);
      }
    });
  }

  private get contentWidth(): number {
    return this.doc.page.width - MARGIN * 2;
  }

  private get maxContentY(): number {
    return this.doc.page.height - FOOTER_HEIGHT;
  }

  private resolveColumns(columns: PdfTableColumn[]): ResolvedColumn[] {
    return columns.map((column) => ({
      header: column.header,
      width: column.widthRatio * this.contentWidth,
      align: column.align ?? 'left',
    }));
  }

  private ensureSpace(rowHeight: number): void {
    if (this.doc.y + rowHeight <= this.maxContentY) {
      return;
    }

    this.doc.addPage();
    if (this.tableColumns.length > 0) {
      this.drawTableHeader();
    }
  }

  private drawTableHeader(): void {
    const values = this.tableColumns.map((column) => column.header);
    this.drawRow(values, {
      background: HEADER_BG,
      color: '#FFFFFF',
      bold: true,
      fontSize: HEADER_FONT_SIZE,
    });
  }

  private drawTableRow(values: string[], zebra: boolean): void {
    this.drawRow(values, {
      background: zebra ? ZEBRA_BG : '#FFFFFF',
      color: '#1D2939',
      bold: false,
      fontSize: BODY_FONT_SIZE,
    });
  }

  private drawRow(
    values: string[],
    style: {
      background: string;
      color: string;
      bold: boolean;
      fontSize: number;
    },
  ): void {
    const rowHeight = this.measureRowHeight(values, style.fontSize, style.bold);
    this.ensureSpace(rowHeight);

    const startY = this.doc.y;
    let x = MARGIN;

    this.doc
      .rect(MARGIN, startY, this.contentWidth, rowHeight)
      .fill(style.background);

    this.doc
      .rect(MARGIN, startY, this.contentWidth, rowHeight)
      .strokeColor(BORDER_COLOR)
      .lineWidth(0.4)
      .stroke();

    this.doc
      .font(style.bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(style.fontSize)
      .fillColor(style.color);

    for (let index = 0; index < this.tableColumns.length; index += 1) {
      const column = this.tableColumns[index];
      const text = values[index] ?? '';
      this.doc.text(text, x + CELL_PADDING, startY + CELL_PADDING, {
        width: column.width - CELL_PADDING * 2,
        height: rowHeight - CELL_PADDING * 2,
        align: column.align,
        ellipsis: true,
      });
      x += column.width;
    }

    this.doc.y = startY + rowHeight;
    this.doc.x = MARGIN;
  }

  private measureRowHeight(
    values: string[],
    fontSize: number,
    bold: boolean,
  ): number {
    this.doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);
    let height = 18;

    for (let index = 0; index < this.tableColumns.length; index += 1) {
      const column = this.tableColumns[index];
      const text = values[index] ?? '';
      const measured = this.doc.heightOfString(text, {
        width: column.width - CELL_PADDING * 2,
        align: column.align,
      });
      height = Math.max(height, measured + CELL_PADDING * 2);
    }

    return Math.min(height, 48);
  }

  private drawPageNumbers(): void {
    const range = this.doc.bufferedPageRange();

    for (let i = 0; i < range.count; i += 1) {
      this.doc.switchToPage(range.start + i);
      this.doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(MUTED_COLOR)
        .text(
          `Página ${i + 1} de ${range.count}`,
          MARGIN,
          this.doc.page.height - MARGIN - 12,
          {
            width: this.contentWidth,
            align: 'center',
            lineBreak: false,
          },
        );
    }
  }
}
