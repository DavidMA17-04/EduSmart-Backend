import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  Workbook,
  type Borders,
  type Cell,
  type Worksheet,
} from 'exceljs';

export interface ExcelColumn {
  header: string;
  width: number;
  align?: 'left' | 'center' | 'right';
  wrapText?: boolean;
}

export interface ExcelReportSpec {
  sheetName: string;
  title: string;
  generatedAt: string;
  recordCount: number;
  appliedFilters: string;
  columns: ExcelColumn[];
  rows: Array<Array<string | number>>;
}

const LOGO_FILENAME = 'ctp-hojancha-logo.png';
const LOGO_MAX_HEIGHT = 52;
const LOGO_MAX_WIDTH = 82;
const IDENTITY_TEXT_COLUMN = 2;
const IDENTITY_TEXT_INDENT = 3;
const TITLE_COLOR = 'FF1F4E79';
const HEADER_BG = 'FF1F4E79';
const ZEBRA_BG = 'FFF2F4F7';
const BORDER_COLOR = 'FFD0D5DD';
const MUTED_COLOR = 'FF667085';
const WHITE = 'FFFFFFFF';
const TEXT_COLOR = 'FF1D2939';
const HEADER_ROW = 10;
const DATA_START_ROW = 11;

const INSTITUTION = {
  name: 'Colegio Técnico Profesional de Hojancha',
  ministry: 'Ministerio de Educación Pública',
  system: 'EduSmart – Sistema Integral de Gestión Académica',
  location: 'Hojancha, Guanacaste, Costa Rica',
  phone: 'Tel. (+506) 2659-9045',
  email: 'ctp.dehojancha@mep.go.cr',
};

const STATUS_FILLS: Record<string, string> = {
  Activo: 'FFE2F0DA',
  Inactivo: 'FFEDEDED',
  Cerrado: 'FFD9D9D9',
  Bloqueado: 'FFF8D7DA',
  Pendiente: 'FFFFF3CD',
  Planificado: 'FFD6EAF8',
};

const THIN_BORDER: Partial<Borders> = {
  top: { style: 'thin', color: { argb: BORDER_COLOR } },
  left: { style: 'thin', color: { argb: BORDER_COLOR } },
  bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
  right: { style: 'thin', color: { argb: BORDER_COLOR } },
};

export async function buildExcelBuffer(spec: ExcelReportSpec): Promise<Buffer> {
  const workbook = new Workbook();
  workbook.creator = 'EduSmart';
  workbook.lastModifiedBy = 'EduSmart';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.title = spec.title;

  const worksheet = workbook.addWorksheet(spec.sheetName.slice(0, 31), {
    views: [
      {
        state: 'frozen',
        ySplit: HEADER_ROW,
        topLeftCell: `A${DATA_START_ROW}`,
        activeCell: `A${DATA_START_ROW}`,
        showGridLines: false,
      },
    ],
  });

  const columnCount = Math.max(spec.columns.length, 2);
  applyColumnWidths(worksheet, spec.columns, columnCount);
  drawInstitutionalHeader(worksheet, spec, columnCount);
  tryAddLogo(workbook, worksheet);
  drawTable(worksheet, spec);
  drawFooter(worksheet, spec, columnCount);

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}

function applyColumnWidths(
  worksheet: Worksheet,
  columns: ExcelColumn[],
  columnCount: number,
): void {
  for (let index = 1; index <= columnCount; index += 1) {
    const column = columns[index - 1];
    worksheet.getColumn(index).width = column?.width ?? 16;
  }
}

function drawInstitutionalHeader(
  worksheet: Worksheet,
  spec: ExcelReportSpec,
  columnCount: number,
): void {
  worksheet.getRow(1).height = 20;
  worksheet.getRow(2).height = 18;
  worksheet.getRow(3).height = 18;
  worksheet.getRow(4).height = 10;
  worksheet.getRow(5).height = 24;
  worksheet.getRow(6).height = 18;
  worksheet.getRow(7).height = 18;
  worksheet.getRow(8).height = 28;
  worksheet.getRow(9).height = 10;

  mergeRow(worksheet, 1, IDENTITY_TEXT_COLUMN, columnCount);
  mergeRow(worksheet, 2, IDENTITY_TEXT_COLUMN, columnCount);
  mergeRow(worksheet, 3, IDENTITY_TEXT_COLUMN, columnCount);
  mergeRow(worksheet, 5, 1, columnCount);
  mergeRow(worksheet, 6, 1, columnCount);
  mergeRow(worksheet, 7, 1, columnCount);
  mergeRow(worksheet, 8, 1, columnCount);

  styleTextCell(worksheet.getCell(1, IDENTITY_TEXT_COLUMN), INSTITUTION.name, {
    bold: true,
    size: 16,
    color: TITLE_COLOR,
    indent: IDENTITY_TEXT_INDENT,
  });
  styleTextCell(
    worksheet.getCell(2, IDENTITY_TEXT_COLUMN),
    INSTITUTION.ministry,
    {
      size: 11,
      color: MUTED_COLOR,
      indent: IDENTITY_TEXT_INDENT,
    },
  );
  styleTextCell(worksheet.getCell(3, IDENTITY_TEXT_COLUMN), INSTITUTION.system, {
    size: 11,
    color: TITLE_COLOR,
    indent: IDENTITY_TEXT_INDENT,
  });
  styleTextCell(worksheet.getCell(5, 1), spec.title, {
    bold: true,
    size: 16,
    color: TITLE_COLOR,
  });
  styleTextCell(
    worksheet.getCell(6, 1),
    `Fecha de generación: ${spec.generatedAt}`,
    { size: 10, color: MUTED_COLOR },
  );
  styleTextCell(
    worksheet.getCell(7, 1),
    `Registros exportados: ${spec.recordCount}`,
    { size: 10, color: MUTED_COLOR },
  );
  styleTextCell(
    worksheet.getCell(8, 1),
    `Filtros aplicados: ${spec.appliedFilters}`,
    { size: 10, color: MUTED_COLOR, wrapText: true },
  );
}

