import PDFDocument from 'pdfkit';
import { formatDateSafe } from './dateUtils';
import { getJoblyLogoBuffer } from './joblyLogo';

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

export function generateInvoicePDF(data: InvoicePDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Palette + geometry
    const blue = '#2563EB';
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

    // ── Header: logo (left) + document block (right) ──────────────────────────
    try {
      doc.image(getJoblyLogoBuffer(), M, 44, { width: 120 });   // width-only keeps aspect
    } catch {
      doc.fillColor(navy).fontSize(20).font('Helvetica-Bold').text('Jobly Solutions', M, 48);
    }
    doc.fillColor(navy).fontSize(26).font('Helvetica-Bold')
      .text(docLabel, RIGHT - 240, 44, { width: 240, align: 'right' });
    doc.fillColor(blue).fontSize(12).font('Helvetica-Bold')
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
      doc.rect(M, top, CONTENT_W, 26).fill(navy);
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
        doc.rect(totLabelX - 4, y - 5, RIGHT - totLabelX + 4, 26).fill(navy);
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
      .text('Jobly Solutions  ·  billing@joblysolutions.com  ·  www.joblysolutions.com', M, footerY + 18, {
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
  department?: string;
  monthLabel: string;
  rows: Array<{ date: string; day: string; project: string; task: string; start: string; end: string; hours: number; status: string }>;
  totalHours: number;
  expectedHours: number;
  balance: number;
  workingDays: number;
  leaveDays: number;
  notes?: string;
}

export function generateMonthlyTimesheetPDF(data: MonthlyTimesheetPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // A4 landscape so the wide attendance table fits.
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const blue = '#4069FF';
    const navy = '#04213F';
    const gray = '#6B7280';
    const pageRight = doc.page.width - 40;
    const contentW = doc.page.width - 80;

    // Header bar
    doc.rect(0, 0, doc.page.width, 72).fill(navy);
    doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold').text('JOBLY SOLUTIONS', 40, 22);
    doc.fontSize(9).font('Helvetica').fillColor('rgba(255,255,255,0.7)').text('Monthly Timesheet', 40, 48);
    doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold')
      .text(data.monthLabel, pageRight - 220, 26, { width: 220, align: 'right' });

    // Employee meta
    doc.fillColor(navy).fontSize(11).font('Helvetica-Bold').text(data.employeeName, 40, 90);
    doc.fillColor(gray).fontSize(10).font('Helvetica')
      .text(`${data.employeeDisplayId}${data.department ? '  ·  ' + data.department : ''}  ·  Sheet ${data.displayId}`, 40, 106);

    // Table
    const tableTop = 132;
    const cols = [
      { h: 'Date', w: 80, align: 'left' as const },
      { h: 'Day', w: 45, align: 'left' as const },
      { h: 'Project', w: 130, align: 'left' as const },
      { h: 'Task', w: 230, align: 'left' as const },
      { h: 'Start', w: 55, align: 'center' as const },
      { h: 'End', w: 55, align: 'center' as const },
      { h: 'Hours', w: 55, align: 'center' as const },
      { h: 'Status', w: 65, align: 'center' as const },
    ];
    const tableLeft = 40;
    const colX: number[] = [tableLeft];
    for (let i = 1; i < cols.length; i++) colX.push(colX[i - 1] + cols[i - 1].w);

    const drawHeader = (y: number) => {
      doc.rect(tableLeft, y, contentW, 22).fill(blue);
      doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
      cols.forEach((c, i) => doc.text(c.h, colX[i] + 6, y + 7, { width: c.w - 12, align: c.align }));
    };
    drawHeader(tableTop);

    let y = tableTop + 22;
    doc.fontSize(8.5);
    data.rows.forEach((r, idx) => {
      if (y > doc.page.height - 110) {            // new page
        doc.addPage();
        y = 40;
        drawHeader(y);
        y += 22;
      }
      const bg = idx % 2 === 0 ? '#F9FAFB' : '#FFFFFF';
      doc.rect(tableLeft, y, contentW, 20).fill(bg);
      doc.fillColor('#111827').font('Helvetica');
      const vals = [
        r.date, r.day, r.project || '—', r.task || '—',
        r.start || '—', r.end || '—', r.hours > 0 ? r.hours.toFixed(1) : '—',
        r.status.charAt(0).toUpperCase() + r.status.slice(1),
      ];
      cols.forEach((c, i) => doc.text(String(vals[i]), colX[i] + 6, y + 6, { width: c.w - 12, align: c.align, ellipsis: true }));
      y += 20;
    });

    // Summary block
    y += 16;
    if (y > doc.page.height - 90) { doc.addPage(); y = 50; }
    doc.fillColor(navy).fontSize(11).font('Helvetica-Bold').text('Summary', 40, y);
    y += 18;
    const sum: Array<[string, string]> = [
      ['Total Hours Logged', `${data.totalHours.toFixed(1)} hrs`],
      ['Expected Hours', `${data.expectedHours.toFixed(1)} hrs`],
      ['Balance', `${data.balance >= 0 ? '+' : ''}${data.balance.toFixed(1)} hrs`],
      ['Working Days', String(data.workingDays)],
      ['Leave Days', String(data.leaveDays)],
    ];
    doc.fontSize(10).font('Helvetica');
    sum.forEach(([label, value]) => {
      doc.fillColor(gray).text(label, 40, y, { width: 160, align: 'left', continued: false });
      doc.fillColor('#111827').font('Helvetica-Bold').text(value, 200, y, { width: 120, align: 'left' });
      doc.font('Helvetica');
      y += 16;
    });

    if (data.notes) {
      y += 10;
      doc.fillColor(navy).fontSize(10).font('Helvetica-Bold').text('Notes:', 40, y);
      y += 14;
      doc.fillColor(gray).fontSize(9).font('Helvetica').text(data.notes, 40, y, { width: contentW });
    }

    doc.end();
  });
}
