import PDFDocument from 'pdfkit';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, WidthType, AlignmentType, BorderStyle, PageOrientation,
  ShadingType, VerticalAlign, Header, Footer,
} from 'docx';
import { formatDateSafe, formatDateUS } from './dateUtils';
import { getJoblyLogoBuffer } from './joblyLogo';
import { getTimesheetHeaderBuffer, getTimesheetFooterBuffer } from './timesheetBranding';
import { RATING_CRITERIA } from '../schemas/performanceReviews.schema';
import { SECTION_H_TITLE, SECTION_H_TEXT, SECTION_I_TITLE, SECTION_I_TEXT } from './enrollmentFormText';

export interface InvoicePDFLineItem {
  itemName?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  isHours?: boolean;   // timesheet-derived line → show Hours/Rate + "/hr"
}

export interface InvoicePDFData {
  invoiceNumber: string;
  docType?: 'invoice' | 'estimate';
  status?: string;
  // Bill-to
  clientName: string;
  clientContactName?: string;
  clientContactEmail?: string;
  clientAddressLines?: string[];
  // Meta
  issueDate: string;
  dueDate: string;
  poNumber?: string;
  paymentTerms?: string;     // human label e.g. "Net 30"
  currency: string;          // ISO code for Intl
  // Line items (generic Qty/Unit price)
  lineItems: InvoicePDFLineItem[];
  // Totals
  subtotal: number;
  discountType?: 'percentage' | 'fixed' | null;
  discountValue?: number;
  discountAmount?: number;
  taxRate: number;           // percent, e.g. 8.5
  taxAmount: number;
  totalAmount: number;
  amountPaid?: number;
  balanceDue?: number;
  // Copy
  notes?: string;
  terms?: string;
}

// Currency-aware money formatter; guards against a bad/legacy currency code
// (Intl throws RangeError) by falling back to USD.
function makeMoney(currency: string): (n: number) => string {
  let fmt: Intl.NumberFormat;
  try { fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }); }
  catch { fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }); }
  return (n: number) => fmt.format(Number(n) || 0);
}

// A selectable invoice theme parameterizes the renderer (it is NOT free-form
// layout code). Absent fields fall back to the Classic defaults.
export interface InvoiceTheme {
  accentColor?: string;   // hex — recolors the doc label, number, table header, total band
  headerStyle?: string;   // 'plain' | 'band' (a top accent stripe)
  footerText?: string;
}

