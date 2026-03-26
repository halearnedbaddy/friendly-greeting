import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { format } from 'date-fns';

export interface ReceiptItem {
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total: number;
  sku?: string;
}

export interface ReceiptPdfData {
  receiptNumber: string;
  orderId: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  deliveryFee: number;
  discount: number;
  total: number;
  paymentMethod?: string;
  mpesaCode?: string;
  mpesaPhone?: string;
  paymentVerified?: boolean;
  paymentTime?: Date;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  sellerName?: string;
  sellerContact?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export async function generateReceiptPdf(data: ReceiptPdfData): Promise<Buffer> {
  const primaryColor = data.primaryColor || '#00C896';
  const secondaryColor = data.secondaryColor || '#003D29';
  const appUrl = process.env.FRONTEND_URL || process.env.BACKEND_URL || 'https://payloom.co';
  const trackingUrl = `${appUrl}/track/${data.orderId}`;

  // Generate QR code as PNG buffer
  const qrBuffer = await QRCode.toBuffer(trackingUrl, {
    width: 120,
    margin: 1,
    color: { dark: '#000000', light: '#FFFFFF' },
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = 545;
    const L = 50;

    const hline = (y: number, color = '#CCCCCC', weight = 1) => {
      doc.strokeColor(color).lineWidth(weight).moveTo(L, y).lineTo(W, y).stroke();
    };

    // ── Header ────────────────────────────────────────────────────────────
    doc.fontSize(22).fillColor(primaryColor).font('Helvetica-Bold')
      .text('PAYLOOM INSTANTS', { align: 'center' });
    doc.fontSize(15).fillColor(secondaryColor)
      .text(data.sellerName || 'Store Receipt', { align: 'center' });
    if (data.sellerContact) {
      doc.fontSize(9).fillColor('#666666').font('Helvetica')
        .text(`Contact: ${data.sellerContact}`, { align: 'center' });
    }
    doc.moveDown(0.6);
    hline(doc.y, primaryColor, 2);
    doc.moveDown(0.8);

    // ── Receipt meta ──────────────────────────────────────────────────────
    const metaY = doc.y;
    doc.fontSize(9).fillColor('#000000').font('Helvetica')
      .text(`Receipt #: ${data.receiptNumber}`, L, metaY)
      .text(`Date: ${format(new Date(), 'dd MMM yyyy, h:mm a')}`, 340, metaY);
    doc.text(`Order ID: ${data.orderId}`, L, doc.y + 4);
    doc.moveDown(1);
    hline(doc.y, '#CCCCCC');
    doc.moveDown(0.8);

    // ── Items ─────────────────────────────────────────────────────────────
    doc.fontSize(11).fillColor(secondaryColor).font('Helvetica-Bold')
      .text('ITEMS PURCHASED', L, doc.y);
    doc.moveDown(0.6);

    const col = { name: L, qty: 300, price: 365, total: W };
    let iy = doc.y;

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#333333')
      .text('Item', col.name, iy)
      .text('Qty', col.qty, iy)
      .text('Unit Price', col.price, iy)
      .text('Total', col.total, iy, { align: 'right' });

    iy += 16;
    hline(iy, '#CCCCCC');
    iy += 8;

    doc.font('Helvetica').fillColor('#000000');
    for (const item of data.items) {
      doc.fontSize(9)
        .text(item.name, col.name, iy, { width: col.qty - col.name - 10 })
        .text(String(item.quantity), col.qty, iy)
        .text(`KES ${Number(item.unit_price).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`, col.price, iy)
        .text(`KES ${Number(item.total).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`, col.total, iy, { align: 'right' });
      if (item.description) {
        iy += 13;
        doc.fontSize(8).fillColor('#888888').text(item.description, col.name + 4, iy, { width: 240 });
        doc.fillColor('#000000');
      }
      iy += 20;
    }

    iy += 4;
    hline(iy, primaryColor, 1.5);
    iy += 10;

    // ── Totals ────────────────────────────────────────────────────────────
    const totRow = (label: string, value: number, bold = false, color = '#000000') => {
      const fmt = `KES ${Number(value).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
      doc.fontSize(9).font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(color)
        .text(label, 350, iy)
        .text(fmt, col.total, iy, { align: 'right' });
      iy += 18;
    };

    totRow('Subtotal:', data.subtotal);
    if (data.tax > 0) totRow('Tax (16% VAT):', data.tax);
    if (data.deliveryFee > 0) totRow('Delivery Fee:', data.deliveryFee);
    if (data.discount > 0) totRow('Discount:', -data.discount, false, '#E74C3C');

    hline(iy, primaryColor, 2);
    iy += 8;

    doc.fontSize(13).font('Helvetica-Bold').fillColor(primaryColor)
      .text('TOTAL:', 350, iy)
      .text(
        `KES ${Number(data.total).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`,
        col.total, iy, { align: 'right' }
      );
    iy += 28;

    // ── Payment ───────────────────────────────────────────────────────────
    hline(iy, '#CCCCCC');
    iy += 12;
    doc.fontSize(11).font('Helvetica-Bold').fillColor(secondaryColor).text('PAYMENT', L, iy);
    iy += 18;
    doc.fontSize(9).font('Helvetica').fillColor('#000000');

    if (data.paymentMethod) {
      doc.text(`Method: ${data.paymentMethod}`, L, iy); iy += 16;
    }
    if (data.mpesaCode) {
      doc.text(`M-Pesa Code: ${data.mpesaCode}`, L, iy); iy += 16;
    }
    if (data.mpesaPhone) {
      doc.text(`Phone: ${data.mpesaPhone}`, L, iy); iy += 16;
    }
    if (data.paymentTime) {
      doc.text(`Time: ${format(new Date(data.paymentTime), 'dd MMM yyyy, h:mm a')}`, L, iy); iy += 16;
    }
    doc.fillColor(data.paymentVerified ? '#27AE60' : '#F39C12').font('Helvetica-Bold')
      .text(data.paymentVerified ? '✓ PAYMENT VERIFIED' : '⏳ PAYMENT PENDING', L, iy);
    iy += 24;

    // ── Customer ──────────────────────────────────────────────────────────
    if (data.customerName || data.customerPhone) {
      hline(iy, '#CCCCCC');
      iy += 12;
      doc.fontSize(11).font('Helvetica-Bold').fillColor(secondaryColor).text('CUSTOMER', L, iy);
      iy += 18;
      doc.fontSize(9).font('Helvetica').fillColor('#000000');
      if (data.customerName) { doc.text(`Name: ${data.customerName}`, L, iy); iy += 16; }
      if (data.customerPhone) { doc.text(`Phone: ${data.customerPhone}`, L, iy); iy += 16; }
      if (data.deliveryAddress) {
        doc.text(`Delivery: ${data.deliveryAddress}`, L, iy, { width: 300 });
        iy += 24;
      }
    }

    // ── Footer + QR ───────────────────────────────────────────────────────
    iy += 8;
    hline(iy, primaryColor, 1);
    iy += 12;

    // QR code on the right
    const qrY = iy;
    doc.image(qrBuffer, W - 100, qrY, { width: 80 });

    doc.fontSize(9).fillColor('#666666').font('Helvetica')
      .text('Thank you for shopping with us!', L, iy)
      .text(`Track your order: ${trackingUrl}`, L, iy + 14, { width: 330 });

    doc.fontSize(7).fillColor('#AAAAAA')
      .text('Scan QR code to track order', W - 100, qrY + 82, { width: 80, align: 'center' });

    doc.end();
  });
}
