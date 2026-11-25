import { PassThrough, type Writable } from "node:stream";
import ExcelJS from "exceljs";

export type CellValue = string | number | Date | boolean | null;

export interface SheetColumn {
  header: string;
  key: string;
  width: number;
  /** Excel number format, e.g. "dd mmm yyyy hh:mm" or "#,##0". */
  numFmt?: string;
}

export interface SheetSource {
  name: string;
  columns: SheetColumn[];
  rows: AsyncIterable<CellValue[]>;
}

/**
 * Cells starting with = + - @ (or tab/CR) are treated as formulas by Excel —
 * a classic "CSV/formula injection". Prefix them so they stay plain text.
 */
export function safeCell(value: CellValue): CellValue {
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(value)) return `'${value}`;
  return value;
}

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
/** Excel dates have no time zone: store Dhaka wall-clock time. */
export const dhakaCell = (date: Date | null | undefined): Date | null =>
  date ? new Date(date.getTime() + DHAKA_OFFSET_MS) : null;

/**
 * Streams sheets into an .xlsx without holding rows in memory: each row is
 * committed (flushed) as soon as it is written, so 150k+ row exports stay cheap.
 * Returns the number of data rows written.
 */
export async function writeWorkbook(
  target: Writable,
  sheets: AsyncIterable<SheetSource> | Iterable<SheetSource>,
): Promise<number> {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: target,
    useStyles: true,
    useSharedStrings: false,
  });
  workbook.creator = "Mnemonic Offer Admin";
  let rows = 0;

  for await (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name.slice(0, 31), {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    ws.columns = sheet.columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width,
      style: c.numFmt ? { numFmt: c.numFmt } : {},
    }));
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).commit();
    for await (const values of sheet.rows) {
      ws.addRow(values.map(safeCell)).commit();
      rows++;
    }
    ws.commit();
  }
  await workbook.commit();
  return rows;
}

/** Same workbook as a Buffer (email attachments). */
export async function workbookBuffer(
  sheets: AsyncIterable<SheetSource> | Iterable<SheetSource>,
): Promise<{ buffer: Buffer; rows: number }> {
  const sink = new PassThrough();
  const chunks: Buffer[] = [];
  sink.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve, reject) => {
    sink.on("end", resolve);
    sink.on("error", reject);
  });
  const rows = await writeWorkbook(sink, sheets);
  await done;
  return { buffer: Buffer.concat(chunks), rows };
}