export function generateInvoicePDF(data: InvoicePDFData, theme?: InvoiceTheme): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Palette + geometry. `accent` is the theme color used for the doc label,
    // number, table-header fill, and total band.
    const accent = (theme?.accentColor && /^#[0-9a-f]{6}$/i.test(theme.accentColor)) ? theme.accentColor : '#2563EB';
    const navy = '#0F2942';
    const gray = '#6B7280';
    const lightGray = '#9CA3AF';
    const ink = '#111827';
    const rule = '#E5E7EB';
    const M = 50;                       // page margin
    const PAGE_W = doc.page.width;       // 595.28 on A4
    const RIGHT = PAGE_W - M;            // ~545
    const CONTENT_W = RIGHT - M;         // ~495
    const PAGE_BOTTOM = doc.page.height - 90; // leave room for the footer band
    const money = makeMoney(data.currency);
    const docLabel = data.docType === 'estimate' ? 'ESTIMATE' : 'INVOICE';

    // Truncate a string to fit maxW at the doc's CURRENT font/size (set the font
    // before calling). pdfkit's `lineBreak:false`/`ellipsis` don't reliably keep
    // a cell to one line, so we clip manually to prevent rows wrapping/overlapping.
    const fitText = (text: string, maxW: number): string => {
      if (!text) return '';
      if (doc.widthOfString(text) <= maxW) return text;
      let t = text;
      while (t.length > 1 && doc.widthOfString(t + '…') > maxW) t = t.slice(0, -1);
      return t + '…';
    };

    // ── Header: optional accent stripe + logo (left) + document block (right) ──
    if (theme?.headerStyle === 'band') {
      doc.rect(0, 0, PAGE_W, 8).fill(accent);
    }
    try {
      doc.image(getJoblyLogoBuffer(), M, 44, { width: 120 });   // width-only keeps aspect
    } catch {
      doc.fillColor(navy).fontSize(20).font('Helvetica-Bold').text('Jobly Solutions', M, 48);
    }
    doc.fillColor(accent).fontSize(26).font('Helvetica-Bold')
      .text(docLabel, RIGHT - 240, 44, { width: 240, align: 'right' });
    doc.fillColor(accent).fontSize(12).font('Helvetica-Bold')
      .text(data.invoiceNumber, RIGHT - 240, 76, { width: 240, align: 'right' });
    doc.fillColor(gray).fontSize(9).font('Helvetica')
      .text('Jobly Solutions · Workforce Management', RIGHT - 260, 94, { width: 260, align: 'right' })
      .text('billing@joblysolutions.com', RIGHT - 260, 106, { width: 260, align: 'right' });

    // Divider rule
    doc.moveTo(M, 128).lineTo(RIGHT, 128).lineWidth(1).strokeColor(rule).stroke();

    // ── Bill To (left) + Meta (right) ─────────────────────────────────────────
    let leftY = 148;
    doc.fillColor(lightGray).fontSize(9).font('Helvetica-Bold').text('BILL TO', M, leftY);
    leftY += 16;
    doc.fillColor(ink).fontSize(12).font('Helvetica-Bold').text(data.clientName || '—', M, leftY, { width: 270 });
    leftY += 18;
    const billLines = [
      data.clientContactName,
      data.clientContactEmail,
      ...(data.clientAddressLines ?? []),
    ].filter((l): l is string => !!l && l.trim() !== '');
    doc.fillColor(gray).fontSize(10).font('Helvetica');
    for (const line of billLines) {
      doc.text(line, M, leftY, { width: 270 });
      leftY += 14;
    }

    // Meta rows — label column [350,435], value column [440,545], 18pt pitch.
    // Disjoint x-ranges + generous value width prevent the old date overlap.
    const metaLabelX = 350, metaValueX = 440, metaValueW = RIGHT - metaValueX;
    let metaY = 148;
    const statusColor = data.status === 'paid' ? '#059669'
      : data.status === 'overdue' ? '#DC2626' : navy;
    const metaRow = (label: string, value: string, valueColor = ink) => {
      doc.fillColor(gray).fontSize(9.5).font('Helvetica')
        .text(label, metaLabelX, metaY, { width: 85, align: 'left' });
      doc.fillColor(valueColor).fontSize(9.5).font('Helvetica-Bold')
        .text(value, metaValueX, metaY, { width: metaValueW, align: 'right' });
      metaY += 18;
    };
    metaRow('Issue Date', formatDate(data.issueDate));
    metaRow('Due Date', formatDate(data.dueDate));
    if (data.paymentTerms) metaRow('Payment Terms', data.paymentTerms);
    if (data.poNumber) metaRow('P.O. Number', data.poNumber);
    if (data.status) metaRow('Status', data.status.toUpperCase(), statusColor);

    // ── Line items table ──────────────────────────────────────────────────────
    const allHours = data.lineItems.length > 0 && data.lineItems.every(li => li.isHours);
    const qtyHeader = allHours ? 'Hours' : 'Qty';
    const priceHeader = allHours ? 'Rate' : 'Unit price';
    // Columns within CONTENT_W (495): Description 250, Qty 60, Unit price 95, Amount 90
    const colX = [M, M + 250, M + 310, M + 405];   // 50, 300, 360, 455
    const colW = [250, 60, 95, 90];

    const drawTableHeader = (top: number) => {
      doc.rect(M, top, CONTENT_W, 26).fill(accent);
      doc.fillColor('#ffffff').fontSize(9.5).font('Helvetica-Bold');
      doc.text('Description', colX[0] + 8, top + 8, { width: colW[0] - 12, align: 'left' });
      doc.text(qtyHeader, colX[1], top + 8, { width: colW[1] - 8, align: 'right' });
      doc.text(priceHeader, colX[2], top + 8, { width: colW[2] - 8, align: 'right' });
      doc.text('Amount', colX[3], top + 8, { width: colW[3] - 8, align: 'right' });
    };

    let y = Math.max(leftY, metaY) + 18;
    drawTableHeader(y);
    y += 26;

    data.lineItems.forEach((item, idx) => {
      const rowH = item.itemName ? 32 : 22;
      // Pagination: start a fresh page (with a repeated header) if the row would overflow.
      if (y + rowH > PAGE_BOTTOM) {
        doc.addPage();
        y = M;
        drawTableHeader(y);
        y += 26;
      }
      doc.rect(M, y, CONTENT_W, rowH).fill(idx % 2 === 0 ? '#F9FAFB' : '#FFFFFF');
      // Description (+ optional item name on the first line). Each cell is
      // pre-truncated to one line so it can't wrap into the next fixed-height row.
      const descW = colW[0] - 12;
      if (item.itemName) {
        doc.fillColor(ink).fontSize(9.5).font('Helvetica-Bold')
          .text(fitText(item.itemName, descW), colX[0] + 8, y + 6, { lineBreak: false });
        doc.fillColor(gray).fontSize(8.5).font('Helvetica')
          .text(fitText(item.description || '', descW), colX[0] + 8, y + 19, { lineBreak: false });
      } else {
        doc.fillColor(ink).fontSize(9.5).font('Helvetica')
          .text(fitText(item.description || '', descW), colX[0] + 8, y + 7, { lineBreak: false });
      }
      const vy = y + (item.itemName ? 11 : 7);
      doc.fillColor(ink).fontSize(9.5).font('Helvetica');
      doc.text(String(item.quantity ?? 0), colX[1], vy, { width: colW[1] - 8, align: 'right' });
      doc.text(`${money(item.unitPrice)}${item.isHours ? '/hr' : ''}`, colX[2], vy, { width: colW[2] - 8, align: 'right' });
      doc.fillColor(ink).font('Helvetica-Bold').text(money(item.amount), colX[3], vy, { width: colW[3] - 8, align: 'right' });
      y += rowH;
    });

    // ── Totals (right-aligned) ────────────────────────────────────────────────
    doc.moveTo(colX[2], y + 8).lineTo(RIGHT, y + 8).lineWidth(1).strokeColor(rule).stroke();
    y += 18;
    if (y > PAGE_BOTTOM - 130) { doc.addPage(); y = M; }

    const totLabelX = 330, totValX = M + 405, totValW = 90;
    const totalRow = (label: string, value: string, opts: { bold?: boolean; highlight?: boolean; color?: string } = {}) => {
      if (opts.highlight) {
        doc.rect(totLabelX - 4, y - 5, RIGHT - totLabelX + 4, 26).fill(accent);
        doc.fillColor('#ffffff').fontSize(12).font('Helvetica-Bold');
        doc.text(label, totLabelX + 6, y + 2, { width: 120, align: 'left' });
        doc.text(value, totValX, y + 2, { width: totValW, align: 'right' });
        y += 28;
        return;
      }
      doc.fillColor(opts.color ?? (opts.bold ? ink : gray)).fontSize(10).font(opts.bold ? 'Helvetica-Bold' : 'Helvetica');
      doc.text(label, totLabelX, y, { width: 120, align: 'left' });
      doc.text(value, totValX, y, { width: totValW, align: 'right' });
      y += 18;
    };

    // NOTE: use an ASCII hyphen, not the Unicode minus (U+2212) — pdfkit's
    // standard Helvetica (WinAnsi) renders U+2212 as a wrong glyph.
    totalRow('Subtotal', money(data.subtotal));
    if (data.discountAmount && data.discountAmount > 0) {
      const dl = data.discountType === 'percentage' && data.discountValue ? `Discount (${data.discountValue}%)` : 'Discount';
      totalRow(dl, `-${money(data.discountAmount)}`);
    }
    if (data.taxRate > 0) totalRow(`Tax (${Number(data.taxRate).toFixed(2).replace(/\.?0+$/, '')}%)`, money(data.taxAmount));
    totalRow('Total', money(data.totalAmount), { highlight: true });
    if (data.amountPaid && data.amountPaid > 0) {
      totalRow('Amount Paid', `-${money(data.amountPaid)}`, { color: '#059669' });
      totalRow('Balance Due', money(data.balanceDue ?? (data.totalAmount - data.amountPaid)), { bold: true });
    }

    // ── Notes + Terms/Footer copy ─────────────────────────────────────────────
    y += 14;
    const block = (heading: string, body: string) => {
      const needed = 30 + Math.ceil(body.length / 90) * 12;
      if (y + needed > PAGE_BOTTOM) { doc.addPage(); y = M; }
      doc.fillColor(lightGray).fontSize(9).font('Helvetica-Bold').text(heading, M, y);
      y += 14;
      doc.fillColor(gray).fontSize(9.5).font('Helvetica').text(body, M, y, { width: CONTENT_W });
      y = doc.y + 14;
    };
    if (data.notes) block('NOTES', data.notes);
    if (data.terms) block('TERMS', data.terms);

    // ── Footer band (drawn once, on the final page) ───────────────────────────
    // The footer sits below the bottom margin; pdfkit would auto-paginate any
    // text past page.maxY() onto a blank next page. Zero the bottom margin (and
    // disable line-breaking) so the footer text stays on the current page.
    doc.page.margins.bottom = 0;
    const footerY = doc.page.height - 50;
    doc.rect(0, footerY, PAGE_W, 50).fill('#F3F4F6');
    doc.fillColor(gray).fontSize(8).font('Helvetica')
      .text(theme?.footerText || 'Jobly Solutions  ·  billing@joblysolutions.com  ·  www.joblysolutions.com', M, footerY + 18, {
        width: CONTENT_W, align: 'center', lineBreak: false,
      });

    doc.end();
  });
}

function formatDate(dateStr: string): string {
  return formatDateSafe(dateStr, { long: true }) || dateStr;
}

export interface MonthlyTimesheetPDFData {
  displayId: string;
  employeeName: string;
  employeeDisplayId: string;
  jobTitle?: string;
  monthLabel: string;
  rows: Array<{ date: string; day: string; project: string; task: string; start: string; end: string; hours: number; status: string }>;
  totalHours: number;
  expectedHours: number;
  balance: number;
  workingDays: number;
  leaveDays: number;
  notes?: string;
}

