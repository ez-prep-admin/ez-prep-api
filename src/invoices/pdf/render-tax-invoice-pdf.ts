import PDFDocument from 'pdfkit';
import {
  supplyTypeFromSnapshot,
  supplyTypeLabel,
} from '../../common/commerce/calculate-inclusive-tax';
import { formatIstDateTime, formatPaiseAsRupees } from '../invoice-format';
import { TaxInvoicePdfModel } from './tax-invoice-pdf.model';

/**
 * B2C tax invoice PDF.
 * Drawn with the standard PDF fonts and no images, so the file stays small.
 * The rupee sign is the Noto Sans Bold outline; Helvetica has no ₹ glyph.
 * TODO(golive): U-GST-08 — computer-generated invoice; CA may still require a signatory or e-sign.
 * TODO(golive): U-GST-10 — place of supply is the buyer state collected at checkout.
 * TODO(golive): U-GST-07 — no IRN / e-invoice payload in this PDF.
 */

const NAVY = '#10233F';
const BLUE = '#2F6FED';
const INK = '#111827';
const MUTED = '#6B7280';
const LINE = '#E5E7EB';
const WASH = '#F8F9FB';
const WHITE = '#FFFFFF';

const PAGE_PAD = 40;

export function renderTaxInvoicePdf(
  model: TaxInvoicePdfModel,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      compress: false,
      size: 'A4',
      margin: 0,
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    paintInvoice(doc, model);
    doc.end();
  });
}

function paintInvoice(
  doc: PDFKit.PDFDocument,
  model: TaxInvoicePdfModel,
): void {
  const left = PAGE_PAD;
  const width = doc.page.width - PAGE_PAD * 2;
  let y = PAGE_PAD;

  y = drawHeader(doc, model, left, y, width);
  y = drawMeta(doc, model, left, y + 22, width);
  y = drawBillTo(doc, model, left, y + 22, width);
  y = drawItems(doc, model, left, y + 22, width);
  y = drawTotals(doc, model, left, y + 16, width);
  drawFooter(doc, model, left, y + 28, width);
}

function drawHeader(
  doc: PDFKit.PDFDocument,
  model: TaxInvoicePdfModel,
  left: number,
  y: number,
  width: number,
): number {
  const boxWidth = 248;
  const boxHeight = 92;
  const brandWidth = width - boxWidth - 20;
  const brand = splitBrand(model.seller.legalName);

  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(18);
  doc.text(brand.name, left, y + 4, { width: brandWidth });
  let textY = doc.y + 2;
  if (brand.tagline) {
    doc.fillColor(MUTED).font('Helvetica').fontSize(8);
    doc.text(brand.tagline, left, textY, {
      width: brandWidth,
      characterSpacing: 0.6,
    });
    textY = doc.y + 8;
  } else {
    textY += 6;
  }
  doc.fillColor(INK).font('Helvetica').fontSize(9);
  doc.text(model.seller.registeredAddress, left, textY, { width: brandWidth });
  doc.fillColor(MUTED).fontSize(8);
  doc.text(
    `${model.seller.state} (${model.seller.stateCode}) · GSTIN: ${model.seller.gstin}`,
    left,
    doc.y + 2,
    { width: brandWidth },
  );

  const boxX = left + width - boxWidth;
  doc.rect(boxX, y, boxWidth, boxHeight).fill(NAVY);
  doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(16);
  doc.text('TAX INVOICE', boxX + 16, y + 18, { width: boxWidth - 32 });
  doc.font('Helvetica').fontSize(8);
  doc.text(`INVOICE NO. ${model.invoiceNumber}`, boxX + 16, y + 42, {
    width: boxWidth - 32,
  });
  doc.text(headerDate(model.issuedAt), boxX + 16, y + 56, {
    width: boxWidth - 32,
  });

  return y + boxHeight;
}

