import PDFDocument from 'pdfkit';
import { formatIstDateTime, formatPaiseAsRupees } from '../invoice-format';
import { TaxInvoicePdfModel } from './tax-invoice-pdf.model';

/**
 * B2C tax invoice PDF.
 * TODO(golive): U-GST-08 — computer-generated invoice; CA may still require a signatory or e-sign.
 * TODO(golive): U-GST-10 — place of supply is the buyer state collected at checkout.
 * TODO(golive): U-GST-07 — no IRN / e-invoice payload in this PDF.
 */
export function renderTaxInvoicePdf(
  model: TaxInvoicePdfModel,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ compress: false, size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(16).text('TAX INVOICE');
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(11);
    doc.text(model.seller.legalName);
    doc.text(model.seller.registeredAddress);
    doc.text(`${model.seller.state} (${model.seller.stateCode})`);
    doc.text(`GSTIN: ${model.seller.gstin}`);
    doc.moveDown();

    doc.text(`Invoice number: ${model.invoiceNumber}`);
    doc.text(`Invoice date: ${formatIstDateTime(model.issuedAt)}`);
    doc.text(`Order reference: ${model.orderNumber}`);
    doc.moveDown();

    doc.font('Helvetica-Bold').text('Bill to');
    doc.font('Helvetica');
    doc.text(model.billing.name);
    doc.text(model.billing.addressLine1);
    if (model.billing.addressLine2) {
      doc.text(model.billing.addressLine2);
    }
    doc.text(`${model.billing.city} ${model.billing.pincode}`);
    doc.text(`State: ${model.billing.state} (${model.billing.stateCode})`);
    doc.text(
      `Place of supply: ${model.billing.state} (${model.billing.stateCode})`,
    );
    doc.text('Reverse charge: No');
    doc.moveDown();

    doc.font('Helvetica-Bold').text('Description');
    doc.font('Helvetica');
    doc.text(`SAC: ${model.sacCode}`);
    doc.text(model.sacDescription);
    for (const line of model.lineItems) {
      doc.text(`${line.description} - INR ${formatPaiseAsRupees(line.amount)}`);
    }
    doc.moveDown();

    doc.text(
      `Taxable value: INR ${formatPaiseAsRupees(model.tax.taxableAmount)}`,
    );
    writeTaxLines(doc, model);
    doc.text(
      `Total invoice value: INR ${formatPaiseAsRupees(model.tax.grossAmount)}`,
    );
    doc.moveDown();
    doc.text('Computer-generated invoice. No physical signature is required.');
    if (model.seller.signatoryName) {
      doc.text(`Authorised signatory: ${model.seller.signatoryName}`);
      if (model.seller.signatoryDesignation) {
        doc.text(model.seller.signatoryDesignation);
      }
    }

    doc.end();
  });
}

function writeTaxLines(
  doc: PDFKit.PDFDocument,
  model: TaxInvoicePdfModel,
): void {
  if (model.tax.igst > 0) {
    doc.text(
      `IGST @ ${model.tax.taxRate}%: INR ${formatPaiseAsRupees(model.tax.igst)}`,
    );
    return;
  }
  const half = model.tax.taxRate / 2;
  doc.text(`CGST @ ${half}%: INR ${formatPaiseAsRupees(model.tax.cgst)}`);
  doc.text(`SGST @ ${half}%: INR ${formatPaiseAsRupees(model.tax.sgst)}`);
}