// Full-width letterhead. The header source image (2547x450) has its content
// (logo + contact block) sitting well off-center — roughly rows 65-430 out
// of 450px, i.e. much more empty margin above than below — so a naive
// symmetric center-crop wastes crop budget on the (larger) top margin and
// clips the (already-tight) bottom content first as the target height
// shrinks. Crop asymmetrically to the actual content band instead.
const TS_HEADER_CROP_TOP_PX = 65;
const TS_HEADER_CROP_BOTTOM_PX = 430;
const TS_HEADER_NATIVE_W = 2547;
const TS_HEADER_H = 121; // = (430-65) * (pageWidth/2547), computed per-page below
const TS_HEADER_RESERVED = TS_HEADER_H;
const TS_FOOTER_H = 22;  // thin wave-graphic strip, bottom-cropped from the 2539x449 source
const TS_STATUS_COLORS: Record<string, string> = {
  present: '#059669', leave: '#D97706', holiday: '#7C3AED',
  absent: '#DC2626', weekend: '#6B7280', none: '#64748B',
};

// Letterhead, drawn on every physical page (including a mid-month overflow
// continuation page) so the branding is never missing partway through a
// document.
function drawTimesheetChrome(doc: PDFKit.PDFDocument): void {
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const scale = pageW / TS_HEADER_NATIVE_W;

  // Header: full width, cropped to the actual content band (see note above)
  // by shifting the scaled image up so that source-row TS_HEADER_CROP_TOP_PX
  // lands at y=0, then clipping to the target height.
  doc.save();
  doc.rect(0, 0, pageW, TS_HEADER_H).clip();
  doc.image(getTimesheetHeaderBuffer(), 0, -TS_HEADER_CROP_TOP_PX * scale, { width: pageW });
  doc.restore();

  // Footer: full-width thin strip. pdfkit's `cover` only scales+positions —
  // it does not clip, so the scaled image is drawn in full and can overflow
  // the given box; explicitly clip so the "crop" is an actual crop.
  doc.save();
  doc.rect(0, pageH - TS_FOOTER_H, pageW, TS_FOOTER_H).clip();
  doc.image(getTimesheetFooterBuffer(), 0, pageH - TS_FOOTER_H, { cover: [pageW, TS_FOOTER_H], valign: 'bottom' });
  doc.restore();
}

// Starts a fresh page with the letterhead already drawn, returning the y
// coordinate where body content should resume.
function newChromedTimesheetPage(doc: PDFKit.PDFDocument): number {
  doc.addPage();
  drawTimesheetChrome(doc);
  return TS_HEADER_RESERVED + 14;
}

// Draws one month's full timesheet report (letterhead, title, employee info
// card, table, summary card) onto the CURRENT page of an already-open
// PDFDocument. Shared by the single-month export and the yearly export
// (which calls this once per month, adding a page between each) so the two
// can never visually drift apart.
function drawMonthlyTimesheetPage(doc: PDFKit.PDFDocument, data: MonthlyTimesheetPDFData): void {
    const blue = '#4069FF';
    const navy = '#04213F';
    const gray = '#6B7280';
    const ink = '#111827';
    const pageRight = doc.page.width - 40;
    const contentW = doc.page.width - 80;
    const contentBottom = doc.page.height - TS_FOOTER_H - 24;

    drawTimesheetChrome(doc);

    // Title row: document title (left) + month (right), with a thin accent rule.
    let y = TS_HEADER_RESERVED + 14;
    doc.fillColor(navy).fontSize(12).font('Helvetica-Bold').text('MONTHLY TIMESHEET', 40, y);
    doc.fillColor(blue).fontSize(15).font('Helvetica-Bold')
      .text(data.monthLabel, pageRight - 220, y - 2, { width: 220, align: 'right' });
    y += 20;
    doc.rect(40, y, contentW, 1.5).fill(blue);
    y += 12;

    // Employee info card — 4-column label/value grid in a bordered box.
    const cardH = 44;
    doc.roundedRect(40, y, contentW, cardH, 4).fillAndStroke('#FAFBFC', '#E5E7EB');
    const infoCols = [
      { label: 'EMPLOYEE', value: data.employeeName },
      { label: 'EMPLOYEE ID', value: data.employeeDisplayId },
      { label: 'JOB TITLE', value: data.jobTitle || '—' },
      { label: 'SHEET ID', value: data.displayId },
    ];
    const infoColW = contentW / infoCols.length;
    infoCols.forEach((c, i) => {
      const x = 40 + i * infoColW + 14;
      doc.fillColor(gray).fontSize(7).font('Helvetica-Bold').text(c.label, x, y + 9, { width: infoColW - 20 });
      doc.fillColor(navy).fontSize(10.5).font('Helvetica-Bold').text(c.value, x, y + 21, { width: infoColW - 20, height: 14, ellipsis: true });
    });
    y += cardH + 14;

    // Table
    const cols = [
      { h: 'Date', w: 80, align: 'left' as const },
      { h: 'Day', w: 45, align: 'left' as const },
      { h: 'Project', w: 130, align: 'left' as const },
      { h: 'Task', w: 220, align: 'left' as const },
      { h: 'Start', w: 55, align: 'center' as const },
      { h: 'End', w: 55, align: 'center' as const },
      { h: 'Hours', w: 60, align: 'right' as const },
      { h: 'Status', w: 65, align: 'center' as const },
    ];
    const tableLeft = 40;
    const colX: number[] = [tableLeft];
    for (let i = 1; i < cols.length; i++) colX.push(colX[i - 1] + cols[i - 1].w);

    const drawTableHeader = (headerY: number) => {
      doc.fillColor(navy).fontSize(8.5).font('Helvetica-Bold');
      cols.forEach((c, i) => doc.text(c.h.toUpperCase(), colX[i] + 6, headerY + 7, { width: c.w - 12, align: c.align }));
      doc.rect(tableLeft, headerY + 22, contentW, 1.5).fill(blue);
    };
    drawTableHeader(y);
    y += 24;

    doc.fontSize(8.5);
    data.rows.forEach(r => {
      if (y > contentBottom) {            // new page — redraw full letterhead + table header
        y = newChromedTimesheetPage(doc);
        drawTableHeader(y);
        y += 24;
      }
      doc.rect(tableLeft, y + 22, contentW, 0.5).fill('#EEF0F3');
      const vals = [
        formatDateUS(r.date), r.day, r.project || '—', r.task || '—',
        r.start || '—', r.end || '—', r.hours > 0 ? r.hours.toFixed(1) : '—',
      ];
      cols.slice(0, 7).forEach((c, i) => {
        doc.fillColor(ink).font('Helvetica').text(String(vals[i]), colX[i] + 6, y + 5, { width: c.w - 12, height: 14, align: c.align, ellipsis: true });
      });
      const statusLabel = r.status.charAt(0).toUpperCase() + r.status.slice(1);
      doc.fillColor(TS_STATUS_COLORS[r.status] ?? ink).font('Helvetica-Bold')
        .text(statusLabel, colX[7] + 6, y + 5, { width: cols[7].w - 12, height: 14, align: cols[7].align, ellipsis: true });
      y += 24;
    });

    // Summary "totals card" — 5 metrics side by side.
    y += 14;
    if (y > contentBottom - 90) { y = newChromedTimesheetPage(doc); }
    const summaryH = 66;
    doc.roundedRect(40, y, contentW, summaryH, 4).fillAndStroke('#FAFBFC', '#E5E7EB');
    const sum: Array<[string, string]> = [
      ['Total Hours Logged', `${data.totalHours.toFixed(1)} hrs`],
      ['Expected Hours', `${data.expectedHours.toFixed(1)} hrs`],
      ['Balance', `${data.balance >= 0 ? '+' : ''}${data.balance.toFixed(1)} hrs`],
      ['Working Days', String(data.workingDays)],
      ['Leave Days', String(data.leaveDays)],
    ];
    const sumColW = contentW / sum.length;
    sum.forEach(([label, value], i) => {
      const x = 40 + i * sumColW + 16;
      doc.fillColor(gray).fontSize(8).font('Helvetica').text(label, x, y + 14, { width: sumColW - 24 });
      doc.fillColor(navy).fontSize(15).font('Helvetica-Bold').text(value, x, y + 30, { width: sumColW - 24 });
    });
    y += summaryH + 14;

    if (data.notes) {
      if (y > contentBottom - 30) { y = newChromedTimesheetPage(doc); }
      doc.fillColor(navy).fontSize(10).font('Helvetica-Bold').text('Notes:', 40, y);
      y += 14;
      doc.fillColor(gray).fontSize(9).font('Helvetica').text(data.notes, 40, y, { width: contentW });
    }
}

