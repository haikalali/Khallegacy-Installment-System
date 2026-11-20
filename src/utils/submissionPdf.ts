import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from 'pdf-lib';
import type { InstallmentApplication, SaleSubmissionList } from '../types/khallegacy';
import { resolveActualCashPayment } from './businessRules';

const PAGE_WIDTH = 841.9;
const PAGE_HEIGHT = 595.3;

const HEADER_FILL = rgb(0.839, 0.863, 0.898);
const BLUE_TEXT = rgb(0, 0, 1);
const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);

const MALAY_MONTHS = [
  'JANUARI',
  'FEBRUARI',
  'MAC',
  'APRIL',
  'MEI',
  'JUN',
  'JULAI',
  'OGOS',
  'SEPTEMBER',
  'OKTOBER',
  'NOVEMBER',
  'DISEMBER',
];

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

function formatMalaySubmissionDate(dateStr: string): string {
  const clean = (dateStr || '').trim();
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return sanitizePdfText(clean).toUpperCase() || '-';
  const year = match[1];
  const monthIdx = Number(match[2]) - 1;
  const day = Number(match[3]);
  const monthName = MALAY_MONTHS[monthIdx] ?? match[2];
  return `${day} ${monthName} ${year}`;
}

function formatCellNumber(amount: number): string {
  const rounded = Math.round((Number(amount) || 0) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function formatTotalRm(amount: number): string {
  const rounded = Math.round((Number(amount) || 0) * 100) / 100;
  if (Number.isInteger(rounded)) {
    return `RM ${rounded.toLocaleString('en-MY')}`;
  }
  return `RM ${rounded.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatProductLabel(app: InstallmentApplication): string {
  const items = app.products
    .map((p) => {
      const name = sanitizePdfText(p.productName).toUpperCase();
      if (!name) return '';
      return p.quantity > 1 ? `${name} (x${p.quantity})` : name;
    })
    .filter(Boolean);
  return items.join(' + ') || '-';
}

function wrapTextToLines(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
): string[] {
  const clean = sanitizePdfText(text) || '-';
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return ['-'];

  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
    } else if (!current) {
      let chunk = '';
      for (const ch of word) {
        if (font.widthOfTextAtSize(chunk + ch, fontSize) <= maxWidth) {
          chunk += ch;
        } else {
          if (chunk) lines.push(chunk);
          chunk = ch;
        }
      }
      current = chunk;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : ['-'];
}

interface TableColumn {
  key: string;
  x: number;
  width: number;
  headerLines: string[];
  align: 'left' | 'center' | 'right';
}

const COLUMNS: TableColumn[] = [
  { key: 'no', x: 30.5, width: 26.8, headerLines: ['No'], align: 'center' },
  { key: 'ic', x: 57.3, width: 79.1, headerLines: ['IC Number'], align: 'center' },
  { key: 'name', x: 136.4, width: 204.7, headerLines: ['Customer Name'], align: 'center' },
  { key: 'item', x: 341.1, width: 156.15, headerLines: ['Item'], align: 'center' },
  {
    key: 'finance',
    x: 497.25,
    width: 59.15,
    headerLines: ['Finance', 'Amount'],
    align: 'right',
  },
  { key: 'deposit', x: 556.4, width: 50.3, headerLines: ['Deposit'], align: 'right' },
  {
    key: 'stamp',
    x: 606.7,
    width: 60.85,
    headerLines: ['Stamp', 'Duty Fee'],
    align: 'right',
  },
  {
    key: 'processing',
    x: 667.55,
    width: 62.65,
    headerLines: ['Processing', 'Fee'],
    align: 'right',
  },
  {
    key: 'actualCash',
    x: 730.2,
    width: 81.25,
    headerLines: ['Actual Cash', 'Payment'],
    align: 'right',
  },
];

const TABLE_LEFT = 30.5;
const TABLE_WIDTH = 780.95;

function toPdfY(topY: number): number {
  return PAGE_HEIGHT - topY;
}

function drawCellBox(
  page: PDFPage,
  x: number,
  topY: number,
  width: number,
  height: number,
  fillColor: ReturnType<typeof rgb> = WHITE,
  borderWidth = 0.6,
) {
  page.drawRectangle({
    x,
    y: toPdfY(topY + height),
    width,
    height,
    color: fillColor,
    borderColor: BLACK,
    borderWidth,
  });
}

function drawDocumentHeader(
  page: PDFPage,
  submissionDate: string,
  fontBold: PDFFont,
) {
  const title = 'CREDIT SALES SUBMISSION LIST (JCL CREDIT)';
  const titleSize = 14.5;
  const titleWidth = fontBold.widthOfTextAtSize(title, titleSize);
  page.drawText(title, {
    x: (PAGE_WIDTH - titleWidth) / 2,
    y: toPdfY(52),
    size: titleSize,
    font: fontBold,
    color: BLACK,
  });

  const subSize = 11;
  const compPrefix = 'Company Name: ';
  const compValue = 'KHAL LEGACY TRADING';
  const compTotalW =
    fontBold.widthOfTextAtSize(compPrefix, subSize) +
    fontBold.widthOfTextAtSize(compValue, subSize);
  const compStartX = (PAGE_WIDTH - compTotalW) / 2;
  page.drawText(compPrefix, {
    x: compStartX,
    y: toPdfY(70),
    size: subSize,
    font: fontBold,
    color: BLACK,
  });
  page.drawText(compValue, {
    x: compStartX + fontBold.widthOfTextAtSize(compPrefix, subSize),
    y: toPdfY(70),
    size: subSize,
    font: fontBold,
    color: BLUE_TEXT,
  });

  const periodPrefix = 'Sales Submission For The Period Of: ';
  const periodValue = formatMalaySubmissionDate(submissionDate);
  const periodTotalW =
    fontBold.widthOfTextAtSize(periodPrefix, subSize) +
    fontBold.widthOfTextAtSize(periodValue, subSize);
  const periodStartX = (PAGE_WIDTH - periodTotalW) / 2;
  page.drawText(periodPrefix, {
    x: periodStartX,
    y: toPdfY(86.5),
    size: subSize,
    font: fontBold,
    color: BLACK,
  });
  page.drawText(periodValue, {
    x: periodStartX + fontBold.widthOfTextAtSize(periodPrefix, subSize),
    y: toPdfY(86.5),
    size: subSize,
    font: fontBold,
    color: BLUE_TEXT,
  });
}

function drawTableHeader(page: PDFPage, topY: number, fontBold: PDFFont): number {
  const headerHeight = 40.75;
  const headerFontSize = 9.5;
  const lineGap = 11.5;

  for (const col of COLUMNS) {
    drawCellBox(page, col.x, topY, col.width, headerHeight, HEADER_FILL, 0.75);
    const totalTextH = col.headerLines.length * headerFontSize + (col.headerLines.length - 1) * 2;
    const firstBaselineTop =
      topY + (headerHeight - totalTextH) / 2 + headerFontSize * 0.78;

    col.headerLines.forEach((line, i) => {
      const w = fontBold.widthOfTextAtSize(line, headerFontSize);
      page.drawText(line, {
        x: col.x + (col.width - w) / 2,
        y: toPdfY(firstBaselineTop + i * lineGap),
        size: headerFontSize,
        font: fontBold,
        color: BLACK,
      });
    });
  }

  return topY + headerHeight;
}

// Exact proportions matching sale_submission_template_8852486b.pdf
const SIG_HEADER_OFFSET_FROM_TOTAL = 50.7;
const SIG_LINE_OFFSET_FROM_HEADER = 58.6;
const SIG_DATE_OFFSET_FROM_LINE = 14.6;
const SIG_CHOP_OFFSET_FROM_LINE = 29.3;
const SIG_TOTAL_HEIGHT_BELOW_HEADER = SIG_LINE_OFFSET_FROM_HEADER + SIG_CHOP_OFFSET_FROM_LINE;

function drawSignatureBlock(
  page: PDFPage,
  headerBaselineTopY: number,
  fontBold: PDFFont,
  fontRegular: PDFFont,
) {
  const leftX = 36;
  const rightX = 426.36;
  const lineWidth = 195;

  page.drawText('KHAL LEGACY TRADING / Authorised Signature', {
    x: leftX,
    y: toPdfY(headerBaselineTopY),
    size: 10.5,
    font: fontBold,
    color: BLACK,
  });
  page.drawText('JCL CREDIT LEASING SDN BHD / Authorised Signature', {
    x: rightX,
    y: toPdfY(headerBaselineTopY),
    size: 10.5,
    font: fontBold,
    color: BLACK,
  });

  const lineTopY = headerBaselineTopY + SIG_LINE_OFFSET_FROM_HEADER;
  page.drawLine({
    start: { x: leftX, y: toPdfY(lineTopY) },
    end: { x: leftX + lineWidth, y: toPdfY(lineTopY) },
    thickness: 0.9,
    color: BLACK,
  });
  page.drawLine({
    start: { x: rightX, y: toPdfY(lineTopY) },
    end: { x: rightX + lineWidth, y: toPdfY(lineTopY) },
    thickness: 0.9,
    color: BLACK,
  });

  const dateTopY = lineTopY + SIG_DATE_OFFSET_FROM_LINE;
  const chopTopY = lineTopY + SIG_CHOP_OFFSET_FROM_LINE;

  page.drawText('Date:', {
    x: leftX,
    y: toPdfY(dateTopY),
    size: 10,
    font: fontRegular,
    color: BLACK,
  });
  page.drawText('Company Stamp/Chop', {
    x: leftX,
    y: toPdfY(chopTopY),
    size: 10,
    font: fontRegular,
    color: BLACK,
  });

  page.drawText('Date:', {
    x: rightX,
    y: toPdfY(dateTopY),
    size: 10,
    font: fontRegular,
    color: BLACK,
  });
  page.drawText('Company Stamp/Chop', {
    x: rightX,
    y: toPdfY(chopTopY),
    size: 10,
    font: fontRegular,
    color: BLACK,
  });
}

export async function buildSaleSubmissionPdfBlob(
  submission: SaleSubmissionList,
  apps: InstallmentApplication[],
): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const fontSize = 8.5;
  const lineHeight = 10.5;
  const cellPadX = 5;
  const minRowHeight = 20.6;
  const bottomLimitTopY = 555;

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawDocumentHeader(page, submission.submissionDate, fontBold);
  let cursorTopY = drawTableHeader(page, 98, fontBold);

  let sumActualCash = 0;

  apps.forEach((app, idx) => {
    const icText = sanitizePdfText(app.icNumber) || '-';
    const nameText = (sanitizePdfText(app.customerName) || '-').toUpperCase();
    const itemText = formatProductLabel(app);

    const financeVal = app.financing.totalProductPrice;
    const depositVal = app.financing.deposit;
    const stampVal = app.financing.stampDutyFee;
    const processingVal = app.financing.processingFee + app.financing.sstAmount;
    const actualCashVal = resolveActualCashPayment(app.financing);
    sumActualCash += actualCashVal;

    const nameLines = wrapTextToLines(nameText, fontRegular, fontSize, 204.7 - cellPadX * 2);
    const itemLines = wrapTextToLines(itemText, fontRegular, fontSize, 156.15 - cellPadX * 2);
    const maxLines = Math.max(1, nameLines.length, itemLines.length);
    const rowHeight = Math.max(minRowHeight, maxLines * lineHeight + 8);

    if (cursorTopY + rowHeight > bottomLimitTopY) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      cursorTopY = drawTableHeader(page, 36, fontBold);
    }

    const rowValues: Record<string, string[]> = {
      no: [String(idx + 1)],
      ic: [icText],
      name: nameLines,
      item: itemLines,
      finance: [formatCellNumber(financeVal)],
      deposit: [formatCellNumber(depositVal)],
      stamp: [formatCellNumber(stampVal)],
      processing: [formatCellNumber(processingVal)],
      actualCash: [formatCellNumber(actualCashVal)],
    };

    for (const col of COLUMNS) {
      drawCellBox(page, col.x, cursorTopY, col.width, rowHeight, WHITE, 0.55);
      const lines = rowValues[col.key] ?? ['-'];
      const totalBlockH = lines.length * fontSize + (lines.length - 1) * (lineHeight - fontSize);
      const startBaselineTop =
        cursorTopY + (rowHeight - totalBlockH) / 2 + fontSize * 0.78;

      lines.forEach((line, lineIdx) => {
        let fittedSize = fontSize;
        if (col.key === 'ic') {
          while (fittedSize > 6.5 && fontRegular.widthOfTextAtSize(line, fittedSize) > col.width - 6) {
            fittedSize -= 0.25;
          }
        }
        const textWidth = fontRegular.widthOfTextAtSize(line, fittedSize);
        let textX = col.x + cellPadX;
        if (col.key === 'no' || col.key === 'ic') {
          textX = col.x + (col.width - textWidth) / 2;
        } else if (col.align === 'right') {
          textX = col.x + col.width - cellPadX - textWidth;
        }

        page.drawText(line, {
          x: textX,
          y: toPdfY(startBaselineTop + lineIdx * lineHeight),
          size: fittedSize,
          font: fontRegular,
          color: BLACK,
        });
      });
    }

    cursorTopY += rowHeight;
  });

  // TOTAL row
  const totalRowHeight = 23.5;
  if (cursorTopY + totalRowHeight > bottomLimitTopY) {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    cursorTopY = drawTableHeader(page, 36, fontBold);
  }

  const leftSpanWidth = 730.2 - TABLE_LEFT;
  const rightColWidth = TABLE_WIDTH - leftSpanWidth;
  drawCellBox(page, TABLE_LEFT, cursorTopY, leftSpanWidth, totalRowHeight, HEADER_FILL, 0.75);
  drawCellBox(page, 730.2, cursorTopY, rightColWidth, totalRowHeight, HEADER_FILL, 0.75);

  const totalFontSize = 9.5;
  const totalBaselineTop = cursorTopY + (totalRowHeight - totalFontSize) / 2 + totalFontSize * 0.78;

  page.drawText('TOTAL', {
    x: TABLE_LEFT + 5,
    y: toPdfY(totalBaselineTop),
    size: totalFontSize,
    font: fontBold,
    color: BLACK,
  });

  const totalFormatted = formatTotalRm(sumActualCash);
  const totalWidth = fontBold.widthOfTextAtSize(totalFormatted, totalFontSize);
  page.drawText(totalFormatted, {
    x: 730.2 + rightColWidth - 5 - totalWidth,
    y: toPdfY(totalBaselineTop),
    size: totalFontSize,
    font: fontBold,
    color: BLACK,
  });

  cursorTopY += totalRowHeight;

  // Signature block directly below TOTAL row if vertical space permits, else on a clean continuation page
  const bottomSafeMargin = 28;
  const headerBaselineTopY = cursorTopY + SIG_HEADER_OFFSET_FROM_TOTAL;
  if (headerBaselineTopY + SIG_TOTAL_HEIGHT_BELOW_HEADER <= PAGE_HEIGHT - bottomSafeMargin) {
    drawSignatureBlock(page, headerBaselineTopY, fontBold, fontRegular);
  } else {
    const sigPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawSignatureBlock(sigPage, 72, fontBold, fontRegular);
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
}
