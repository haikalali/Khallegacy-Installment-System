import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from 'pdf-lib';
import type { Branch, InstallmentApplication, StaffUser } from '../types/khallegacy';
import { formatDateShort, formatRM, resolveApplicationCategory } from './businessRules';

const COVER_PAGE_TEMPLATE_URL =
  '/assets/aistudio/COVER_PAGE_JCL_2026_-_COVER_PAGE_88_21474ba8.pdf';

const STREAM_SCALE = 0.75 * 0.66157967;
const STREAM_TX = 101.57507;
const STREAM_TY_PAGE_1 = 108.83044;
const STREAM_TY_PAGE_2 = 108.83044 - 1465.0;

const TITLE_FONT_SIZE = 26.0 * STREAM_SCALE;
const BODY_FONT_SIZE = 18.199999 * STREAM_SCALE;

let cachedTemplateBytesPromise: Promise<ArrayBuffer> | null = null;

async function loadCoverPageTemplateBytes(): Promise<ArrayBuffer> {
  if (!cachedTemplateBytesPromise) {
    cachedTemplateBytesPromise = fetch(COVER_PAGE_TEMPLATE_URL).then((res) => {
      if (!res.ok) {
        cachedTemplateBytesPromise = null;
        throw new Error(`Unable to load cover page template (${res.status})`);
      }
      return res.arrayBuffer();
    });
  }
  return cachedTemplateBytesPromise;
}

function toPage1Point(xs: number, ys: number): { x: number; y: number } {
  return {
    x: (xs + STREAM_TX) * STREAM_SCALE,
    y: 842 - (ys + STREAM_TY_PAGE_1) * STREAM_SCALE,
  };
}

function toPage2Point(xs: number, ys: number): { x: number; y: number } {
  return {
    x: (xs + STREAM_TX) * STREAM_SCALE,
    y: 842 - (ys + STREAM_TY_PAGE_2) * STREAM_SCALE,
  };
}

function sanitizePdfText(value: string): string {
  return value
    .replace(/[\r\n]+/g, ' ')
    .replace(/[—–]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/×/g, 'x')
    .replace(/−/g, '-')
    .replace(/[^\x20-\xFF]/g, ' ')
    .trim();
}

