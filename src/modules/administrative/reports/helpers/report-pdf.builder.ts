import { existsSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';

export type PdfLayout = 'portrait' | 'landscape';

export interface PdfTableColumn {
  header: string;
  widthRatio: number;
  align?: 'left' | 'center' | 'right';
}

export interface PdfReportHeader {
  title: string;
  generatedAt: string;
  recordCount: number;
  appliedFilters: string;
}

interface ResolvedColumn {
  header: string;
  width: number;
  align: 'left' | 'center' | 'right';
}

const MARGIN = 40;
const FOOTER_RESERVED = 72;
const CELL_PADDING = 4;
const HEADER_FONT_SIZE = 8;
const BODY_FONT_SIZE = 8;
const LOGO_SIZE = 52;
const LOGO_GAP = 14;
const LOGO_FILENAME = 'ctp-hojancha-logo.png';
const TITLE_COLOR = '#1F4E79';
const HEADER_BG = '#1F4E79';
const ZEBRA_BG = '#F2F4F7';
const BORDER_COLOR = '#D0D5DD';
const MUTED_COLOR = '#667085';
const ACCENT_BAR_HEIGHT = 4;

const INSTITUTION = {
  name: 'Colegio Técnico Profesional de Hojancha',
  ministry: 'Ministerio de Educación Pública',
  system: 'EduSmart – Sistema Integral de Gestión Académica',
  location: 'Hojancha, Guanacaste, Costa Rica',
  phone: 'Tel. (+506) 2659-9045',
  email: 'ctp.dehojancha@mep.go.cr',
};

export class ReportPdfBuilder {
  private readonly doc: PDFKit.PDFDocument;
  private readonly chunks: Buffer[] = [];
  private tableColumns: ResolvedColumn[] = [];
  private streamError: Error | null = null;
  private reportTitle: string;

  constructor(layout: PdfLayout, documentTitle: string) {
    this.reportTitle = documentTitle;
    this.doc = new PDFDocument({
      size: 'A4',
      layout,
      bufferPages: true,
      autoFirstPage: true,
      margins: {
        top: MARGIN,
        left: MARGIN,
        right: MARGIN,
        bottom: FOOTER_RESERVED,
      },
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

  drawHeader(header: PdfReportHeader): void {
    this.reportTitle = header.title;
    this.drawAccentBar();

    const startY = MARGIN;
    const logoPath = this.resolveLogoPath();
    const logoDrawn = this.tryDrawLogo(logoPath, startY);

    const textX = logoDrawn ? MARGIN + LOGO_SIZE + LOGO_GAP : MARGIN;
    const textWidth = logoDrawn
      ? this.contentWidth - LOGO_SIZE - LOGO_GAP
      : this.contentWidth;

    this.doc.font('Helvetica-Bold').fontSize(12).fillColor(TITLE_COLOR);
    this.doc.text(INSTITUTION.name, textX, startY, {
      width: textWidth,
      align: 'left',
    });

    this.doc.font('Helvetica').fontSize(9).fillColor(MUTED_COLOR);
    this.doc.text(INSTITUTION.ministry, textX, this.doc.y, {
      width: textWidth,
    });

    this.doc.font('Helvetica').fontSize(9).fillColor(TITLE_COLOR);
    this.doc.text(INSTITUTION.system, textX, this.doc.y, {
      width: textWidth,
    });

    const identityBottom = logoDrawn
      ? Math.max(this.doc.y, startY + LOGO_SIZE)
      : this.doc.y;

    this.doc.y = identityBottom + 12;
    this.doc.x = MARGIN;

    this.doc.font('Helvetica-Bold').fontSize(15).fillColor(TITLE_COLOR);
    this.doc.text(header.title, MARGIN, this.doc.y, {
      width: this.contentWidth,
    });

    this.doc.moveDown(0.35);
    this.doc.font('Helvetica').fontSize(9).fillColor(MUTED_COLOR);
    this.doc.text(`Fecha de generación: ${header.generatedAt}`, {
      width: this.contentWidth,
    });
    this.doc.text(`Registros exportados: ${header.recordCount}`, {
      width: this.contentWidth,
    });
    this.doc.text(`Filtros aplicados: ${header.appliedFilters}`, {
      width: this.contentWidth,
    });

    this.doc.moveDown(0.45);
    this.drawHeaderSeparator();
    this.doc.moveDown(0.55);
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
        this.drawFooters();
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
    return this.doc.page.height - FOOTER_RESERVED;
  }

  private resolveColumns(columns: PdfTableColumn[]): ResolvedColumn[] {
    return columns.map((column) => ({
      header: column.header,
      width: column.widthRatio * this.contentWidth,
      align: column.align ?? 'left',
    }));
  }

  private resolveLogoPath(): string | null {
    const candidates = [
      join(__dirname, '..', 'assets', LOGO_FILENAME),
      join(
        process.cwd(),
        'src',
        'modules',
        'administrative',
        'reports',
        'assets',
        LOGO_FILENAME,
      ),
    ];

    for (const candidate of candidates) {
      try {
        if (existsSync(candidate)) {
          return candidate;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  private tryDrawLogo(logoPath: string | null, y: number): boolean {
    if (!logoPath) {
      return false;
    }

    try {
      this.doc.image(logoPath, MARGIN, y, {
        fit: [LOGO_SIZE, LOGO_SIZE],
      });
      return true;
    } catch {
      return false;
    }
  }

  private drawAccentBar(): void {
    this.doc
      .rect(0, 0, this.doc.page.width, ACCENT_BAR_HEIGHT)
      .fill(TITLE_COLOR);
  }

  private drawHeaderSeparator(): void {
    const y = this.doc.y;
    this.doc
      .moveTo(MARGIN, y)
      .lineTo(MARGIN + this.contentWidth, y)
      .strokeColor(TITLE_COLOR)
      .lineWidth(1.4)
      .stroke();
    this.doc
      .moveTo(MARGIN, y + 3)
      .lineTo(MARGIN + this.contentWidth, y + 3)
      .strokeColor(BORDER_COLOR)
      .lineWidth(0.6)
      .stroke();
    this.doc.y = y + 6;
    this.doc.x = MARGIN;
  }

  private drawContinuedHeader(): void {
    this.drawAccentBar();
    this.doc.font('Helvetica-Bold').fontSize(9).fillColor(TITLE_COLOR);
    this.doc.text(
      `${INSTITUTION.name}  ·  ${this.reportTitle}`,
      MARGIN,
      MARGIN,
      {
        width: this.contentWidth,
      },
    );

    const lineY = this.doc.y + 4;
    this.doc
      .moveTo(MARGIN, lineY)
      .lineTo(MARGIN + this.contentWidth, lineY)
      .strokeColor(BORDER_COLOR)
      .lineWidth(0.8)
      .stroke();
    this.doc.y = lineY + 10;
    this.doc.x = MARGIN;
  }

  private ensureSpace(rowHeight: number): void {
    if (this.doc.y + rowHeight <= this.maxContentY) {
      return;
    }

    this.doc.addPage();
    this.drawContinuedHeader();
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

  private drawFooters(): void {
    const range = this.doc.bufferedPageRange();

    for (let i = 0; i < range.count; i += 1) {
      this.doc.switchToPage(range.start + i);
      const page = this.doc.page;
      const originalBottomMargin = page.margins.bottom;
      page.margins.bottom = 0;

      const contentWidth = page.width - MARGIN * 2;
      const footerTop = page.height - FOOTER_RESERVED + 8;

      this.doc
        .moveTo(MARGIN, footerTop)
        .lineTo(MARGIN + contentWidth, footerTop)
        .strokeColor(BORDER_COLOR)
        .lineWidth(0.6)
        .stroke();

      const lines = [
        `${INSTITUTION.name} · ${INSTITUTION.location}`,
        `${INSTITUTION.phone} · ${INSTITUTION.email}`,
        `Documento generado mediante ${INSTITUTION.system}`,
      ];

      this.doc.font('Helvetica').fontSize(7).fillColor(MUTED_COLOR);

      let y = footerTop + 8;
      for (const line of lines) {
        this.doc.text(line, MARGIN, y, {
          width: contentWidth,
          align: 'center',
          lineBreak: false,
        });
        y += 10;
      }

      this.doc.text(`Página ${i + 1} de ${range.count}`, MARGIN, y + 2, {
        width: contentWidth,
        align: 'center',
        lineBreak: false,
      });

      page.margins.bottom = originalBottomMargin;
    }
  }
}
