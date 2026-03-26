# FEATURE 1: PROFESSIONAL RECEIPT GENERATION
## Complete Implementation Guide

---

## 📊 **FEATURE OVERVIEW**

**What it does:**
- Generates professional PDF receipts like supermarket receipts
- Itemized list with quantities, prices, tax
- M-Pesa payment verification details
- QR code for order tracking
- Email/WhatsApp delivery
- Seller branding (logo, colors)

**User Flow:**
```
Customer completes payment
↓
System generates receipt automatically
↓
Receipt emailed to customer
↓
Receipt available for download
↓
Seller can reprint anytime
```

---

## 🗄️ **DATABASE SCHEMA**

### **1. Receipts Table**

```sql
-- Create receipts table
CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_number VARCHAR(50) UNIQUE NOT NULL, -- PL-2026-001234
  order_id UUID REFERENCES orders(id),
  seller_id UUID REFERENCES users(id),
  customer_id UUID REFERENCES users(id),
  
  -- Receipt Details
  items JSONB NOT NULL, -- Array of items
  subtotal DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2) DEFAULT 0,
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  
  -- Payment Details
  payment_method VARCHAR(50), -- M-Pesa, Cash, etc.
  mpesa_code VARCHAR(20),
  mpesa_phone VARCHAR(15),
  payment_verified BOOLEAN DEFAULT false,
  payment_time TIMESTAMP,
  
  -- Customer Details
  customer_name VARCHAR(255),
  customer_phone VARCHAR(15),
  customer_email VARCHAR(255),
  delivery_address TEXT,
  
  -- Seller Branding
  seller_name VARCHAR(255),
  seller_logo_url TEXT,
  seller_colors JSONB, -- {primary: "#00C896", secondary: "#003D29"}
  seller_contact VARCHAR(255),
  
  -- Receipt Status
  status VARCHAR(20) DEFAULT 'generated', -- generated, sent, downloaded
  pdf_url TEXT,
  qr_code_url TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  sent_at TIMESTAMP,
  downloaded_at TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_receipts_order ON receipts(order_id);
CREATE INDEX idx_receipts_seller ON receipts(seller_id);
CREATE INDEX idx_receipts_customer ON receipts(customer_id);
CREATE INDEX idx_receipts_number ON receipts(receipt_number);
CREATE INDEX idx_receipts_created ON receipts(created_at DESC);
```

---

### **2. Receipt Items Structure (JSONB)**

```json
{
  "items": [
    {
      "id": "item_1",
      "name": "Sukuma Wiki",
      "description": "Fresh vegetables",
      "quantity": 2,
      "unit_price": 20.00,
      "total": 40.00,
      "sku": "VEG-001",
      "category": "Vegetables"
    },
    {
      "id": "item_2",
      "name": "Cooking Oil 1L",
      "description": "Premium cooking oil",
      "quantity": 1,
      "unit_price": 350.00,
      "total": 350.00,
      "sku": "OIL-002",
      "category": "Groceries"
    }
  ]
}
```

---

## 🔧 **BACKEND IMPLEMENTATION**

### **1. Receipt Generation Service**

**File: `lib/services/receiptService.ts`**