function tryAddLogo(
  workbook: Workbook,
  worksheet: Worksheet,
): void {
  const logoPath = resolveLogoPath();
  if (!logoPath) {
    return;
  }

  try {
    const image = readFileSync(logoPath);
    const size = scaleLogo(readPngSize(image));
    const imageId = workbook.addImage({
      filename: logoPath,
      extension: 'png',
    });

    worksheet.addImage(imageId, {
      tl: { col: 0.05, row: 0.22 },
      ext: size,
      editAs: 'oneCell',
    });
  } catch {
    // El Excel debe generarse aunque el logo no pueda incrustarse.
  }
}

function drawTable(
  worksheet: Worksheet,
  spec: ExcelReportSpec,
): void {
  const headerRow = worksheet.getRow(HEADER_ROW);
  headerRow.height = 22;

  spec.columns.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.header;
    cell.font = {
      name: 'Calibri',
      bold: true,
      size: 11,
      color: { argb: WHITE },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: HEADER_BG },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };
    cell.border = THIN_BORDER;
  });

  const lastDataRow =
    spec.rows.length === 0
      ? HEADER_ROW
      : HEADER_ROW + spec.rows.length;

  worksheet.autoFilter = {
    from: { row: HEADER_ROW, column: 1 },
    to: { row: lastDataRow, column: spec.columns.length },
  };

  spec.rows.forEach((values, rowIndex) => {
    const excelRow = worksheet.getRow(DATA_START_ROW + rowIndex);
    excelRow.height = 20;
    const zebra = rowIndex % 2 === 1;

    spec.columns.forEach((column, columnIndex) => {
      const cell = excelRow.getCell(columnIndex + 1);
      const value = values[columnIndex] ?? '';
      cell.value = value;
      cell.font = {
        name: 'Calibri',
        size: 10,
        color: { argb: TEXT_COLOR },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: column.align ?? 'left',
        wrapText: column.wrapText === true,
      };
      cell.border = THIN_BORDER;

      const statusFill =
        column.header === 'Estado' && typeof value === 'string'
          ? STATUS_FILLS[value]
          : undefined;

      if (statusFill) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: statusFill },
        };
      } else if (zebra) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: ZEBRA_BG },
        };
      }
    });
  });
}

function drawFooter(
  worksheet: Worksheet,
  spec: ExcelReportSpec,
  columnCount: number,
): void {
  const startRow =
    (spec.rows.length === 0 ? HEADER_ROW : HEADER_ROW + spec.rows.length) + 2;
  const lines = [
    INSTITUTION.name,
    INSTITUTION.location,
    `${INSTITUTION.phone} · ${INSTITUTION.email}`,
    `Documento generado mediante ${INSTITUTION.system}`,
  ];

  lines.forEach((line, index) => {
    const rowNumber = startRow + index;
    mergeRow(worksheet, rowNumber, 1, columnCount);
    worksheet.getRow(rowNumber).height = 16;
    styleTextCell(worksheet.getCell(rowNumber, 1), line, {
      size: 8,
      color: MUTED_COLOR,
      italic: true,
    });
  });
}

function mergeRow(
  worksheet: Worksheet,
  row: number,
  startColumn: number,
  endColumn: number,
): void {
  if (endColumn > startColumn) {
    worksheet.mergeCells(row, startColumn, row, endColumn);
  }
}

function styleTextCell(
  cell: Cell,
  value: string,
  style: {
    bold?: boolean;
    italic?: boolean;
    size: number;
    color: string;
    wrapText?: boolean;
    indent?: number;
  },
): void {
  cell.value = value;
  cell.font = {
    name: 'Calibri',
    bold: style.bold === true,
    italic: style.italic === true,
    size: style.size,
    color: { argb: style.color },
  };
  cell.alignment = {
    vertical: 'middle',
    horizontal: 'left',
    wrapText: style.wrapText === true,
    indent: style.indent,
  };
}

function resolveLogoPath(): string | null {
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

function readPngSize(image: Buffer): { width: number; height: number } | null {
  if (image.length < 24) {
    return null;
  }

  const isPng =
    image[0] === 0x89 &&
    image[1] === 0x50 &&
    image[2] === 0x4e &&
    image[3] === 0x47;

  if (!isPng) {
    return null;
  }

  return {
    width: image.readUInt32BE(16),
    height: image.readUInt32BE(20),
  };
}

function scaleLogo(
  size: { width: number; height: number } | null,
): { width: number; height: number } {
  if (!size || size.width <= 0 || size.height <= 0) {
    return { width: LOGO_MAX_WIDTH, height: LOGO_MAX_HEIGHT };
  }

  const ratio = size.width / size.height;
  let width = LOGO_MAX_HEIGHT * ratio;
  let height = LOGO_MAX_HEIGHT;

  if (width > LOGO_MAX_WIDTH) {
    width = LOGO_MAX_WIDTH;
    height = width / ratio;
  }

  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}