function drawMeta(
  doc: PDFKit.PDFDocument,
  model: TaxInvoicePdfModel,
  left: number,
  y: number,
  width: number,
): number {
  const height = 48;
  const columns: Array<[string, string]> = [
    ['Order reference', model.orderNumber],
    ['Place of supply', `${model.billing.state} (${model.billing.stateCode})`],
    ['Supply type', supplyTypeLabel(supplyTypeFromSnapshot(model.tax))],
    ['Reverse charge', 'No'],
  ];
  const colWidth = width / columns.length;

  doc.lineWidth(0.8).strokeColor(LINE).rect(left, y, width, height).stroke();
  columns.forEach(([label, value], index) => {
    const x = left + colWidth * index;
    if (index > 0) {
      doc
        .moveTo(x, y)
        .lineTo(x, y + height)
        .stroke();
    }
    doc.fillColor(MUTED).font('Helvetica').fontSize(7);
    doc.text(label, x + 10, y + 8, { width: colWidth - 20 });
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(10);
    doc.text(value, x + 10, y + 22, { width: colWidth - 20 });
  });

  return y + height;
}

function drawBillTo(
  doc: PDFKit.PDFDocument,
  model: TaxInvoicePdfModel,
  left: number,
  y: number,
  width: number,
): number {
  doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(8);
  doc.text('BILL TO', left, y, { characterSpacing: 0.4 });

  const boxY = y + 16;
  const stateWidth = 160;
  const addressWidth = width - stateWidth;
  const addressLines = [
    model.billing.addressLine1,
    model.billing.addressLine2,
    `${model.billing.city} ${model.billing.pincode}`,
  ].filter((line): line is string => Boolean(line?.trim()));
  const height = Math.max(72, 28 + addressLines.length * 13);

  doc.lineWidth(0.8).strokeColor(LINE).rect(left, boxY, width, height).stroke();
  doc
    .moveTo(left + addressWidth, boxY)
    .lineTo(left + addressWidth, boxY + height)
    .stroke();

  doc.fillColor(INK).font('Helvetica-Bold').fontSize(10);
  doc.text(model.billing.name, left + 12, boxY + 12, {
    width: addressWidth - 24,
  });
  doc.font('Helvetica').fontSize(9).fillColor(INK);
  let lineY = doc.y + 2;
  for (const line of addressLines) {
    doc.text(line, left + 12, lineY, { width: addressWidth - 24 });
    lineY = doc.y + 1;
  }

  doc.fillColor(MUTED).font('Helvetica').fontSize(7);
  doc.text('CUSTOMER STATE', left + addressWidth + 12, boxY + 14, {
    width: stateWidth - 24,
  });
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(10);
  doc.text(
    `${model.billing.state} (${model.billing.stateCode})`,
    left + addressWidth + 12,
    boxY + 28,
    { width: stateWidth - 24 },
  );

  return boxY + height;
}

function drawItems(
  doc: PDFKit.PDFDocument,
  model: TaxInvoicePdfModel,
  left: number,
  y: number,
  width: number,
): number {
  doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(8);
  doc.text('ITEM DETAILS', left, y, { characterSpacing: 0.4 });

  const tableY = y + 16;
  const sacWidth = 72;
  const amountWidth = 100;
  const descWidth = width - sacWidth - amountWidth;
  const headerHeight = 22;
  const rows = itemRows(model);

  doc.rect(left, tableY, width, headerHeight).fill(BLUE);
  doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(8);
  doc.text('SAC', left + 10, tableY + 6, { width: sacWidth - 16 });
  doc.text('DESCRIPTION', left + sacWidth, tableY + 6, {
    width: descWidth - 8,
  });
  doc.text('AMOUNT', left + sacWidth + descWidth, tableY + 6, {
    width: amountWidth - 12,
    align: 'right',
  });

  let rowY = tableY + headerHeight;
  rows.forEach((row, index) => {
    doc.font('Helvetica').fontSize(9);
    const descHeight = doc.heightOfString(row.description, {
      width: descWidth - 16,
    });
    const rowHeight = Math.max(36, descHeight + 16);
    if (index % 2 === 1) {
      doc.rect(left, rowY, width, rowHeight).fill(WASH);
    }
    doc.fillColor(INK).font('Helvetica').fontSize(9);
    doc.text(row.sac, left + 10, rowY + 8, { width: sacWidth - 16 });
    doc.text(row.description, left + sacWidth, rowY + 8, {
      width: descWidth - 16,
    });
    doc.font('Helvetica-Bold');
    if (row.amountPaise != null) {
      drawMoney(
        doc,
        row.amountPaise,
        left + sacWidth + descWidth,
        rowY + 8,
        amountWidth - 12,
        INK,
      );
    }
    rowY += rowHeight;
  });

  doc
    .lineWidth(0.8)
    .strokeColor(LINE)
    .rect(left, tableY, width, rowY - tableY)
    .stroke();
  return rowY;
}