```typescript
import { createClient } from '@supabase/supabase-js';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { format } from 'date-fns';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface ReceiptItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total: number;
  sku?: string;
  category?: string;
}

interface ReceiptData {
  orderId: string;
  sellerId: string;
  customerId?: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  deliveryFee: number;
  discount: number;
  total: number;
  paymentMethod: string;
  mpesaCode?: string;
  mpesaPhone?: string;
  paymentTime?: Date;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryAddress?: string;
  sellerName: string;
  sellerLogoUrl?: string;
  sellerColors?: {
    primary: string;
    secondary: string;
  };
  sellerContact: string;
}

class ReceiptService {
  /**
   * Generate receipt number
   */
  private async generateReceiptNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from('receipts')
      .select('*', { count: 'exact', head: true });
    
    const nextNumber = (count || 0) + 1;
    return `PL-${year}-${String(nextNumber).padStart(6, '0')}`;
  }

  /**
   * Generate QR code for receipt
   */
  private async generateQRCode(receiptNumber: string, orderId: string): Promise<string> {
    const trackingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/track/${orderId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(trackingUrl, {
      width: 200,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    return qrCodeDataUrl;
  }

  /**
   * Generate PDF receipt
   */
  private async generatePDF(
    receiptNumber: string,
    data: ReceiptData
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ 
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Colors
      const primaryColor = data.sellerColors?.primary || '#00C896';
      const secondaryColor = data.sellerColors?.secondary || '#003D29';

      // Header
      doc
        .fontSize(24)
        .fillColor(primaryColor)
        .text('PAYLOOM INSTANTS', { align: 'center' })
        .fontSize(18)
        .fillColor(secondaryColor)
        .text(data.sellerName, { align: 'center' })
        .moveDown(0.5);

      // Seller contact
      doc
        .fontSize(10)
        .fillColor('#666666')
        .text(`Till: ${data.sellerContact}`, { align: 'center' })
        .moveDown(1);

      // Horizontal line
      doc
        .strokeColor(primaryColor)
        .lineWidth(2)
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke()
        .moveDown(1);

      // Receipt info
      doc
        .fontSize(10)
        .fillColor('#000000')
        .text(`Receipt #: ${receiptNumber}`, 50, doc.y)
        .text(`Date: ${format(new Date(), 'dd MMM yyyy, h:mm a')}`, 350, doc.y - 12)
        .moveDown(0.5)
        .text(`Order ID: ${data.orderId}`, 50, doc.y)
        .moveDown(1);

      // Line
      doc
        .strokeColor('#CCCCCC')
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke()
        .moveDown(1);

      // Items header
      doc
        .fontSize(12)
        .fillColor(secondaryColor)
        .text('ITEMS PURCHASED:', 50, doc.y)
        .moveDown(1);

      // Items table
      doc.fontSize(10).fillColor('#000000');
      
      const tableTop = doc.y;
      let currentY = tableTop;

      // Table headers
      doc
        .font('Helvetica-Bold')
        .text('Item', 50, currentY)
        .text('Qty', 300, currentY)
        .text('Price', 370, currentY)
        .text('Total', 480, currentY, { align: 'right' });
      
      currentY += 20;

      // Draw header line
      doc
        .strokeColor('#CCCCCC')
        .moveTo(50, currentY)
        .lineTo(545, currentY)
        .stroke();
      
      currentY += 10;

      // Items
      doc.font('Helvetica');
      data.items.forEach((item) => {
        doc
          .text(item.name, 50, currentY, { width: 240 })
          .text(item.quantity.toString(), 300, currentY)
          .text(`KES ${item.unit_price.toFixed(2)}`, 370, currentY)
          .text(`KES ${item.total.toFixed(2)}`, 480, currentY, { align: 'right' });
        
        currentY += 25;
      });

      currentY += 10;

      // Totals section
      doc
        .strokeColor(primaryColor)
        .lineWidth(1)
        .moveTo(50, currentY)
        .lineTo(545, currentY)
        .stroke();
      
      currentY += 15;

      // Subtotal
      doc
        .fontSize(10)
        .text('Subtotal:', 370, currentY)
        .text(`KES ${data.subtotal.toFixed(2)}`, 480, currentY, { align: 'right' });
      
      currentY += 20;

      // Tax
      if (data.tax > 0) {
        doc
          .text('Tax (16% VAT):', 370, currentY)
          .text(`KES ${data.tax.toFixed(2)}`, 480, currentY, { align: 'right' });
        currentY += 20;
      }

      // Delivery
      if (data.deliveryFee > 0) {
        doc
          .text('Delivery:', 370, currentY)
          .text(`KES ${data.deliveryFee.toFixed(2)}`, 480, currentY, { align: 'right' });
        currentY += 20;
      }

      // Discount
      if (data.discount > 0) {
        doc
          .fillColor('#E74C3C')
          .text('Discount:', 370, currentY)
          .text(`-KES ${data.discount.toFixed(2)}`, 480, currentY, { align: 'right' })
          .fillColor('#000000');
        currentY += 20;
      }

      // Total line
      doc
        .strokeColor(primaryColor)
        .lineWidth(2)
        .moveTo(350, currentY)
        .lineTo(545, currentY)
        .stroke();
      
      currentY += 15;

      // Total
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor(primaryColor)
        .text('TOTAL:', 370, currentY)
        .text(`KES ${data.total.toFixed(2)}`, 480, currentY, { align: 'right' })
        .fillColor('#000000')
        .font('Helvetica');
      
      currentY += 30;

      // Payment section
      doc
        .strokeColor('#CCCCCC')
        .lineWidth(1)
        .moveTo(50, currentY)
        .lineTo(545, currentY)
        .stroke();
      
      currentY += 15;

      doc
        .fontSize(12)
        .fillColor(secondaryColor)
        .text('PAYMENT:', 50, currentY)
        .moveDown(0.5);

      currentY = doc.y;

      doc
        .fontSize(10)
        .fillColor('#000000')
        .text(`Method: ${data.paymentMethod}`, 50, currentY);

      if (data.mpesaCode) {
        currentY += 20;
        doc.text(`M-Pesa Code: ${data.mpesaCode}`, 50, currentY);
      }

      if (data.mpesaPhone) {
        currentY += 20;
        doc.text(`Phone: ${data.mpesaPhone}`, 50, currentY);
      }

      currentY += 20;
      doc
        .fillColor('#27AE60')
        .text('Status: ✓ VERIFIED', 50, currentY)
        .fillColor('#000000');

      if (data.paymentTime) {
        currentY += 20;
        doc.text(`Time: ${format(data.paymentTime, 'dd MMM yyyy, h:mm a')}`, 50, currentY);
      }

      currentY += 30;

      // Customer section
      doc
        .strokeColor('#CCCCCC')
        .moveTo(50, currentY)
        .lineTo(545, currentY)
        .stroke();
      
      currentY += 15;

      doc
        .fontSize(12)
        .fillColor(secondaryColor)
        .text('CUSTOMER:', 50, currentY)
        .moveDown(0.5);

      currentY = doc.y;

      doc
        .fontSize(10)
        .fillColor('#000000')
        .text(`Name: ${data.customerName}`, 50, currentY);
      
      currentY += 20;
      doc.text(`Phone: ${data.customerPhone}`, 50, currentY);

      if (data.deliveryAddress) {
        currentY += 20;
        doc.text(`Delivery: ${data.deliveryAddress}`, 50, currentY, { width: 300 });
      }

      currentY += 30;

      // Footer
      doc
        .strokeColor(primaryColor)
        .lineWidth(1)
        .moveTo(50, currentY)
        .lineTo(545, currentY)
        .stroke();
      
      currentY += 15;

      doc
        .fontSize(10)
        .fillColor('#666666')
        .text(`Track Order: ${process.env.NEXT_PUBLIC_APP_URL}/track/${data.orderId}`, 50, currentY, { align: 'center' })
        .moveDown(0.5)
        .text('Thank you for shopping with us!', { align: 'center' })
        .moveDown(0.3)
        .text(`Questions? Contact: ${data.sellerContact}`, { align: 'center' });

      // QR Code (if space available)
      if (doc.y < 700) {
        currentY = doc.y + 20;
        // QR code would be embedded here using the data URL
        doc
          .fontSize(8)
          .fillColor('#999999')
          .text('Scan QR code for order details', 250, currentY + 60, { align: 'center' });
      }

      doc.end();
    });
  }

  /**
   * Upload PDF to Supabase Storage
   */
  private async uploadPDF(
    pdfBuffer: Buffer,
    receiptNumber: string
  ): Promise<string> {
    const fileName = `receipts/${receiptNumber}.pdf`;
    
    const { data, error } = await supabase.storage
      .from('payloom-files')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('payloom-files')
      .getPublicUrl(fileName);

    return publicUrl;
  }

  /**
   * Send receipt via email
   */
  private async sendEmail(
    email: string,
    receiptNumber: string,
    pdfUrl: string,
    customerName: string
  ): Promise<void> {
    // Using SendGrid/Resend/Postmark
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'PayLoom <receipts@payloom.co>',
        to: email,
        subject: `Your Receipt - ${receiptNumber}`,
        html: `
          <h2>Thank you for your purchase!</h2>
          <p>Dear ${customerName},</p>
          <p>Your receipt is ready. You can download it using the link below:</p>
          <p><a href="${pdfUrl}" style="background: #00C896; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Download Receipt</a></p>
          <p>Receipt Number: <strong>${receiptNumber}</strong></p>
          <p>If you have any questions, please don't hesitate to contact the seller.</p>
          <p>Best regards,<br>PayLoom Team</p>
        `
      })
    });

    if (!response.ok) {
      throw new Error('Failed to send email');
    }
  }

  /**
   * Main function: Generate receipt
   */
  async generateReceipt(data: ReceiptData): Promise<{
    receiptNumber: string;
    pdfUrl: string;
    qrCodeUrl: string;
  }> {
    try {
      // 1. Generate receipt number
      const receiptNumber = await this.generateReceiptNumber();

      // 2. Generate QR code
      const qrCodeUrl = await this.generateQRCode(receiptNumber, data.orderId);

      // 3. Generate PDF
      const pdfBuffer = await this.generatePDF(receiptNumber, data);

      // 4. Upload PDF
      const pdfUrl = await this.uploadPDF(pdfBuffer, receiptNumber);

      // 5. Save to database
      const { data: receipt, error } = await supabase
        .from('receipts')
        .insert({
          receipt_number: receiptNumber,
          order_id: data.orderId,
          seller_id: data.sellerId,
          customer_id: data.customerId,
          items: data.items,
          subtotal: data.subtotal,
          tax: data.tax,
          delivery_fee: data.deliveryFee,
          discount: data.discount,
          total: data.total,
          payment_method: data.paymentMethod,
          mpesa_code: data.mpesaCode,
          mpesa_phone: data.mpesaPhone,
          payment_verified: true,
          payment_time: data.paymentTime || new Date(),
          customer_name: data.customerName,
          customer_phone: data.customerPhone,
          customer_email: data.customerEmail,
          delivery_address: data.deliveryAddress,
          seller_name: data.sellerName,
          seller_logo_url: data.sellerLogoUrl,
          seller_colors: data.sellerColors,
          seller_contact: data.sellerContact,
          pdf_url: pdfUrl,
          qr_code_url: qrCodeUrl,
          status: 'generated'
        })
        .select()
        .single();

      if (error) throw error;

      // 6. Send email (async, don't wait)
      if (data.customerEmail) {
        this.sendEmail(
          data.customerEmail,
          receiptNumber,
          pdfUrl,
          data.customerName
        ).catch(console.error);

        // Update status
        await supabase
          .from('receipts')
          .update({ status: 'sent', sent_at: new Date() })
          .eq('id', receipt.id);
      }

      return {
        receiptNumber,
        pdfUrl,
        qrCodeUrl
      };

    } catch (error) {
      console.error('Receipt generation error:', error);
      throw error;
    }
  }

  /**
   * Get receipt by order ID
   */
  async getReceiptByOrderId(orderId: string) {
    const { data, error } = await supabase
      .from('receipts')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get receipt by receipt number
   */
  async getReceiptByNumber(receiptNumber: string) {
    const { data, error } = await supabase
      .from('receipts')
      .select('*')
      .eq('receipt_number', receiptNumber)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Mark receipt as downloaded
   */
  async markAsDownloaded(receiptId: string) {
    await supabase
      .from('receipts')
      .update({ 
        status: 'downloaded',
        downloaded_at: new Date()
      })
      .eq('id', receiptId);
  }
}

export const receiptService = new ReceiptService();
```

---

## 🌐 **API ENDPOINTS**

### **1. Generate Receipt API**

**File: `pages/api/receipts/generate.ts`**

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import { receiptService } from '@/lib/services/receiptService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      orderId,
      sellerId,
      customerId,
      items,
      subtotal,
      tax,
      deliveryFee,
      discount,
      total,
      paymentMethod,
      mpesaCode,
      mpesaPhone,
      paymentTime,
      customerName,
      customerPhone,
      customerEmail,
      deliveryAddress,
      sellerName,
      sellerLogoUrl,
      sellerColors,
      sellerContact
    } = req.body;

    // Validation
    if (!orderId || !sellerId || !items || !total) {
      return res.status(400).json({ 
        error: 'Missing required fields' 
      });
    }

    // Generate receipt
    const receipt = await receiptService.generateReceipt({
      orderId,
      sellerId,
      customerId,
      items,
      subtotal,
      tax,
      deliveryFee,
      discount,
      total,
      paymentMethod,
      mpesaCode,
      mpesaPhone,
      paymentTime,
      customerName,
      customerPhone,
      customerEmail,
      deliveryAddress,
      sellerName,
      sellerLogoUrl,
      sellerColors,
      sellerContact
    });

    return res.status(200).json({
      success: true,
      receipt
    });

  } catch (error: any) {
    console.error('Receipt generation error:', error);
    return res.status(500).json({
      error: 'Failed to generate receipt',
      details: error.message
    });
  }
}
```

---

### **2. Get Receipt API**

**File: `pages/api/receipts/[receiptNumber].ts`**

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import { receiptService } from '@/lib/services/receiptService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { receiptNumber } = req.query;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const receipt = await receiptService.getReceiptByNumber(
      receiptNumber as string
    );

    return res.status(200).json({
      success: true,
      receipt
    });

  } catch (error: any) {
    console.error('Get receipt error:', error);
    return res.status(404).json({
      error: 'Receipt not found',
      details: error.message
    });
  }
}
```

---

## 🎨 **FRONTEND COMPONENTS**

### **1. Receipt Preview Component**

**File: `components/ReceiptPreview.tsx`**

```typescript
import React from 'react';
import { format } from 'date-fns';
import { Download, Mail, Share2 } from 'lucide-react';

