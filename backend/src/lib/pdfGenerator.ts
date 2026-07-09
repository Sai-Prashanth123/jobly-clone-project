import PDFDocument from 'pdfkit';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, WidthType, AlignmentType, BorderStyle, PageOrientation,
  ShadingType, VerticalAlign, Header, Footer,
} from 'docx';
import { formatDateSafe } from './dateUtils';
import { getJoblyLogoBuffer } from './joblyLogo';
import { getTimesheetHeaderBuffer, getTimesheetFooterBuffer } from './timesheetBranding';

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

// The header carries real information (phone/email/address) that must stay
// legible, so it's shown in full — scaled down as a whole (width capped, no
// crop) rather than cropped to a short full-bleed band. The footer is purely
// decorative (a wave graphic, no text), so it's fine to crop it down to a
// thin full-width strip.
const TS_HEADER_ASPECT = 2547 / 450;
const TS_HEADER_W = 460;                              // scaled-down, uncropped width
const TS_HEADER_H = TS_HEADER_W / TS_HEADER_ASPECT;    // ≈ 81pt
const TS_HEADER_Y = 10;
const TS_HEADER_RESERVED = TS_HEADER_Y + TS_HEADER_H;  // space to clear before body content
const TS_FOOTER_H = 22; // thin wave-graphic strip, bottom-cropped from the 2539x449 source
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

  // Header: whole image, centered, scaled down — never cropped.
  doc.image(getTimesheetHeaderBuffer(), (pageW - TS_HEADER_W) / 2, TS_HEADER_Y, { width: TS_HEADER_W });

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

// Stamps "Generated on … · Page X of Y" just above the footer band on every
// buffered page — requires the PDFDocument to have been created with
// `bufferPages: true` so the total page count is known.
function stampTimesheetPageNumbers(doc: PDFKit.PDFDocument): void {
  const generatedOn = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const pageW = doc.page.width;
    const y = doc.page.height - TS_FOOTER_H - 14;
    doc.fillColor('#9CA3AF').fontSize(7).font('Helvetica')
      .text(`Generated on ${generatedOn}  ·  Page ${i - range.start + 1} of ${range.count}`, 40, y, { width: pageW - 80, align: 'center' });
  }
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
      doc.fillColor(navy).fontSize(10.5).font('Helvetica-Bold').text(c.value, x, y + 21, { width: infoColW - 20, ellipsis: true });
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
        r.date, r.day, r.project || '—', r.task || '—',
        r.start || '—', r.end || '—', r.hours > 0 ? r.hours.toFixed(1) : '—',
      ];
      cols.slice(0, 7).forEach((c, i) => {
        doc.fillColor(ink).font('Helvetica').text(String(vals[i]), colX[i] + 6, y + 5, { width: c.w - 12, align: c.align, ellipsis: true });
      });
      const statusLabel = r.status.charAt(0).toUpperCase() + r.status.slice(1);
      doc.fillColor(TS_STATUS_COLORS[r.status] ?? ink).font('Helvetica-Bold')
        .text(statusLabel, colX[7] + 6, y + 5, { width: cols[7].w - 12, align: cols[7].align, ellipsis: true });
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
    stampTimesheetPageNumbers(doc);
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
    stampTimesheetPageNumbers(doc);
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
      r.date, r.day, r.project || '—', r.task || '—',
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

  const generatedPara = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 240 },
    children: [new TextRun({
      text: `Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      color: '9CA3AF', size: 14,
    })],
  });

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
        attendanceTable, spacer(), summaryTable, ...notesParas, generatedPara,
      ],
    }],
  });

  return Packer.toBuffer(doc);
}