function drawTotals(
  doc: PDFKit.PDFDocument,
  model: TaxInvoicePdfModel,
  left: number,
  y: number,
  width: number,
): number {
  const totalWidth = 210;
  const gap = 12;
  const tableWidth = width - totalWidth - gap;
  const rows = taxRows(model);
  const rowHeight = 24;
  const height = rows.length * rowHeight;

  doc
    .lineWidth(0.8)
    .strokeColor(LINE)
    .rect(left, y, tableWidth, height)
    .stroke();
  rows.forEach(([label, amount], index) => {
    const rowY = y + index * rowHeight;
    if (index > 0) {
      doc
        .moveTo(left, rowY)
        .lineTo(left + tableWidth, rowY)
        .stroke();
    }
    doc.fillColor(INK).font('Helvetica').fontSize(9);
    doc.text(label, left + 10, rowY + 6, { width: tableWidth * 0.55 });
    doc.font('Helvetica-Bold');
    drawMoney(
      doc,
      amount,
      left + tableWidth * 0.5,
      rowY + 6,
      tableWidth * 0.5 - 10,
      INK,
    );
  });

  const totalX = left + tableWidth + gap;
  doc.rect(totalX, y, totalWidth, height).fill(NAVY);
  doc.fillColor(WHITE).font('Helvetica').fontSize(8);
  doc.text('TOTAL INVOICE VALUE', totalX + 14, y + 14, {
    width: totalWidth - 28,
  });
  doc.font('Helvetica-Bold').fontSize(14);
  drawMoney(
    doc,
    model.tax.grossAmount,
    totalX + 14,
    y + Math.max(32, height / 2),
    totalWidth - 28,
    WHITE,
  );

  return y + height;
}

function drawFooter(
  doc: PDFKit.PDFDocument,
  model: TaxInvoicePdfModel,
  left: number,
  y: number,
  width: number,
): void {
  const brand = splitBrand(model.seller.legalName);
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(9);
  doc.text(model.seller.legalName, left, y, { width: width * 0.55 });
  doc.fillColor(MUTED).font('Helvetica').fontSize(8);
  doc.text(
    'Computer-generated invoice. No physical signature is required.',
    left,
    doc.y + 3,
    { width: width * 0.55 },
  );
  if (model.seller.signatoryName) {
    const signatory = model.seller.signatoryDesignation
      ? `${model.seller.signatoryName}, ${model.seller.signatoryDesignation}`
      : model.seller.signatoryName;
    doc.text(`Authorised signatory: ${signatory}`, left, doc.y + 2, {
      width: width * 0.55,
    });
  }

  doc.text(`Thank you for choosing ${brand.name}.`, left + width * 0.48, y, {
    width: width * 0.52,
    align: 'right',
  });
}

function itemRows(model: TaxInvoicePdfModel): Array<{
  sac: string;
  description: string;
  amountPaise: number | null;
}> {
  if (model.lineItems.length === 0) {
    return [
      {
        sac: model.sacCode,
        description: model.sacDescription,
        amountPaise: null,
      },
    ];
  }
  return model.lineItems.map((line, index) => ({
    sac: index === 0 ? model.sacCode : '',
    description:
      index === 0
        ? `${model.sacDescription}\n${line.description}`
        : line.description,
    amountPaise: line.amount,
  }));
}