export function generateMonthlyTimesheetPDF(data: MonthlyTimesheetPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // A4 landscape so the wide attendance table fits.
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape', bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    drawMonthlyTimesheetPage(doc, data);
    doc.end();
  });
}

// One combined PDF covering a full year — one page (or more, if a month's
// rows overflow) per month, reusing the exact same per-month layout as
// generateMonthlyTimesheetPDF so the two can never visually drift apart.
export function generateYearlyTimesheetPDF(months: MonthlyTimesheetPDFData[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape', bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    months.forEach((monthData, i) => {
      if (i > 0) doc.addPage();
      drawMonthlyTimesheetPage(doc, monthData);
    });
    doc.end();
  });
}

const NO_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};
// Hairline row divider (body rows) vs. a bolder accent rule (table header row).
const HAIRLINE_BOTTOM = { ...NO_BORDERS, bottom: { style: BorderStyle.SINGLE, size: 2, color: 'EEF0F3' } };
const RULE_BOTTOM = (color: string, size: number) => ({ ...NO_BORDERS, bottom: { style: BorderStyle.SINGLE, size, color } });

const DOCX_STATUS_COLORS: Record<string, string> = {
  present: '059669', leave: 'D97706', holiday: '7C3AED',
  absent: 'DC2626', weekend: '6B7280', none: '64748B',
};

// Word-document equivalent of generateMonthlyTimesheetPDF, same input shape so
// the two exports can never drift apart. Uses docx's native Header/Footer
// sections for the letterhead (a real Word header/footer region, not a body
// table masquerading as one) — the header shows the whole logo/contact image
// (scaled down, never cropped, since it carries real information), the
// footer shows the whole wave graphic at a small decorative size.
export async function generateMonthlyTimesheetDOCX(data: MonthlyTimesheetPDFData): Promise<Buffer> {
  const navy = '04213F';
  const blue = '4069FF';
  const gray = '6B7280';
  const ink = '111827';

  const spacer = () => new Paragraph({ text: '', spacing: { after: 100 } });

  const headerSection = new Header({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new ImageRun({ type: 'jpg', data: getTimesheetHeaderBuffer(), transformation: { width: 390, height: 69 } })],
    })],
  });
  const footerSection = new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new ImageRun({ type: 'jpg', data: getTimesheetFooterBuffer(), transformation: { width: 170, height: 30 } })],
    })],
  });

  // Title row: document title (left) + month (right) — a borderless 2-cell
  // table, same lightweight pattern the old navy header used, minus the shading.
  const titleTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: RULE_BOTTOM(blue, 12),
    rows: [new TableRow({
      children: [
        new TableCell({
          width: { size: 60, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 40, bottom: 80, left: 0, right: 0 },
          children: [new Paragraph({ children: [new TextRun({ text: 'MONTHLY TIMESHEET', bold: true, color: navy, size: 22 })] })],
        }),
        new TableCell({
          width: { size: 40, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 40, bottom: 80, left: 0, right: 0 },
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: data.monthLabel, bold: true, color: blue, size: 28 })] })],
        }),
      ],
    })],
  });

  // Employee info card — 4-column label/value grid in a bordered box.
  const CARD_BORDER = { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' };
  const infoCols = [
    { label: 'EMPLOYEE', value: data.employeeName },
    { label: 'EMPLOYEE ID', value: data.employeeDisplayId },
    { label: 'JOB TITLE', value: data.jobTitle || '—' },
    { label: 'SHEET ID', value: data.displayId },
  ];
  const infoCardTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: CARD_BORDER, bottom: CARD_BORDER, left: CARD_BORDER, right: CARD_BORDER, insideHorizontal: CARD_BORDER, insideVertical: CARD_BORDER },
    rows: [new TableRow({
      children: infoCols.map(c => new TableCell({
        width: { size: 25, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'FAFBFC' },
        margins: { top: 100, bottom: 100, left: 120, right: 120 },
        children: [
          new Paragraph({ children: [new TextRun({ text: c.label, bold: true, color: gray, size: 13 })] }),
          new Paragraph({ children: [new TextRun({ text: c.value, bold: true, color: navy, size: 21 })] }),
        ],
      })),
    })],
  });

  // 8-column attendance table
  const cols = ['Date', 'Day', 'Project', 'Task', 'Start', 'End', 'Hours', 'Status'];
  const colWidths = [10, 6, 16, 28, 7, 7, 7, 8]; // percent, mirrors the PDF's 80/45/130/230/55/55/55/65 ratio
  const headerRow = new TableRow({
    children: cols.map((h, i) => new TableCell({
      width: { size: colWidths[i], type: WidthType.PERCENTAGE },
      borders: RULE_BOTTOM(blue, 10),
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
      children: [new Paragraph({
        alignment: h === 'Hours' ? AlignmentType.RIGHT : undefined,
        children: [new TextRun({ text: h.toUpperCase(), bold: true, color: navy, size: 16 })],
      })],
    })),
  });
  const bodyRows = data.rows.map(r => {
    const vals = [
      formatDateUS(r.date), r.day, r.project || '—', r.task || '—',
      r.start || '—', r.end || '—', r.hours > 0 ? r.hours.toFixed(1) : '—',
    ];
    const statusLabel = r.status.charAt(0).toUpperCase() + r.status.slice(1);
    return new TableRow({
      children: [
        ...vals.map((v, i) => new TableCell({
          borders: HAIRLINE_BOTTOM,
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [new Paragraph({
            alignment: cols[i] === 'Hours' ? AlignmentType.RIGHT : undefined,
            children: [new TextRun({ text: String(v), size: 15, color: ink })],
          })],
        })),
        new TableCell({
          borders: HAIRLINE_BOTTOM,
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [new Paragraph({ children: [new TextRun({ text: statusLabel, bold: true, size: 15, color: DOCX_STATUS_COLORS[r.status] ?? ink })] })],
        }),
      ],
    });
  });
  const attendanceTable = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...bodyRows] });

  // Summary "totals card" — 5 metrics side by side in a bordered table.
  const sum: Array<[string, string]> = [
    ['Total Hours Logged', `${data.totalHours.toFixed(1)} hrs`],
    ['Expected Hours', `${data.expectedHours.toFixed(1)} hrs`],
    ['Balance', `${data.balance >= 0 ? '+' : ''}${data.balance.toFixed(1)} hrs`],
    ['Working Days', String(data.workingDays)],
    ['Leave Days', String(data.leaveDays)],
  ];
  const summaryTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: CARD_BORDER, bottom: CARD_BORDER, left: CARD_BORDER, right: CARD_BORDER, insideHorizontal: CARD_BORDER, insideVertical: CARD_BORDER },
    rows: [new TableRow({
      children: sum.map(([label, value]) => new TableCell({
        width: { size: 20, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'FAFBFC' },
        margins: { top: 140, bottom: 140, left: 140, right: 140 },
        children: [
          new Paragraph({ children: [new TextRun({ text: label, color: gray, size: 15 })] }),
          new Paragraph({ children: [new TextRun({ text: value, bold: true, color: navy, size: 24 })], spacing: { before: 60 } }),
        ],
      })),
    })],
  });

  const notesParas = data.notes ? [
    new Paragraph({ children: [new TextRun({ text: 'Notes:', bold: true, color: navy, size: 20 })], spacing: { before: 160 } }),
    new Paragraph({ children: [new TextRun({ text: data.notes, color: gray, size: 18 })] }),
  ] : [];

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { orientation: PageOrientation.LANDSCAPE, width: 16838, height: 11906 },
          margin: { top: 720, bottom: 720, left: 720, right: 720 },
        },
      },
      headers: { default: headerSection },
      footers: { default: footerSection },
      children: [
        titleTable, spacer(), infoCardTable, spacer(),
        attendanceTable, spacer(), summaryTable, ...notesParas,
      ],
    }],
  });

  return Packer.toBuffer(doc);
}