function sanitizeBasicAscii(value: string): string {
  return sanitizePdfText(value)
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function formatCoverAmount(amount: number): string {
  const rounded = Math.round((Number(amount) || 0) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function formatProductList(app: InstallmentApplication): string {
  const parts = app.products
    .map((p) => {
      const name = p.productName.trim();
      const model =
        p.model && p.model.trim() && p.model.trim() !== 'Standard Spec' ? p.model.trim() : '';
      const base =
        model && !name.toLowerCase().includes(model.toLowerCase()) ? `${name} ${model}` : name;
      return p.quantity > 1 ? `${base} (x${p.quantity})` : base;
    })
    .filter(Boolean);
  return parts.join(' & ') || '-';
}

function drawMaskedField(opts: {
  page: PDFPage;
  font: PDFFont;
  text: string;
  x: number;
  y: number;
  maskX: number;
  maskWidth: number;
  fontSize: number;
  maxWidth: number;
  color?: ReturnType<typeof rgb>;
}) {
  const {
    page,
    font,
    text,
    x,
    y,
    maskX,
    maskWidth,
    fontSize,
    maxWidth,
    color = rgb(0, 0, 0),
  } = opts;

  const maskHeight = fontSize * 1.24;
  const maskY = y - fontSize * 0.28;

  page.drawRectangle({
    x: maskX,
    y: maskY,
    width: maskWidth,
    height: maskHeight,
    color: rgb(1, 1, 1),
  });

  const safeText = sanitizePdfText(text) || '-';
  let fittedSize = fontSize;
  while (fittedSize > 6.2 && font.widthOfTextAtSize(safeText, fittedSize) > maxWidth) {
    fittedSize -= 0.25;
  }

  page.drawText(safeText, {
    x,
    y,
    size: fittedSize,
    font,
    color,
  });
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

export function buildFallbackCoverPagePdfBlob(
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

  const lines: { text: string; bold?: boolean; size?: number; gapAfter?: number }[] = [
    { text: 'KHALLEGACY INSTALLMENT SYSTEM', bold: true, size: 15, gapAfter: 4 },
    { text: 'APPLICATION COVER PAGE', bold: true, size: 11, gapAfter: 12 },
    { text: `REF1 CASE ID      : ${app.ref1Id && app.ref1Id !== '—' ? app.ref1Id : '-'}`, bold: true, size: 10 },
    { text: `CASE ID           : ${app.caseId}`, bold: true, size: 10 },
    { text: `Category          : ${resolveApplicationCategory(app)}`, size: 10 },
    { text: `Application Date  : ${formatDateShort(app.applicationDate)}`, size: 10 },
    { text: `Entered By        : ${enteredBy}`, size: 10, gapAfter: 10 },

    { text: `NAMA              : ${app.customerName}`, size: 10 },
    { text: `NO. K/P           : ${app.icNumber}`, size: 10 },
    { text: `NO TELEFON        : ${app.phone}`, size: 10 },
    { text: `Original Branch   : ${branchLabel(app.customerFromBranchId)}`, size: 10 },
    { text: `Pickup Branch     : ${branchLabel(app.pickupBranchId)}`, size: 10, gapAfter: 8 },

    { text: `PHONE             : ${formatProductList(app)}`, size: 10 },
    { text: `DEPOSIT           : RM ${formatCoverAmount(app.financing.deposit)}`, size: 10 },
    { text: `TEMPOH            : ${app.financing.installmentDuration} bulan`, size: 10 },
    { text: `BULANAN           : RM ${formatCoverAmount(app.financing.monthlyInstallment)}`, size: 10 },
    { text: `JUMLAH            : RM ${formatCoverAmount(app.financing.totalProductPrice)}`, size: 10 },
    { text: `AGREEMENT FEE     : RM ${formatCoverAmount(app.financing.agreementFee)}`, size: 10, gapAfter: 10 },
    ...wrapText(`Remarks           : ${app.applicationRemarks || '-'}`, 78).map((l) => ({
      text: l,
      size: 10,
    })),
    { text: `Monthly Summary   : ${formatRM(app.financing.monthlyInstallment)}`, size: 10 },
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
      streamOps.push(`(${sanitizeBasicAscii(item.text)}) Tj`);
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

export async function buildCoverPagePdfBlob(
  app: InstallmentApplication,
  branches: Branch[],
  users: StaffUser[],
): Promise<Blob> {
  try {
    const templateBytes = await loadCoverPageTemplateBytes();
    const pdfDoc = await PDFDocument.load(templateBytes);
    const pages = pdfDoc.getPages();
    const page1 = pages[0];
    const page2 = pages[1];

    if (!page1 || !page2) {
      return buildFallbackCoverPagePdfBlob(app, branches, users);
    }

    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const redColor = rgb(1, 0, 0);
    const blackColor = rgb(0, 0, 0);

    const ref1Value = app.ref1Id && app.ref1Id.trim() && app.ref1Id !== '—' ? app.ref1Id.trim() : '-';
    const phoneProducts = formatProductList(app);

    // Page 1 — Top-right REF1 CASE ID value
    const ref1Pos = toPage1Point(883.0, 47.490234);
    drawMaskedField({
      page: page1,
      font: fontBold,
      text: ref1Value,
      x: ref1Pos.x,
      y: ref1Pos.y,
      maskX: ref1Pos.x - 3,
      maskWidth: 92,
      fontSize: TITLE_FONT_SIZE,
      maxWidth: 74,
      color: blackColor,
    });

    // Page 1 — Customer & Financing fields (all aligned at stream x=436.0)
    const p1Fields: {
      ys: number;
      text: string;
      color?: ReturnType<typeof rgb>;
    }[] = [
      { ys: 164.14581, text: app.customerName },
      { ys: 190.14581, text: app.icNumber },
      { ys: 216.14581, text: app.phone },
      { ys: 263.1458, text: phoneProducts },
      {
        ys: 289.1458,
        text: `RM ${formatCoverAmount(app.financing.deposit)}`,
        color: redColor,
      },
      { ys: 315.1458, text: `${app.financing.installmentDuration} bulan` },
      { ys: 341.1458, text: `RM ${formatCoverAmount(app.financing.monthlyInstallment)}` },
      { ys: 367.1458, text: `RM ${formatCoverAmount(app.financing.totalProductPrice)}` },
      {
        ys: 393.05966,
        text: `RM ${formatCoverAmount(app.financing.agreementFee)}`,
        color: redColor,
      },
    ];

    for (const field of p1Fields) {
      const pos = toPage1Point(436.0, field.ys);
      drawMaskedField({
        page: page1,
        font: fontRegular,
        text: field.text,
        x: pos.x,
        y: pos.y,
        maskX: pos.x - 3.5,
        maskWidth: 298,
        fontSize: BODY_FONT_SIZE,
        maxWidth: 282,
        color: field.color ?? blackColor,
      });
    }

    // Page 2 — Customer Name, NRIC No., Agreement No. (all aligned at stream x=242.0)
    const p2Fields: { ys: number; text: string }[] = [
      { ys: 1605.1458, text: app.customerName },
      { ys: 1631.1458, text: app.icNumber },
      { ys: 1657.1458, text: app.caseId },
    ];

    for (const field of p2Fields) {
      const pos = toPage2Point(242.0, field.ys);
      drawMaskedField({
        page: page2,
        font: fontRegular,
        text: field.text,
        x: pos.x,
        y: pos.y,
        maskX: pos.x - 4,
        maskWidth: 390,
        fontSize: BODY_FONT_SIZE,
        maxWidth: 378,
        color: blackColor,
      });
    }

    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
  } catch {
    return buildFallbackCoverPagePdfBlob(app, branches, users);
  }
}
