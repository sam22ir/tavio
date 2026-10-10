import { cellToNumber, cellToText, type IoBooleanText, type IoColumn, type IoRow } from './cells';
import { zipStored, type ZipEntry } from './zip';

export interface ToXlsxOptions {
  sheetName?: string;
  rtl?: boolean;              // right-to-left sheet (Arabic)
  booleanText?: IoBooleanText;
  now?: Date;
}

// Style indexes into cellXfs below.
const STYLE_DEFAULT = 0;
const STYLE_HEADER = 1;
const STYLE_DECIMAL = 2;

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
// XML 1.0 forbids most C0 control characters; drop them so the sheet stays well-formed.
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

// Characters that need escaping or removal. Most cells have none, so one test skips the replace chain.
const NEEDS_ESCAPE = /[&<>"\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/;

export function xmlEscape(text: string): string {
  if (!NEEDS_ESCAPE.test(text)) return text;
  return text
    .replace(INVALID_XML, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 1-based column index to letters: 1 -> A, 27 -> AA. */
export function columnLetter(index: number): string {
  let n = index;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Excel sheet names: max 31 chars, no []:*?/\ and not empty. */
export function safeSheetName(name: string): string {
  const cleaned = name.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31);
  return cleaned || 'Sheet1';
}

function inlineString(ref: string, text: string, style: number): string {
  const styleAttr = style ? ` s="${style}"` : '';
  return `<c r="${ref}" t="inlineStr"${styleAttr}><is><t xml:space="preserve">${xmlEscape(text)}</t></is></c>`;
}

function sheetXml(rows: readonly IoRow[], columns: readonly IoColumn[], opts: ToXlsxOptions): string {
  const bool = opts.booleanText ?? { true: 'true', false: 'false' };
  const lastRow = rows.length + 1;
  const dimension = `A1:${columnLetter(Math.max(1, columns.length))}${lastRow}`;

  const widths = columns.map((c) => {
    let w = c.header.length;
    for (let i = 0; i < Math.min(rows.length, 50); i++) {
      const text = cellToText(rows[i]?.[c.key], c.type, bool);
      if (text.length > w) w = text.length;
    }
    return Math.min(40, Math.max(10, w + 2));
  });
  const cols = columns.length
    ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
    : '';

  const headerCells = columns
    .map((c, i) => inlineString(`${columnLetter(i + 1)}1`, c.header, STYLE_HEADER))
    .join('');
  const bodyRows = rows.map((row, r) => {
    const rowNo = r + 2;
    const cells = columns
      .map((c, i) => {
        const ref = `${columnLetter(i + 1)}${rowNo}`;
        const num = cellToNumber(row[c.key], c.type);
        if (num !== null) return `<c r="${ref}" s="${STYLE_DECIMAL}"><v>${num}</v></c>`;
        const text = cellToText(row[c.key], c.type, bool);
        return text === '' ? '' : inlineString(ref, text, STYLE_DEFAULT);
      })
      .join('');
    return `<row r="${rowNo}">${cells}</row>`;
  });

  const view = opts.rtl ? ' rightToLeft="1"' : '';
  return (
    `${XML_HEAD}<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    `<dimension ref="${dimension}"/>` +
    `<sheetViews><sheetView workbookViewId="0"${view}>` +
    `<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>${cols}` +
    `<sheetData><row r="1">${headerCells}</row>${bodyRows.join('')}</sheetData>` +
    `</worksheet>`
  );
}

const STYLES_XML =
  `${XML_HEAD}<styleSheet xmlns="${NS_MAIN}">` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="3">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  `<xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

const CONTENT_TYPES_XML =
  `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
  `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
  `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
  `</Types>`;

const ROOT_RELS_XML =
  `${XML_HEAD}<Relationships xmlns="${NS_PKG_REL}">` +
  `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/>` +
  `</Relationships>`;

const WORKBOOK_RELS_XML =
  `${XML_HEAD}<Relationships xmlns="${NS_PKG_REL}">` +
  `<Relationship Id="rId1" Type="${NS_REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
  `<Relationship Id="rId2" Type="${NS_REL}/styles" Target="styles.xml"/>` +
  `</Relationships>`;

function workbookXml(sheetName: string): string {
  return (
    `${XML_HEAD}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    `<sheets><sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`
  );
}

/** Writes an .xlsx workbook with one sheet: bold header row, frozen, numbers as numeric cells (money with 2 decimals). */
export function toXlsx(rows: readonly IoRow[], columns: readonly IoColumn[], opts: ToXlsxOptions = {}): Uint8Array {
  const encoder = new TextEncoder();
  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', data: encoder.encode(CONTENT_TYPES_XML) },
    { name: '_rels/.rels', data: encoder.encode(ROOT_RELS_XML) },
    { name: 'xl/workbook.xml', data: encoder.encode(workbookXml(safeSheetName(opts.sheetName ?? 'Sheet1'))) },
    { name: 'xl/_rels/workbook.xml.rels', data: encoder.encode(WORKBOOK_RELS_XML) },
    { name: 'xl/styles.xml', data: encoder.encode(STYLES_XML) },
    { name: 'xl/worksheets/sheet1.xml', data: encoder.encode(sheetXml(rows, columns, opts)) },
  ];
  return zipStored(entries, opts.now);
}