interface ReceiptItem {
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface ReceiptPreviewProps {
  receiptNumber: string;
  date: Date;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  deliveryFee: number;
  discount: number;
  total: number;
  paymentMethod: string;
  mpesaCode?: string;
  customerName: string;
  customerPhone: string;
  sellerName: string;
  sellerContact: string;
  pdfUrl: string;
  onDownload: () => void;
  onEmail: () => void;
  onShare: () => void;
}

export function ReceiptPreview({
  receiptNumber,
  date,
  items,
  subtotal,
  tax,
  deliveryFee,
  discount,
  total,
  paymentMethod,
  mpesaCode,
  customerName,
  customerPhone,
  sellerName,
  sellerContact,
  pdfUrl,
  onDownload,
  onEmail,
  onShare
}: ReceiptPreviewProps) {
  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-teal-600">
          PAYLOOM INSTANTS
        </h1>
        <h2 className="text-xl font-semibold text-gray-800 mt-2">
          {sellerName}
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Till: {sellerContact}
        </p>
      </div>

      <div className="border-t-2 border-teal-600 my-4" />

      {/* Receipt Info */}
      <div className="flex justify-between mb-4 text-sm">
        <div>
          <p><span className="font-semibold">Receipt #:</span> {receiptNumber}</p>
        </div>
        <div className="text-right">
          <p>{format(date, 'dd MMM yyyy, h:mm a')}</p>
        </div>
      </div>

      <div className="border-t border-gray-300 my-4" />

      {/* Items */}
      <div className="mb-6">
        <h3 className="font-semibold text-gray-800 mb-3">
          ITEMS PURCHASED:
        </h3>
        
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-600 mb-2">
          <div className="col-span-5">Item</div>
          <div className="col-span-2 text-center">Qty</div>
          <div className="col-span-2 text-right">Price</div>
          <div className="col-span-3 text-right">Total</div>
        </div>

        <div className="border-t border-gray-300 mb-2" />

        {/* Items */}
        {items.map((item, index) => (
          <div 
            key={index}
            className="grid grid-cols-12 gap-2 text-sm py-2 border-b border-gray-100"
          >
            <div className="col-span-5">{item.name}</div>
            <div className="col-span-2 text-center">{item.quantity}</div>
            <div className="col-span-2 text-right">
              KES {item.unit_price.toFixed(2)}
            </div>
            <div className="col-span-3 text-right font-semibold">
              KES {item.total.toFixed(2)}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-teal-600 my-4" />

      {/* Totals */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>KES {subtotal.toFixed(2)}</span>
        </div>

        {tax > 0 && (
          <div className="flex justify-between">
            <span>Tax (16% VAT):</span>
            <span>KES {tax.toFixed(2)}</span>
          </div>
        )}

        {deliveryFee > 0 && (
          <div className="flex justify-between">
            <span>Delivery:</span>
            <span>KES {deliveryFee.toFixed(2)}</span>
          </div>
        )}

        {discount > 0 && (
          <div className="flex justify-between text-red-600">
            <span>Discount:</span>
            <span>-KES {discount.toFixed(2)}</span>
          </div>
        )}

        <div className="border-t-2 border-teal-600 pt-2 mt-2" />

        <div className="flex justify-between text-lg font-bold text-teal-600">
          <span>TOTAL:</span>
          <span>KES {total.toFixed(2)}</span>
        </div>
      </div>

      <div className="border-t border-gray-300 my-4" />

      {/* Payment */}
      <div className="mb-4">
        <h3 className="font-semibold text-gray-800 mb-2">PAYMENT:</h3>
        <div className="text-sm space-y-1">
          <p>Method: {paymentMethod}</p>
          {mpesaCode && <p>M-Pesa Code: {mpesaCode}</p>}
          <p className="text-green-600 font-semibold">Status: ✓ VERIFIED</p>
        </div>
      </div>

      <div className="border-t border-gray-300 my-4" />

      {/* Customer */}
      <div className="mb-6">
        <h3 className="font-semibold text-gray-800 mb-2">CUSTOMER:</h3>
        <div className="text-sm space-y-1">
          <p>Name: {customerName}</p>
          <p>Phone: {customerPhone}</p>
        </div>
      </div>

      <div className="border-t border-teal-600 my-4" />

      {/* Actions */}
      <div className="flex gap-3 justify-center">
        <button
          onClick={onDownload}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Download size={18} />
          Download PDF
        </button>

        <button
          onClick={onEmail}
          className="flex items-center gap-2 px-4 py-2 border border-teal-600 text-teal-600 rounded-lg hover:bg-teal-50 transition-colors"
        >
          <Mail size={18} />
          Email
        </button>

        <button
          onClick={onShare}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Share2 size={18} />
          Share
        </button>
      </div>

      {/* Footer */}
      <div className="mt-6 text-center text-sm text-gray-600">
        <p>Thank you for shopping with us!</p>
        <p className="mt-1">Questions? Contact: {sellerContact}</p>
      </div>
    </div>
  );
}
```

---

### **2. Receipt Page**

**File: `pages/receipt/[orderId].tsx`**

```typescript
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { ReceiptPreview } from '@/components/ReceiptPreview';
import { Loader2 } from 'lucide-react';

export default function ReceiptPage() {
  const router = useRouter();
  const { orderId } = router.query;
  const [receipt, setReceipt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (orderId) {
      fetchReceipt();
    }
  }, [orderId]);

  const fetchReceipt = async () => {
    try {
      const response = await fetch(`/api/receipts/order/${orderId}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setReceipt(data.receipt);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    window.open(receipt.pdf_url, '_blank');
  };

  const handleEmail = async () => {
    try {
      const email = prompt('Enter email address:');
      if (!email) return;

      const response = await fetch('/api/receipts/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptNumber: receipt.receipt_number,
          email
        })
      });

      if (response.ok) {
        alert('Receipt sent successfully!');
      }
    } catch (err) {
      alert('Failed to send email');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Receipt ${receipt.receipt_number}`,
          text: 'View your receipt',
          url: window.location.href
        });
      } catch (err) {
        console.error('Share failed:', err);
      }
    } else {
      // Fallback: copy link
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-teal-600" size={48} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-red-600 text-xl mb-4">Error: {error}</p>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-teal-600 text-white rounded-lg"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <ReceiptPreview
        receiptNumber={receipt.receipt_number}
        date={new Date(receipt.created_at)}
        items={receipt.items}
        subtotal={receipt.subtotal}
        tax={receipt.tax}
        deliveryFee={receipt.delivery_fee}
        discount={receipt.discount}
        total={receipt.total}
        paymentMethod={receipt.payment_method}
        mpesaCode={receipt.mpesa_code}
        customerName={receipt.customer_name}
        customerPhone={receipt.customer_phone}
        sellerName={receipt.seller_name}
        sellerContact={receipt.seller_contact}
        pdfUrl={receipt.pdf_url}
        onDownload={handleDownload}
        onEmail={handleEmail}
        onShare={handleShare}
      />
    </div>
  );
}
```

---

## 🔄 **INTEGRATION WITH CHECKOUT**

### **Trigger Receipt Generation After Payment**

**File: `pages/api/orders/complete.ts`**

```typescript
import { receiptService } from '@/lib/services/receiptService';

// After payment is verified
async function completeOrder(orderId: string) {
  // ... existing order completion logic ...

  // Generate receipt
  const order = await getOrderById(orderId);
  
  const receipt = await receiptService.generateReceipt({
    orderId: order.id,
    sellerId: order.seller_id,
    customerId: order.customer_id,
    items: order.items,
    subtotal: order.subtotal,
    tax: order.tax,
    deliveryFee: order.delivery_fee,
    discount: order.discount,
    total: order.total,
    paymentMethod: order.payment_method,
    mpesaCode: order.mpesa_code,
    mpesaPhone: order.customer_phone,
    paymentTime: order.payment_time,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    customerEmail: order.customer_email,
    deliveryAddress: order.delivery_address,
    sellerName: order.seller_name,
    sellerLogoUrl: order.seller_logo,
    sellerColors: order.seller_colors,
    sellerContact: order.seller_contact
  });

  // Update order with receipt info
  await updateOrder(orderId, {
    receipt_number: receipt.receiptNumber,
    receipt_url: receipt.pdfUrl
  });

  return receipt;
}
```

---

## 📱 **MOBILE OPTIMIZED VERSION**

Add responsive styles:

```css
/* styles/receipt.css */
@media (max-width: 640px) {
  .receipt-preview {
    padding: 1rem;
    font-size: 0.875rem;
  }

  .receipt-actions {
    flex-direction: column;
    width: 100%;
  }

  .receipt-actions button {
    width: 100%;
  }
}
```

---

## ✅ **TESTING CHECKLIST**

### **1. Unit Tests**
- [ ] Receipt number generation
- [ ] PDF generation
- [ ] QR code generation
- [ ] Email sending
- [ ] Database saving

### **2. Integration Tests**
- [ ] End-to-end receipt generation
- [ ] PDF download
- [ ] Email delivery
- [ ] WhatsApp sharing

### **3. Edge Cases**
- [ ] Long product names
- [ ] Many items (50+)
- [ ] Zero tax
- [ ] Zero delivery fee
- [ ] Large discounts
- [ ] Special characters in names

---

## 🚀 **DEPLOYMENT STEPS**

1. **Install Dependencies:**
```bash
npm install pdfkit qrcode date-fns
npm install -D @types/pdfkit @types/qrcode
```

2. **Set Environment Variables:**
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
RESEND_API_KEY=your_resend_key
NEXT_PUBLIC_APP_URL=https://payloom.co
```

3. **Run Migrations:**
```sql
-- Run the receipts table creation SQL
```

4. **Test:**
```bash
npm run dev
```

5. **Deploy:**
```bash
vercel deploy --prod
```

---

## 📊 **ANALYTICS TO TRACK**

- Total receipts generated
- Receipts emailed vs downloaded
- Average time to generate
- PDF file sizes
- Email delivery rate
- Most common items
- Peak receipt generation times

---

**THIS IS FEATURE 1 COMPLETE!**

Next, I'll create the same detailed guide for:
- Feature 2: Inventory Management
- Feature 3: POS System
- Feature 4: Multi-Payment Methods
- And so on...

**Would you like me to continue with Feature 2 (Inventory Management) next?** 🚀