// ── Performance Appraisal Report PDF ─────────────────────────────────────────
// Portrait US Letter, matching the reference "Employee Performance Appraisal
// Report" template. Reuses the exact same letterhead images and asymmetric
// crop technique as the timesheet redesign (see TS_HEADER_CROP_TOP_PX /
// TS_HEADER_CROP_BOTTOM_PX / TS_HEADER_NATIVE_W above) — same brand assets,
// same visual language, just recomputed for this page's narrower width.

export interface PerformanceReviewPDFData {
  displayId: string;
  employeeName: string;
  employeeDisplayId: string;
  salutation: string;
  employeeNumber: string;
  titlePayrollTitle: string;
  employeeType: string;
  supervisorName: string;
  supervisedFullPeriod: boolean;
  supervisedMonths?: number;
  periodStart: string;
  periodEnd: string;
  jobRelatedPerformance: string;
  overallEvaluation: string;
  ratings: Record<string, number>;
  jobFunction: string;
  weightPercent: number;
  statusGoal: string;
  completePercent: number;
  performanceEvaluation: string;
  futureGoals: string;
  employeeSignedDate?: string;
  supervisorSignedDate?: string;
}

const PR_PAGE_W = 612; // US Letter width in points
const PR_HEADER_H = Math.round((TS_HEADER_CROP_BOTTOM_PX - TS_HEADER_CROP_TOP_PX) * (PR_PAGE_W / TS_HEADER_NATIVE_W));
const PR_FOOTER_H = 16;
const PR_MARGIN = 44;

function drawPerformanceReviewChrome(doc: PDFKit.PDFDocument): void {
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const scale = pageW / TS_HEADER_NATIVE_W;

  doc.save();
  doc.rect(0, 0, pageW, PR_HEADER_H).clip();
  doc.image(getTimesheetHeaderBuffer(), 0, -TS_HEADER_CROP_TOP_PX * scale, { width: pageW });
  doc.restore();

  doc.save();
  doc.rect(0, pageH - PR_FOOTER_H, pageW, PR_FOOTER_H).clip();
  doc.image(getTimesheetFooterBuffer(), 0, pageH - PR_FOOTER_H, { cover: [pageW, PR_FOOTER_H], valign: 'bottom' });
  doc.restore();
}

function drawReviewSectionHeading(doc: PDFKit.PDFDocument, text: string): void {
  const navy = '#04213F';
  doc.moveDown(0.7);
  doc.x = doc.page.margins.left;
  doc.fillColor(navy).fontSize(10.5).font('Helvetica-Bold').text(text.toUpperCase());
  doc.moveDown(0.25);
  doc.x = doc.page.margins.left;
}

function drawReviewNarrative(doc: PDFKit.PDFDocument, text: string): void {
  const ink = '#111827';
  doc.fillColor(ink).fontSize(9.5).font('Helvetica').text(text?.trim() || '—', { align: 'left', lineGap: 2.5 });
  doc.x = doc.page.margins.left;
}

// Bordered info card — a grid of label/value pairs, 2 columns x N rows.
// Advances doc.y past the card; does not paginate (cards are short).
function drawInfoCard(doc: PDFKit.PDFDocument, rows: Array<[string, string, string, string]>): void {
  const gray = '#6B7280';
  const navy = '#04213F';
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const rowH = 26;
  const cardH = rowH * rows.length + 10;
  const cardY = doc.y;
  doc.roundedRect(left, cardY, width, cardH, 4).fillAndStroke('#FAFBFC', '#E5E7EB');
  const colW = width / 2;
  rows.forEach(([label1, value1, label2, value2], i) => {
    const y = cardY + 6 + i * rowH;
    doc.fillColor(gray).fontSize(6.5).font('Helvetica-Bold').text(label1, left + 12, y, { width: colW - 24 });
    doc.fillColor(navy).fontSize(9).font('Helvetica-Bold').text(value1 || '—', left + 12, y + 9, { width: colW - 24, ellipsis: true, height: 12 });
    doc.fillColor(gray).fontSize(6.5).font('Helvetica-Bold').text(label2, left + colW + 12, y, { width: colW - 24 });
    doc.fillColor(navy).fontSize(9).font('Helvetica-Bold').text(value2 || '—', left + colW + 12, y + 9, { width: colW - 24, ellipsis: true, height: 12 });
  });
  doc.x = left;
  doc.y = cardY + cardH + 12;
}

// 12-criterion x 5-column rating grid — empty circle per column, filled at
// the selected rating (columns run 5 to 1, left to right, matching the
// source document). Paginates manually (checking remaining space per row)
// since this is a dense grid, not flowing text.
function drawRatingsGrid(doc: PDFKit.PDFDocument, ratings: Record<string, number>): void {
  const navy = '#04213F';
  const blue = '#4069FF';
  const ink = '#111827';
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const labelW = width * 0.5;
  const colW = (width - labelW) / 5;
  const rowH = 17;
  const bottomLimit = doc.page.height - doc.page.margins.bottom;

  const drawHeaderRow = () => {
    // Capture y once — pdfkit advances doc.y after every .text() call even
    // when an explicit x/y is given, so re-reading doc.y per-column would
    // stagger each subsequent number diagonally instead of aligning them.
    const y = doc.y;
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(navy);
    ['5', '4', '3', '2', '1'].forEach((n, i) => {
      doc.text(n, left + labelW + i * colW, y, { width: colW, align: 'center' });
    });
    doc.y = y + 12;
    doc.moveTo(left, doc.y).lineTo(left + labelW + 5 * colW, doc.y).lineWidth(1.2).strokeColor(blue).stroke();
    doc.y += 4;
  };

  drawHeaderRow();
  for (const c of RATING_CRITERIA) {
    if (doc.y + rowH > bottomLimit) {
      doc.addPage(); // 'pageAdded' listener redraws the letterhead
      doc.x = left;
      doc.y = doc.page.margins.top;
      drawHeaderRow();
    }
    const rowY = doc.y;
    doc.fontSize(7.5).font('Helvetica').fillColor(ink).text(c.label, left, rowY + 3, { width: labelW - 8 });
    const selected = ratings[c.key];
    for (let col = 0; col < 5; col++) {
      const ratingValue = 5 - col;
      const cx = left + labelW + col * colW + colW / 2;
      const cy = rowY + rowH / 2;
      doc.circle(cx, cy, 4.5).lineWidth(0.8).strokeColor('#9CA3AF').stroke();
      if (selected === ratingValue) doc.circle(cx, cy, 2.4).fillColor(blue).fill();
    }
    doc.y = rowY + rowH;
  }
  doc.x = left;
  doc.y += 10;
}

