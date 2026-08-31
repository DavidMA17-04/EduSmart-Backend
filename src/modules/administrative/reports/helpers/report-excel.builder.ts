import * as XLSX from 'xlsx';

export interface ExcelColumn {
  header: string;
  width: number;
}

export interface ExcelWorksheetSpec {
  sheetName: string;
  columns: ExcelColumn[];
  rows: Array<Record<string, string | number>>;
}

export function buildExcelBuffer(spec: ExcelWorksheetSpec): Buffer {
  const headers = spec.columns.map((column) => column.header);
  const worksheet = XLSX.utils.json_to_sheet(spec.rows, { header: headers });
  worksheet['!cols'] = spec.columns.map((column) => ({ wch: column.width }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    spec.sheetName.slice(0, 31),
  );

  const output: unknown = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'buffer',
  });

  if (!Buffer.isBuffer(output)) {
    throw new Error('La librería xlsx no devolvió un Buffer');
  }

  return output;
}
