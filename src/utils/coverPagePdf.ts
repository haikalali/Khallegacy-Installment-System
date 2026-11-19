import type { Branch, InstallmentApplication, StaffUser } from '../types/khallegacy';
import { formatDateShort, formatRM, resolveApplicationCategory } from './businessRules';

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

function wrapText(text: string, maxChars: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return ['-'];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function buildCoverPagePdfBlob(
  app: InstallmentApplication,
  branches: Branch[],
  users: StaffUser[],
): Blob {
  const branchLabel = (id: string | null) => {
    if (!id) return 'Belum Ditentukan';
    if (id === 'WEB' || id === 'POSTAGE') return id;
    return branches.find((b) => b.id === id)?.name ?? id;
  };

  const enteredBy =
    users.find((u) => u.id === app.staffInChargeId)?.name ??
    app.timeline[app.timeline.length - 1]?.staffName ??
    '-';

  const actualCash =
    app.financing.actualCashPayment ??
    Math.max(
      0,
      app.financing.financingAmount -
        app.financing.processingFee -
        app.financing.sstAmount -
        app.financing.stampDutyFee,
    );

  const lines: { text: string; bold?: boolean; size?: number; gapAfter?: number }[] = [
    { text: 'KHALLEGACY INSTALLMENT SYSTEM', bold: true, size: 15, gapAfter: 4 },
    { text: 'APPLICATION COVER PAGE', bold: true, size: 11, gapAfter: 12 },
    { text: `CASE ID           : ${app.caseId}`, bold: true, size: 10 },
    { text: `Category          : ${resolveApplicationCategory(app)}`, size: 10 },
    { text: `Application Date  : ${formatDateShort(app.applicationDate)}`, size: 10 },
    { text: `Approval Status   : ${app.approvalStatus}`, size: 10 },
    { text: `Approval Date     : ${formatDateShort(app.approvalDate)}`, size: 10 },
    { text: `Entered By        : ${enteredBy}`, size: 10, gapAfter: 10 },

    { text: '01. CUSTOMER INFORMATION', bold: true, size: 11, gapAfter: 4 },
    { text: `Customer Name     : ${app.customerName}`, size: 10 },
    { text: `IC Number         : ${app.icNumber}`, size: 10 },
    { text: `Phone Number      : ${app.phone}`, size: 10 },
    { text: `REF1 ID           : ${app.ref1Id}`, size: 10 },
    { text: `Original Branch   : ${branchLabel(app.customerFromBranchId)}`, size: 10 },
    { text: `Pickup Branch     : ${branchLabel(app.pickupBranchId)}`, size: 10 },
    { text: `Bank Name         : ${app.bankName || '-'}`, size: 10 },
    { text: `Bank Account No.  : ${app.bankAccountNumber || '-'}`, size: 10 },
    ...wrapText(`Remarks           : ${app.applicationRemarks || '-'}`, 78).map((l, idx) => ({
      text: idx === 0 ? l : `                    ${l}`,
      size: 10,
    })),
    { text: '', size: 8, gapAfter: 4 },

    { text: '02. PRODUCT INFORMATION', bold: true, size: 11, gapAfter: 4 },
    ...app.products.map((p, idx) => ({
      text: `${idx + 1}. ${p.productName} (${p.model}) | Qty: ${p.quantity} x ${formatRM(
        p.productPrice,
      )} = ${formatRM(p.quantity * p.productPrice)}`,
      size: 10,
    })),
    { text: '', size: 8, gapAfter: 4 },

    { text: '03. FINANCING INFORMATION', bold: true, size: 11, gapAfter: 4 },
    { text: `Total Product Price  : ${formatRM(app.financing.totalProductPrice)}`, size: 10 },
    { text: `Deposit              : ${formatRM(app.financing.deposit)}`, size: 10 },
    { text: `Financing Amount     : ${formatRM(app.financing.financingAmount)}`, size: 10 },
    { text: `Agreement Fee        : ${formatRM(app.financing.agreementFee)}`, size: 10 },
    { text: `Processing Fee       : ${formatRM(app.financing.processingFee)}`, size: 10 },
    { text: `SST Amount           : ${formatRM(app.financing.sstAmount)}`, size: 10 },
    { text: `Stamp Duty Fee       : ${formatRM(app.financing.stampDutyFee)}`, size: 10 },
    { text: `Actual Cash Payment  : ${formatRM(actualCash)}`, size: 10 },
    { text: `Installment Duration : ${app.financing.installmentDuration} Months`, size: 10 },
    {
      text: `Monthly Installment  : ${formatRM(app.financing.monthlyInstallment)} / month`,
      bold: true,
      size: 10,
      gapAfter: 10,
    },

    { text: '04. INTERNAL NOTES', bold: true, size: 11, gapAfter: 4 },
    ...wrapText(app.internalNotes || '-', 78).map((l) => ({ text: l, size: 10 })),
  ];

  const streamOps: string[] = ['BT'];
  let y = 790;
  for (const item of lines) {
    if (y < 52) break;
    const fontKey = item.bold ? '/F2' : '/F1';
    const fontSize = item.size ?? 10;
    if (item.text) {
      streamOps.push(`${fontKey} ${fontSize} Tf`);
      streamOps.push(`1 0 0 1 48 ${y} Tm`);
      streamOps.push(`(${sanitizePdfText(item.text)}) Tj`);
    }
    y -= fontSize + 4 + (item.gapAfter ?? 0);
  }
  streamOps.push('ET');
  const contentStream = streamOps.join('\n');

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
    `6 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
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