export function generatePerformanceReviewPDF(data: PerformanceReviewPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const blue = '#4069FF';
    const navy = '#04213F';
    const gray = '#6B7280';
    const ink = '#111827';

    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: PR_HEADER_H + 18, bottom: PR_FOOTER_H + 26, left: PR_MARGIN, right: PR_MARGIN },
      bufferPages: true,
    });
    doc.on('pageAdded', () => drawPerformanceReviewChrome(doc));
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawPerformanceReviewChrome(doc); // first page — 'pageAdded' doesn't fire for it

    // Title block
    doc.fillColor(navy).fontSize(15).font('Helvetica-Bold').text('EMPLOYEE PERFORMANCE APPRAISAL REPORT', { align: 'center' });
    doc.fillColor(blue).fontSize(11).font('Helvetica-Bold').text('Jobly Solutions LLC.', { align: 'center' });
    doc.moveDown(0.3);
    doc.fillColor(gray).fontSize(8).font('Helvetica').text('This form is used to evaluate the performance of employees.', { align: 'center' });
    doc.moveDown(0.4);
    doc.fillColor(ink).fontSize(9).font('Helvetica-Bold')
      .text(`Period covered (month/day/year): ${formatDateUS(data.periodStart)}  to  ${formatDateUS(data.periodEnd)}`, { align: 'center' });
    doc.moveDown(0.6);
    doc.x = doc.page.margins.left;

    // Employee / supervisor info card
    const fullName = `${data.salutation ? data.salutation + ' ' : ''}${data.employeeName}`.trim();
    const supervisedLine = data.supervisedFullPeriod
      ? 'Yes'
      : `No (${data.supervisedMonths ?? 0} months)`;
    drawInfoCard(doc, [
      ['EMPLOYEE', fullName, 'EMPLOYEE NUMBER', data.employeeNumber || data.employeeDisplayId],
      ['TITLE / PAYROLL TITLE', data.titlePayrollTitle, 'EMPLOYEE TYPE', data.employeeType],
      ['SUPERVISOR', data.supervisorName, 'SUPERVISED FOR ENTIRE PERIOD?', supervisedLine],
    ]);

    drawReviewSectionHeading(doc, 'Job-Related Performance');
    drawReviewNarrative(doc, data.jobRelatedPerformance);

    drawReviewSectionHeading(doc, 'Overall Evaluation');
    drawReviewNarrative(doc, data.overallEvaluation);

    doc.moveDown(0.6);
    doc.x = doc.page.margins.left;
    doc.fillColor(navy).fontSize(9.5).font('Helvetica-Bold')
      .text("Supervisor's Recommendation:", { continued: true })
      .font('Helvetica').fillColor(ink)
      .text(' Based on meeting the targets/accomplishments, performance for the above period is rated as below.');
    doc.moveDown(0.4);
    doc.x = doc.page.margins.left;
    doc.fillColor(gray).fontSize(7.5).font('Helvetica')
      .text('Rating key: (1) Unsatisfactory - Requires constant supervision.   (2) Marginal - Needs improvement, not always on time.   (3) Meets Requirements - Tasks completed on time.   (4) Exceeds Requirements - Goes above and beyond.   (5) Exceptional - Always exceeds what is required.', { lineGap: 1.5 });
    doc.moveDown(0.5);
    doc.x = doc.page.margins.left;

    drawRatingsGrid(doc, data.ratings ?? {});

    // Job function / weight / status / complete
    drawInfoCard(doc, [
      ['JOB FUNCTION', data.jobFunction, 'WEIGHT', `${data.weightPercent}%`],
      ['STATUS', data.statusGoal, 'COMPLETE', `${data.completePercent}%`],
    ]);

    drawReviewSectionHeading(doc, 'Performance Evaluation');
    drawReviewNarrative(doc, data.performanceEvaluation);

    drawReviewSectionHeading(doc, 'Future Goals or Performance Expectations');
    drawReviewNarrative(doc, data.futureGoals);

    // Signatures
    doc.moveDown(1.2);
    doc.x = doc.page.margins.left;
    if (doc.y > doc.page.height - doc.page.margins.bottom - 90) {
      doc.addPage();
      doc.x = doc.page.margins.left;
      doc.y = doc.page.margins.top;
    }
    doc.fillColor(navy).fontSize(9.5).font('Helvetica-Bold').text('SIGNATURES');
    doc.moveDown(1.4);
    const sigLeft = doc.page.margins.left;
    const sigWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const lineY = doc.y;
    doc.moveTo(sigLeft, lineY).lineTo(sigLeft + sigWidth * 0.55, lineY).lineWidth(0.8).strokeColor('#9CA3AF').stroke();
    doc.moveTo(sigLeft + sigWidth * 0.65, lineY).lineTo(sigLeft + sigWidth, lineY).lineWidth(0.8).strokeColor('#9CA3AF').stroke();
    doc.fillColor(gray).fontSize(7.5).font('Helvetica')
      .text('Employee: I have read and received a copy of this evaluation.', sigLeft, lineY + 4, { width: sigWidth * 0.55 });
    doc.text(`Date: ${data.employeeSignedDate ? formatDateUS(data.employeeSignedDate) : '_______________'}`, sigLeft + sigWidth * 0.65, lineY + 4, { width: sigWidth * 0.35 });
    doc.moveDown(2.2);
    doc.x = sigLeft;
    const lineY2 = doc.y;
    doc.moveTo(sigLeft, lineY2).lineTo(sigLeft + sigWidth * 0.55, lineY2).lineWidth(0.8).strokeColor('#9CA3AF').stroke();
    doc.moveTo(sigLeft + sigWidth * 0.65, lineY2).lineTo(sigLeft + sigWidth, lineY2).lineWidth(0.8).strokeColor('#9CA3AF').stroke();
    doc.fillColor(gray).fontSize(7.5).font('Helvetica')
      .text("Supervisor: This is my evaluation of the employee's performance during the review period.", sigLeft, lineY2 + 4, { width: sigWidth * 0.55 });
    doc.text(`Date: ${data.supervisorSignedDate ? formatDateUS(data.supervisorSignedDate) : '_______________'}`, sigLeft + sigWidth * 0.65, lineY2 + 4, { width: sigWidth * 0.35 });

    doc.end();
  });
}

