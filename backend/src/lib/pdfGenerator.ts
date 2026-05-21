import PDFDocument from 'pdfkit';
import { formatDateSafe } from './dateUtils';

export interface InvoicePDFData {
  invoiceNumber: string;
  clientName: string;
  clientAddress?: string;
  issueDate: string;
  dueDate: string;
  lineItems: Array<{
    description: string;
    hours: number;
    billRate: number;
    amount: number;
  }>;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string;
  paymentTerms?: string;
}

export function generateInvoicePDF(data: InvoicePDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Brand colors
    const blue = '#4069FF';
    const navy = '#04213F';
    const gray = '#6B7280';

    // Header bar
    doc.rect(0, 0, doc.page.width, 80).fill(navy);

    // Company name in header
    doc.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold')
      .text('JOBLY SOLUTIONS', 50, 25);
    doc.fontSize(10).font('Helvetica').fillColor('rgba(255,255,255,0.7)')
      .text('Workforce Management', 50, 54);

    // Invoice label on right
    doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold')
      .text('INVOICE', doc.page.width - 150, 28, { width: 100, align: 'right' });

    doc.moveDown(3);

    // Invoice details grid
    const leftX = 50;
    const rightX = doc.page.width - 200;

    doc.fillColor(navy).fontSize(11).font('Helvetica-Bold')
      .text('Bill To:', leftX, 110);
    doc.fillColor('#111827').fontSize(11).font('Helvetica-Bold')
      .text(data.clientName, leftX, 126);
    if (data.clientAddress) {
      doc.fillColor(gray).fontSize(10).font('Helvetica')
        .text(data.clientAddress, leftX, 142, { width: 200 });
    }

    // Invoice metadata
    doc.fillColor(gray).fontSize(10).font('Helvetica')
      .text('Invoice Number:', rightX, 110)
      .text('Issue Date:', rightX, 128)
      .text('Due Date:', rightX, 146);

    doc.fillColor(navy).fontSize(10).font('Helvetica-Bold')
      .text(data.invoiceNumber, rightX + 100, 110)
      .text(formatDate(data.issueDate), rightX + 100, 128)
      .text(formatDate(data.dueDate), rightX + 100, 146);

    // Line items table
    const tableTop = 210;
    const tableLeft = 50;
    const colWidths = [240, 60, 80, 80];
    const headers = ['Description', 'Hours', 'Rate', 'Amount'];
    const colPositions = [tableLeft];
    for (let i = 1; i < colWidths.length; i++) {
      colPositions.push(colPositions[i - 1] + colWidths[i - 1]);
    }

    // Table header
    doc.rect(tableLeft, tableTop, doc.page.width - 100, 28).fill(blue);
    doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold');
    headers.forEach((h, i) => {
      const align = i === 0 ? 'left' : 'right';
      doc.text(h, colPositions[i] + 8, tableTop + 9, { width: colWidths[i] - 16, align });
    });

    // Table rows
    let y = tableTop + 28;
    data.lineItems.forEach((item, idx) => {
      const rowBg = idx % 2 === 0 ? '#F9FAFB' : '#FFFFFF';
      doc.rect(tableLeft, y, doc.page.width - 100, 28).fill(rowBg);
      doc.fillColor('#111827').fontSize(9).font('Helvetica');
      doc.text(item.description, colPositions[0] + 8, y + 9, { width: colWidths[0] - 16, align: 'left' });
      doc.text(item.hours.toFixed(2), colPositions[1] + 8, y + 9, { width: colWidths[1] - 16, align: 'right' });
      doc.text(`$${item.billRate.toFixed(2)}/hr`, colPositions[2] + 8, y + 9, { width: colWidths[2] - 16, align: 'right' });
      doc.text(`$${item.amount.toFixed(2)}`, colPositions[3] + 8, y + 9, { width: colWidths[3] - 16, align: 'right' });
      y += 28;
    });

    // Totals section
    y += 16;
    const totalsLeft = doc.page.width - 250;
    const totalsRight = doc.page.width - 50;

    const addTotalRow = (label: string, value: string, bold = false, highlight = false) => {
      if (highlight) {
        doc.rect(totalsLeft - 10, y - 4, 210, 26).fill(navy);
        doc.fillColor('#ffffff').fontSize(12).font('Helvetica-Bold');
      } else {
        doc.fillColor(bold ? navy : gray).fontSize(10).font(bold ? 'Helvetica-Bold' : 'Helvetica');
      }
      doc.text(label, totalsLeft, y, { width: 110, align: 'left' });
      doc.text(value, totalsLeft + 110, y, { width: 90, align: 'right' });
      y += 26;
    };

    addTotalRow('Subtotal:', `$${data.subtotal.toFixed(2)}`);
    if (data.taxRate > 0) {
      addTotalRow(`Tax (${(data.taxRate * 100).toFixed(1)}%):`, `$${data.taxAmount.toFixed(2)}`);
    }
    addTotalRow('TOTAL DUE:', `$${data.totalAmount.toFixed(2)}`, true, true);

    // Notes
    if (data.notes) {
      y += 20;
      doc.fillColor(navy).fontSize(10).font('Helvetica-Bold').text('Notes:', 50, y);
      y += 16;
      doc.fillColor(gray).fontSize(9).font('Helvetica').text(data.notes, 50, y, { width: 400 });
    }

    // Footer
    const footerY = doc.page.height - 60;
    doc.rect(0, footerY, doc.page.width, 60).fill('#F3F4F6');
    doc.fillColor(gray).fontSize(8).font('Helvetica')
      .text('Jobly Solutions | workforce@joblysolutions.com | www.joblysolutions.com', 50, footerY + 22, {
        width: doc.page.width - 100, align: 'center'
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
