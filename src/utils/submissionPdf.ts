import type { InstallmentApplication, SaleSubmissionList } from '../types/khallegacy';
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

export function buildSaleSubmissionPdfBlob(
  submission: SaleSubmissionList,
  apps: InstallmentApplication[],
): Blob {
  // Landscape A4: width 842, height 595
  const pageWidth = 842;
  const pageHeight = 595;
  const leftMargin = 32;
  const rightMargin = 810;

  // Column x-positions (9 columns matching Submission List modal)
  const cols = {
    no: leftMargin,
    ic: 58,
    customer: 152,
    product: 282,
    finance: 432,
    deposit: 508,
    stamp: 584,
    processing: 662,
    actualCash: 740,
  };

  const pageStreams: string[] = [];
  let ops: string[] = [];
  let y = pageHeight - 40;

  const drawText = (x: number, yPos: number, text: string, size = 8.5, bold = false) => {
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
    drawText(cols.no, y, 'No', 8, true);
    drawText(cols.ic, y, 'IC Number', 8, true);
    drawText(cols.customer, y, 'Customer Name', 8, true);
    drawText(cols.product, y, 'Product', 8, true);
    drawText(cols.finance, y, 'Finance (RM)', 8, true);
    drawText(cols.deposit, y, 'Deposit (RM)', 8, true);
    drawText(cols.stamp, y, 'Stamp (RM)', 8, true);
    drawText(cols.processing, y, 'Process (RM)', 8, true);
    drawText(cols.actualCash, y, 'Actual Cash (RM)', 8, true);
    y -= 6;
    drawRule(y, 0.8);
    y -= 14;
  };

  const startNewPage = () => {
    if (ops.length > 0) {
      pageStreams.push(ops.join('\n'));
    }
    ops = [];
    y = pageHeight - 40;
    drawText(leftMargin, y, `KHALLEGACY INSTALLMENT SYSTEM - SALE SUBMISSION LIST (${submission.submissionListId})`, 10, true);
    y -= 18;
    drawTableHeader();
  };

  // First page header
  drawText(leftMargin, y, 'KHALLEGACY INSTALLMENT SYSTEM', 13, true);
  drawText(rightMargin - 175, y, `ID: ${submission.submissionListId}`, 11, true);
  y -= 16;
  drawText(leftMargin, y, `SALE SUBMISSION LIST - ${submission.submissionListId}`, 10, true);
  y -= 18;

  drawText(leftMargin, y, `Submission Date: ${formatDateShort(submission.submissionDate)}`, 9);
  drawText(260, y, `Created By: ${submission.createdBy}`, 9);
  drawText(480, y, `Agreements Selected: ${submission.agreementCount}`, 9, true);
  drawText(645, y, `Actual Cash: RM ${formatAmount(submission.totalActualCashPayment)}`, 9, true);
  y -= 14;

  drawText(leftMargin, y, `Total Product Amount: RM ${formatAmount(submission.totalProductAmount)}`, 9);
  if (submission.remarks) {
    drawText(260, y, `Remarks: ${truncateText(submission.remarks, 95)}`, 9);
  }
  y -= 18;

  drawTableHeader();

  let sumFinance = 0;
  let sumDeposit = 0;
  let sumStamp = 0;
  let sumProcessing = 0;
  let sumActualCash = 0;

  apps.forEach((app, idx) => {
    if (y < 52) {
      startNewPage();
    }

    const primaryProduct = app.products[0]?.productName ?? '-';
    const extraCount = Math.max(0, app.products.length - 1);
    const productLabel = extraCount > 0 ? `${primaryProduct} (+${extraCount})` : primaryProduct;
    const actualCash = resolveActualCashPayment(app.financing);

    sumFinance += app.financing.financingAmount;
    sumDeposit += app.financing.deposit;
    sumStamp += app.financing.stampDutyFee;
    sumProcessing += app.financing.processingFee;
    sumActualCash += actualCash;

    drawText(cols.no, y, String(idx + 1), 8);
    drawText(cols.ic, y, truncateText(app.icNumber, 16), 8);
    drawText(cols.customer, y, truncateText(app.customerName, 24), 8);
    drawText(cols.product, y, truncateText(productLabel, 28), 8);
    drawText(cols.finance, y, formatAmount(app.financing.financingAmount), 8);
    drawText(cols.deposit, y, formatAmount(app.financing.deposit), 8);
    drawText(cols.stamp, y, formatAmount(app.financing.stampDutyFee), 8);
    drawText(cols.processing, y, formatAmount(app.financing.processingFee), 8);
    drawText(cols.actualCash, y, formatAmount(actualCash), 8, true);

    y -= 6;
    drawRule(y, 0.25);
    y -= 13;
  });

  if (y < 48) {
    startNewPage();
  }

  drawRule(y + 8, 0.8);
  drawText(cols.product, y - 2, 'TOTAL', 8.5, true);
  drawText(cols.finance, y - 2, formatAmount(sumFinance), 8.5, true);
  drawText(cols.deposit, y - 2, formatAmount(sumDeposit), 8.5, true);
  drawText(cols.stamp, y - 2, formatAmount(sumStamp), 8.5, true);
  drawText(cols.processing, y - 2, formatAmount(sumProcessing), 8.5, true);
  drawText(cols.actualCash, y - 2, formatAmount(sumActualCash), 8.5, true);

  pageStreams.push(ops.join('\n'));

  // Assemble multi-page PDF objects
  // 1: Catalog, 2: Pages, 3: Helvetica, 4: Helvetica-Bold, then pairs of (Page, ContentStream)
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