// ── Benefits Enrollment Form PDF ─────────────────────────────────────────────
// Portrait US Letter, reusing the exact same letterhead + chrome technique as
// the Performance Review PDF above (see TS_HEADER_CROP_TOP_PX / _BOTTOM_PX /
// _NATIVE_W). Not a pixel-perfect replica of the source National General PDF
// — a clean, complete data dump organized by the same section letters
// (A/B/D/E/F/G/H/I; Section C is out of scope, see enrollmentForms schema).

export interface EnrollmentFormPDFData {
  displayId: string;
  employeeName: string;
  employeeDisplayId: string;
  status: string;
  submittedAt?: string;
  sectionA: Record<string, any>;
  sectionB: Record<string, any>;
  sectionD: Record<string, any>;
  sectionE: Record<string, any>;
  sectionF: Record<string, any>;
  sectionG: Array<Record<string, any>>;
  sectionI: Record<string, any>;
}

const EF_PAGE_W = 612;
const EF_HEADER_H = Math.round((TS_HEADER_CROP_BOTTOM_PX - TS_HEADER_CROP_TOP_PX) * (EF_PAGE_W / TS_HEADER_NATIVE_W));
const EF_FOOTER_H = 16;
const EF_MARGIN = 44;

function drawEnrollmentFormChrome(doc: PDFKit.PDFDocument): void {
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const scale = pageW / TS_HEADER_NATIVE_W;

  doc.save();
  doc.rect(0, 0, pageW, EF_HEADER_H).clip();
  doc.image(getTimesheetHeaderBuffer(), 0, -TS_HEADER_CROP_TOP_PX * scale, { width: pageW });
  doc.restore();

  doc.save();
  doc.rect(0, pageH - EF_FOOTER_H, pageW, EF_FOOTER_H).clip();
  doc.image(getTimesheetFooterBuffer(), 0, pageH - EF_FOOTER_H, { cover: [pageW, EF_FOOTER_H], valign: 'bottom' });
  doc.restore();
}

// Small bordered table — header row + N data rows, auto-paginating (redraws
// the header row on each new page, mirroring drawRatingsGrid's approach).
function drawSimpleTable(doc: PDFKit.PDFDocument, headers: string[], rows: string[][]): void {
  const navy = '#04213F';
  const ink = '#111827';
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colW = width / headers.length;
  const rowH = 16;
  const bottomLimit = doc.page.height - doc.page.margins.bottom;

  const drawHeaderRow = () => {
    const y = doc.y;
    doc.rect(left, y, width, rowH).fillColor('#F3F4F6').fill();
    doc.fillColor(navy).fontSize(7).font('Helvetica-Bold');
    headers.forEach((h, i) => doc.text(h, left + i * colW + 4, y + 4, { width: colW - 8, height: 10, ellipsis: true }));
    doc.y = y + rowH;
    doc.x = left;
  };

  if (rows.length === 0) {
    doc.fillColor('#6B7280').fontSize(8.5).font('Helvetica').text('None provided.');
    doc.x = left;
    doc.moveDown(0.4);
    return;
  }

  drawHeaderRow();
  for (const row of rows) {
    if (doc.y + rowH > bottomLimit) {
      doc.addPage();
      doc.x = left;
      doc.y = doc.page.margins.top;
      drawHeaderRow();
    }
    const y = doc.y;
    doc.fillColor(ink).fontSize(7).font('Helvetica');
    row.forEach((cell, i) => doc.text(cell || '—', left + i * colW + 4, y + 4, { width: colW - 8, height: 10, ellipsis: true }));
    doc.moveTo(left, y + rowH).lineTo(left + width, y + rowH).lineWidth(0.5).strokeColor('#E5E7EB').stroke();
    doc.y = y + rowH;
    doc.x = left;
  }
  doc.moveDown(0.4);
}

// Compact 2-column list of only the *checked* condition labels — not the
// full ~40-item checkbox grid the source PDF shows.
function drawChecklistSummary(doc: PDFKit.PDFDocument, items: string[]): void {
  const ink = '#111827';
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  if (!items.length) {
    doc.fillColor('#6B7280').fontSize(8.5).font('Helvetica').text('None reported.');
    doc.x = left;
    doc.moveDown(0.4);
    return;
  }
  const cols = 2;
  const colW = width / cols;
  doc.fillColor(ink).fontSize(8.5).font('Helvetica');
  const y0 = doc.y;
  let maxRowY = y0;
  items.forEach((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = left + col * colW;
    const y = y0 + row * 13;
    doc.text(`•  ${item}`, x, y, { width: colW - 8, height: 12, ellipsis: true });
    maxRowY = Math.max(maxRowY, y + 13);
  });
  doc.x = left;
  doc.y = maxRowY + 8;
}

function drawFootnoteText(doc: PDFKit.PDFDocument, title: string, text: string): void {
  const navy = '#04213F';
  const gray = '#6B7280';
  doc.fillColor(navy).fontSize(8).font('Helvetica-Bold').text(title);
  doc.moveDown(0.2);
  doc.x = doc.page.margins.left;
  doc.fillColor(gray).fontSize(6.8).font('Helvetica').text(text, { align: 'left', lineGap: 2 });
  doc.x = doc.page.margins.left;
  doc.moveDown(0.5);
}

function yn(v: unknown): string {
  if (v === true) return 'Yes';
  if (v === false) return 'No';
  return '—';
}

