import type { Branch, InstallmentApplication } from '../types/khallegacy';
import { formatDateShort, resolveActualCashPayment } from './businessRules';

function sanitizePdfText(value: string): string {
  return value
    .replace(/[\r\n]+/g, ' ')
    .replace(/[—–]/g, '-')
    .replace(/×/g, 'x')
    .replace(/−/g, '-')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function truncateText(text: string, maxChars: number): string {
  const clean = text.trim();
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, Math.max(0, maxChars - 3))}...`;
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function resolveBranchLabel(id: string | null, branches: Branch[]): string {
  if (!id) return 'Belum Ditentukan';
  if (id === 'POSTAGE' || id === 'WEB') return id;
  return branches.find((b) => b.id === id)?.name ?? id;
}

export function buildClaimedHistoryPdfBlob(
  apps: InstallmentApplication[],
  branches: Branch[],
  filterSummary?: {
    branchLabel?: string;
    startDate?: string;
    endDate?: string;
    searchTerm?: string;
  },
): Blob {
  // Landscape A4: width 842, height 595
  const pageWidth = 842;
  const pageHeight = 595;
  const leftMargin = 24;
  const rightMargin = 818;

  // 12 columns matching Claimed History & Data table
  const cols = {
    no: leftMargin,
    nama: 46,
    product: 148,
    finance: 256,
    deposit: 320,
    stamp: 378,
    processing: 432,
    actual: 492,
    branch: 558,
    invoice: 634,
    staff1: 702,
    staff2: 762,
  };

  const pageStreams: string[] = [];
  let ops: string[] = [];
  let y = pageHeight - 36;

  const drawText = (x: number, yPos: number, text: string, size = 7.5, bold = false) => {
    const fontKey = bold ? '/F2' : '/F1';
    ops.push('BT');
    ops.push(`${fontKey} ${size} Tf`);
    ops.push(`1 0 0 1 ${x} ${yPos} Tm`);
    ops.push(`(${sanitizePdfText(text)}) Tj`);
    ops.push('ET');
  };

  const drawRule = (yPos: number, thickness = 0.6) => {
    ops.push(`${thickness} w`);
    ops.push(`${leftMargin} ${yPos} m ${rightMargin} ${yPos} l S`);
  };

  const drawTableHeader = () => {
    drawRule(y + 10, 0.8);
    drawText(cols.no, y, 'No', 7.2, true);
    drawText(cols.nama, y, 'Nama', 7.2, true);
    drawText(cols.product, y, 'Product', 7.2, true);
    drawText(cols.finance, y, 'Finance (RM)', 7.2, true);
    drawText(cols.deposit, y, 'Deposit', 7.2, true);
    drawText(cols.stamp, y, 'Stamp', 7.2, true);
    drawText(cols.processing, y, 'Process', 7.2, true);
    drawText(cols.actual, y, 'Actual Pay', 7.2, true);
    drawText(cols.branch, y, 'Branch Pickup', 7.2, true);
    drawText(cols.invoice, y, 'INVOICE', 7.2, true);
    drawText(cols.staff1, y, 'STAFF 1', 7.2, true);
    drawText(cols.staff2, y, 'STAFF 2', 7.2, true);
    y -= 6;
    drawRule(y, 0.8);
    y -= 13;
  };

  const startNewPage = () => {
    if (ops.length > 0) {
      pageStreams.push(ops.join('\n'));
    }
    ops = [];
    y = pageHeight - 36;
    drawText(leftMargin, y, 'KHALLEGACY INSTALLMENT SYSTEM - CLAIMED HISTORY & DATA', 9.5, true);
    y -= 16;
    drawTableHeader();
  };

  const totalActual = apps.reduce((sum, a) => sum + resolveActualCashPayment(a.financing), 0);
  const dateRangeText =
    filterSummary?.startDate || filterSummary?.endDate
      ? `${filterSummary.startDate ? formatDateShort(filterSummary.startDate) : 'Start'} - ${
          filterSummary.endDate ? formatDateShort(filterSummary.endDate) : 'Latest'
        }`
      : 'All Dates';

  // Header
  drawText(leftMargin, y, 'KHALLEGACY INSTALLMENT SYSTEM', 12.5, true);
  drawText(rightMargin - 165, y, `Total Records: ${apps.length}`, 10, true);
  y -= 15;
  drawText(leftMargin, y, 'CLAIMED HISTORY & DATA REPORT', 9.5, true);
  drawText(rightMargin - 165, y, `Actual Payment: RM ${formatAmount(totalActual)}`, 9, true);
  y -= 14;
  drawText(
    leftMargin,
    y,
    `Branch Pickup: ${filterSummary?.branchLabel || 'All Branches'}   |   Date Range: ${dateRangeText}${
      filterSummary?.searchTerm ? `   |   Search: ${truncateText(filterSummary.searchTerm, 30)}` : ''
    }`,
    8,
  );
  y -= 16;

  drawTableHeader();

  let sumFinance = 0;
  let sumDeposit = 0;
  let sumStamp = 0;
  let sumProcessing = 0;
  let sumActual = 0;

  apps.forEach((app, idx) => {
    if (y < 48) {
      startNewPage();
    }

    const primaryProduct = app.products[0]?.productName ?? '-';
    const extraCount = Math.max(0, app.products.length - 1);
    const productLabel = extraCount > 0 ? `${primaryProduct} (+${extraCount})` : primaryProduct;
    const actualPayment = resolveActualCashPayment(app.financing);
    const branchLabel = resolveBranchLabel(app.pickupBranchId, branches);

    sumFinance += app.financing.financingAmount;
    sumDeposit += app.financing.deposit;
    sumStamp += app.financing.stampDutyFee;
    sumProcessing += app.financing.processingFee;
    sumActual += actualPayment;

    drawText(cols.no, y, String(idx + 1), 7.2);
    drawText(cols.nama, y, truncateText(app.customerName, 19), 7.2);
    drawText(cols.product, y, truncateText(productLabel, 20), 7.2);
    drawText(cols.finance, y, formatAmount(app.financing.financingAmount), 7.2);
    drawText(cols.deposit, y, formatAmount(app.financing.deposit), 7.2);
    drawText(cols.stamp, y, formatAmount(app.financing.stampDutyFee), 7.2);
    drawText(cols.processing, y, formatAmount(app.financing.processingFee), 7.2);
    drawText(cols.actual, y, formatAmount(actualPayment), 7.2, true);
    drawText(cols.branch, y, truncateText(branchLabel, 14), 7.2);
    drawText(cols.invoice, y, truncateText(app.agreement.invoiceNumber || '-', 12), 7.2);
    drawText(cols.staff1, y, truncateText(app.agreement.checkingStaff1 || '-', 11), 7.2);
    drawText(cols.staff2, y, truncateText(app.agreement.checkingStaff2 || '-', 11), 7.2);

    y -= 5.5;
    drawRule(y, 0.25);
    y -= 12.5;
  });

  if (y < 46) {
    startNewPage();
  }

  drawRule(y + 8, 0.8);
  drawText(cols.product, y - 2, 'TOTAL', 8, true);
  drawText(cols.finance, y - 2, formatAmount(sumFinance), 8, true);
  drawText(cols.deposit, y - 2, formatAmount(sumDeposit), 8, true);
  drawText(cols.stamp, y - 2, formatAmount(sumStamp), 8, true);
  drawText(cols.processing, y - 2, formatAmount(sumProcessing), 8, true);
  drawText(cols.actual, y - 2, formatAmount(sumActual), 8, true);

  pageStreams.push(ops.join('\n'));

  const pageObjNumbers: number[] = [];
  const dynamicObjects: string[] = [];
  let nextObjNum = 5;

  for (const stream of pageStreams) {
    const pageObjNum = nextObjNum;
    const contentObjNum = nextObjNum + 1;
    nextObjNum += 2;
    pageObjNumbers.push(pageObjNum);

    dynamicObjects.push(
      `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjNum} 0 R >>\nendobj\n`,
    );
    dynamicObjects.push(
      `${contentObjNum} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
    );
  }

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjNumbers.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageObjNumbers.length} >>\nendobj\n`,
    '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
    ...dynamicObjects,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}