function taxRows(model: TaxInvoicePdfModel): Array<[string, number]> {
  const rows: Array<[string, number]> = [
    ['Taxable value', model.tax.taxableAmount],
  ];
  if (supplyTypeFromSnapshot(model.tax) === 'INTER_STATE') {
    rows.push([`IGST @ ${model.tax.taxRate}%`, model.tax.igst]);
    return rows;
  }
  const half = model.tax.taxRate / 2;
  rows.push([`CGST @ ${half}%`, model.tax.cgst]);
  rows.push([`SGST @ ${half}%`, model.tax.sgst]);
  return rows;
}

function splitBrand(legalName: string): { name: string; tagline?: string } {
  const parts = legalName.split(/\s+-\s+/);
  if (parts.length < 2) {
    return { name: legalName };
  }
  return {
    name: parts[0],
    tagline: parts.slice(1).join(' - ').toUpperCase(),
  };
}

function headerDate(issuedAt: Date): string {
  return formatIstDateTime(issuedAt).replace(', ', ' · ').toUpperCase();
}

const HELVETICA_BASELINE = 0.718;
/** Noto Sans Bold rupee, 1000 units per em. Advance width 572. */
const RUPEE_ADVANCE = 572;

function drawMoney(
  doc: PDFKit.PDFDocument,
  paise: number,
  x: number,
  y: number,
  boxWidth: number,
  color: string,
): void {
  const amount = formatPaiseAsRupees(paise);
  const fontSize = (doc as PDFKit.PDFDocument & { _fontSize: number })
    ._fontSize;
  const scale = fontSize / 1000;
  const symbolWidth = RUPEE_ADVANCE * scale;
  const gap = fontSize * 0.12;
  const amountWidth = doc.widthOfString(amount);
  const start = x + boxWidth - amountWidth - gap - symbolWidth;

  drawRupeeSymbol(doc, start, y + fontSize * HELVETICA_BASELINE, scale, color);
  doc.fillColor(color).text(amount, start + symbolWidth + gap, y, {
    lineBreak: false,
    width: amountWidth + 1,
  });
}

/**
 * ₹ is not in the standard PDF fonts. This is the Noto Sans Bold outline
 * (SIL Open Font License), filled as vectors so the file stays small.
 */
function drawRupeeSymbol(
  doc: PDFKit.PDFDocument,
  originX: number,
  baseline: number,
  scale: number,
  color: string,
): void {
  const px = (fontX: number) => originX + fontX * scale;
  const py = (fontY: number) => baseline - fontY * scale;

  doc.save();
  doc.fillColor(color);
  doc.moveTo(px(245), py(0));
  doc.lineTo(px(65), py(314));
  doc.lineTo(px(65), py(388));
  doc.lineTo(px(125), py(388));
  doc.quadraticCurveTo(px(178), py(388), px(214), py(411.5));
  doc.quadraticCurveTo(px(250), py(435), px(260), py(477));
  doc.lineTo(px(65), py(477));
  doc.lineTo(px(65), py(551));
  doc.lineTo(px(259), py(551));
  doc.quadraticCurveTo(px(250), py(589), px(222), py(614.5));
  doc.quadraticCurveTo(px(194), py(640), px(144), py(640));
  doc.lineTo(px(65), py(640));
  doc.lineTo(px(65), py(714));
  doc.lineTo(px(516), py(714));
  doc.lineTo(px(516), py(640));
  doc.lineTo(px(359), py(640));
  doc.quadraticCurveTo(px(394), py(602), px(403), py(551));
  doc.lineTo(px(516), py(551));
  doc.lineTo(px(516), py(477));
  doc.lineTo(px(405), py(477));
  doc.quadraticCurveTo(px(395), py(403), px(348), py(361.5));
  doc.quadraticCurveTo(px(301), py(320), px(227), py(305));
  doc.lineTo(px(423), py(0));
  doc.closePath();
  doc.fill();
  doc.restore();
}