export function generateEnrollmentFormPDF(data: EnrollmentFormPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const blue = '#4069FF';
    const navy = '#04213F';
    const gray = '#6B7280';
    const ink = '#111827';

    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: EF_HEADER_H + 18, bottom: EF_FOOTER_H + 26, left: EF_MARGIN, right: EF_MARGIN },
      bufferPages: true,
    });
    doc.on('pageAdded', () => drawEnrollmentFormChrome(doc));
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawEnrollmentFormChrome(doc); // first page — 'pageAdded' doesn't fire for it

    const a = data.sectionA ?? {};
    const b = data.sectionB ?? {};
    const d = data.sectionD ?? {};
    const e = data.sectionE ?? {};
    const f = data.sectionF ?? {};
    const g = Array.isArray(data.sectionG) ? data.sectionG : [];
    const i = data.sectionI ?? {};

    // Title block
    doc.fillColor(navy).fontSize(15).font('Helvetica-Bold').text('EMPLOYEE ENROLLMENT FORM', { align: 'center' });
    doc.fillColor(blue).fontSize(10).font('Helvetica-Bold').text('National General Benefits Solutions — Employee Enrollment Form', { align: 'center' });
    doc.moveDown(0.3);
    doc.fillColor(gray).fontSize(8).font('Helvetica')
      .text(`${data.displayId}   ·   Status: ${data.status === 'submitted' ? 'Submitted' : 'Pending'}${data.submittedAt ? '   ·   Submitted ' + formatDateUS(data.submittedAt) : ''}`, { align: 'center' });
    doc.moveDown(0.6);
    doc.x = doc.page.margins.left;

    // Section A — Employee info
    drawReviewSectionHeading(doc, 'A — Employee (Primary Applicant)');
    const homeAddr = a.homeAddress ?? {};
    const mailAddr = a.mailingSameAsHome ? homeAddr : (a.mailingAddress ?? {});
    const fmtAddr = (addr: Record<string, any>) => [addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(', ');
    drawInfoCard(doc, [
      ['LEGAL NAME', `${a.lastName ?? ''}, ${a.firstName ?? ''} ${a.mi ?? ''}`.trim(), 'SOCIAL SECURITY NUMBER', a.ssn ?? ''],
      ['GENDER', a.gender ?? '', 'BIRTH DATE', a.birthDate ? formatDateUS(a.birthDate) : ''],
      ['JOB TITLE', a.jobTitle ?? '', 'MARITAL STATUS', a.maritalStatus ?? ''],
      ['EMPLOYEE STATUS', a.employeeStatus ?? '', 'EARNINGS BASIS', a.earningsBasis ?? ''],
      ['HOME ADDRESS', fmtAddr(homeAddr), 'MAILING ADDRESS', fmtAddr(mailAddr)],
      ['HOME PHONE', a.homePhone ?? '', 'CELL PHONE', a.cellPhone ?? ''],
      ['WORK PHONE', a.workPhone ?? '', 'EMAIL', a.email ?? ''],
      ['ENROLLMENT TYPE', a.enrollmentType ?? '', 'DATE EMPLOYED FULL-TIME', a.dateEmployedFullTime ? formatDateUS(a.dateEmployedFullTime) : ''],
    ]);

    // Section B — Waiver of coverage
    drawReviewSectionHeading(doc, 'B — Waiver of Coverage');
    drawInfoCard(doc, [
      ['WAIVER REASON', b.waiverReason === 'Other' ? (b.waiverReasonOther || 'Other') : (b.waiverReason ?? '—'), 'SIGNATURE', b.signatureName ?? '—'],
      ['SIGNATURE DATE', b.signatureDate ? formatDateUS(b.signatureDate) : '—', '', ''],
    ]);

    // Section D — Persons to be covered
    drawReviewSectionHeading(doc, 'D — Persons to Be Covered');
    doc.fillColor(ink).fontSize(8.5).font('Helvetica-Bold').text(`Coverage tier: ${d.coverageTier || '—'}`);
    doc.moveDown(0.3);
    doc.x = doc.page.margins.left;
    drawSimpleTable(
      doc,
      ['Last Name', 'First Name', 'Relationship', 'Gender', 'DOB', 'Tobacco Use'],
      (d.dependents ?? []).map((dep: any) => [
        dep.lastName ?? '', dep.firstName ?? '', dep.relationship ?? '', dep.gender ?? '',
        dep.dob ? formatDateUS(dep.dob) : '', yn(dep.tobaccoUse),
      ]),
    );

    // Section E — Additional insurance coverage info
    drawReviewSectionHeading(doc, 'E — Additional Insurance Coverage Information');
    drawInfoCard(doc, [
      ['CURRENT PLAN REMAINS ACTIVE?', yn(e.currentPlanActive), 'FOR WHOM', e.currentPlanFor ?? '—'],
      ['CARRIER / ID', [e.currentPlanCarrier, e.currentPlanId].filter(Boolean).join(' / ') || '—', 'MEDICARE A / B / D', [e.medicareA && 'A', e.medicareB && 'B', e.medicareD && 'D'].filter(Boolean).join(', ') || 'None'],
      ['MEDICARE FOR WHOM', e.medicareFor ?? '—', 'MEDICARE REMAINS ACTIVE?', yn(e.medicareRemainsActive)],
    ]);

    // Section F — Medical history
    drawReviewSectionHeading(doc, 'F — Medical History');
    const empH = f.employee ?? {};
    const spH = f.spouse ?? {};
    drawSimpleTable(
      doc,
      ['Person', 'Height', 'Weight', 'Motorcycle', 'Moving Violation', 'DUI/OWI'],
      [
        ['Employee', empH.height ?? '', empH.weight ?? '', yn(empH.motorcycle), yn(empH.movingViolation), yn(empH.dui)],
        ['Spouse', spH.height ?? '', spH.weight ?? '', yn(spH.motorcycle), yn(spH.movingViolation), yn(spH.dui)],
      ],
    );
    doc.fillColor(ink).fontSize(8.5).font('Helvetica-Bold').text('Conditions reported (past 5 years):');
    doc.moveDown(0.2);
    doc.x = doc.page.margins.left;
    drawChecklistSummary(doc, Array.isArray(f.conditions) ? f.conditions : []);
    doc.fillColor(ink).fontSize(8).font('Helvetica').text(
      `Other undiagnosed condition: ${yn(f.otherUndiagnosed)}    ·    Advised of future treatment: ${yn(f.advisedFutureTreatment)}    ·    Medications in last 18 months: ${yn(f.medicationsLast18Months)}`,
      { lineGap: 2 },
    );
    doc.x = doc.page.margins.left;
    if (f.currentlyPregnant) {
      doc.moveDown(0.2);
      doc.x = doc.page.margins.left;
      doc.text(
        `Currently pregnant: Yes    ·    Due date: ${f.dueDate ? formatDateUS(f.dueDate) : '—'}    ·    C-section anticipated: ${yn(f.cSection)}    ·    Multiples expected: ${yn(f.multiples)}    ·    Complications: ${yn(f.pregnancyComplications)}`,
        { lineGap: 2 },
      );
      doc.x = doc.page.margins.left;
    }
    doc.moveDown(0.4);
    doc.x = doc.page.margins.left;

    // Section G — Details
    drawReviewSectionHeading(doc, 'G — Details (for any Section F condition reported)');
    drawSimpleTable(
      doc,
      ['Person', 'Condition/Diagnosis', 'Dates Treated', 'Treatment/Medication', 'Date Last Taken', 'Prognosis'],
      g.map((row: any) => [row.person ?? '', row.condition ?? '', row.datesTreated ?? '', row.treatment ?? '', row.dateLastTaken ?? '', row.prognosis ?? '']),
    );

    // Section H — Federal mandates notice (static)
    if (doc.y > doc.page.height - doc.page.margins.bottom - 100) {
      doc.addPage();
      doc.x = doc.page.margins.left;
      doc.y = doc.page.margins.top;
    }
    drawFootnoteText(doc, SECTION_H_TITLE, SECTION_H_TEXT);

    // Section I — Authorization & signature
    drawFootnoteText(doc, SECTION_I_TITLE, SECTION_I_TEXT);
    doc.moveDown(0.6);
    doc.x = doc.page.margins.left;
    if (doc.y > doc.page.height - doc.page.margins.bottom - 60) {
      doc.addPage();
      doc.x = doc.page.margins.left;
      doc.y = doc.page.margins.top;
    }
    const sigLeft = doc.page.margins.left;
    const sigWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const lineY = doc.y;
    doc.moveTo(sigLeft, lineY).lineTo(sigLeft + sigWidth * 0.55, lineY).lineWidth(0.8).strokeColor('#9CA3AF').stroke();
    doc.moveTo(sigLeft + sigWidth * 0.65, lineY).lineTo(sigLeft + sigWidth, lineY).lineWidth(0.8).strokeColor('#9CA3AF').stroke();
    doc.fillColor(gray).fontSize(7.5).font('Helvetica')
      .text('Employee/Primary Applicant Signature', sigLeft, lineY + 4, { width: sigWidth * 0.55 });
    doc.text(`Date: ${i.signatureDate ? formatDateUS(i.signatureDate) : '_______________'}`, sigLeft + sigWidth * 0.65, lineY + 4, { width: sigWidth * 0.35 });
    if (i.signatureName) {
      doc.fillColor(ink).fontSize(9).font('Helvetica-Bold').text(i.signatureName, sigLeft, lineY - 14, { width: sigWidth * 0.55 });
    }

    doc.end();
  });
}
