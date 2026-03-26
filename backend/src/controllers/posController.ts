import { Request, Response } from 'express';
import { prisma } from '../config/database';

function getSellerId(req: Request, res: Response): string | null {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return null;
  }
  return req.user.userId;
}

async function getStoreId(sellerId: string): Promise<string | null> {
  const store = await prisma.store.findUnique({ where: { sellerId }, select: { id: true } });
  return store?.id ?? null;
}

async function generateSessionNumber(storeId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.posSession.count({ where: { storeId } });
  return `SES-${year}-${String(count + 1).padStart(6, '0')}`;
}

async function generateTransactionNumber(storeId: string): Promise<string> {
  const count = await prisma.posTransaction.count({ where: { storeId } });
  const year = new Date().getFullYear();
  return `TXN-${year}-${String(count + 1).padStart(8, '0')}`;
}

async function generateReceiptNumber(storeId: string): Promise<string> {
  const count = await prisma.receipt.count({ where: { storeId } });
  const year = new Date().getFullYear();
  return `PL-${year}-${String(count + 1).padStart(6, '0')}`;
}

export const startSession = async (req: Request, res: Response) => {
  try {
    const sellerId = getSellerId(req, res);
    if (!sellerId) return;
    const storeId = await getStoreId(sellerId);
    if (!storeId) return res.status(404).json({ success: false, error: 'Store not found' });

    const { openingCash = 0, notes } = req.body;

    const existing = await prisma.posSession.findFirst({
      where: { storeId, cashierId: sellerId, status: 'open' },
    });
    if (existing) {
      return res.json({ success: true, data: existing, message: 'Returning existing open session' });
    }

    const sessionNumber = await generateSessionNumber(storeId);

    const session = await prisma.posSession.create({
      data: {
        storeId,
        cashierId: sellerId,
        sessionNumber,
        openingCash,
        openingNotes: notes ?? null,
        status: 'open',
      },
    });

    await prisma.cashDrawerMovement.create({
      data: {
        sessionId: session.id,
        storeId,
        cashierId: sellerId,
        type: 'opening',
        amount: openingCash,
        reason: 'Session opening float',
      },
    });

    res.status(201).json({ success: true, data: session });
  } catch (error) {
    console.error('Start session error:', error);
    res.status(500).json({ success: false, error: 'Failed to start session' });
  }
};

export const getCurrentSession = async (req: Request, res: Response) => {
  try {
    const sellerId = getSellerId(req, res);
    if (!sellerId) return;
    const storeId = await getStoreId(sellerId);
    if (!storeId) return res.json({ success: true, data: null });

    const session = await prisma.posSession.findFirst({
      where: { storeId, cashierId: sellerId, status: 'open' },
      include: { transactions: { take: 5, orderBy: { createdAt: 'desc' } } },
    });

    res.json({ success: true, data: session });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ success: false, error: 'Failed to get session' });
  }
};

export const closeSession = async (req: Request, res: Response) => {
  try {
    const sellerId = getSellerId(req, res);
    if (!sellerId) return;
    const { sessionId, closingCash = 0, notes } = req.body;

    const session = await prisma.posSession.findUnique({ where: { id: sessionId } });
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
    if (session.cashierId !== sellerId) return res.status(403).json({ success: false, error: 'Unauthorized' });

    const expectedCash = Number(session.openingCash) + Number(session.cashSales);
    const cashDiff = closingCash - expectedCash;

    const updated = await prisma.posSession.update({
      where: { id: sessionId },
      data: {
        status: 'closed',
        closingCash,
        expectedCash,
        cashDifference: cashDiff,
        closedAt: new Date(),
        closingNotes: notes ?? null,
      },
    });

    await prisma.cashDrawerMovement.create({
      data: {
        sessionId,
        storeId: session.storeId,
        cashierId: sellerId,
        type: 'closing',
        amount: closingCash,
        reason: 'Session closing',
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Close session error:', error);
    res.status(500).json({ success: false, error: 'Failed to close session' });
  }
};

export const getSessions = async (req: Request, res: Response) => {
  try {
    const sellerId = getSellerId(req, res);
    if (!sellerId) return;
    const storeId = await getStoreId(sellerId);
    if (!storeId) return res.json({ success: true, data: [] });

    const sessions = await prisma.posSession.findMany({
      where: { storeId },
      include: { _count: { select: { transactions: true } } },
      orderBy: { openedAt: 'desc' },
      take: 50,
    });

    res.json({ success: true, data: sessions });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sessions' });
  }
};

export const processSale = async (req: Request, res: Response) => {
  try {
    const sellerId = getSellerId(req, res);
    if (!sellerId) return;
    const storeId = await getStoreId(sellerId);
    if (!storeId) return res.status(404).json({ success: false, error: 'Store not found' });

    const {
      sessionId,
      items,
      paymentMethod = 'cash',
      paymentDetails = {},
      customerName,
      customerPhone,
      customerEmail,
      discount = 0,
    } = req.body;

    if (!sessionId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'sessionId and items are required' });
    }

    const session = await prisma.posSession.findUnique({ where: { id: sessionId } });
    if (!session || session.status !== 'open') {
      return res.status(400).json({ success: false, error: 'No open session found' });
    }

    const subtotal = items.reduce((sum: number, item: any) => sum + item.quantity * item.unit_price, 0);
    const tax = subtotal * 0.16;
    const discountAmt = Number(discount);
    const total = subtotal + tax - discountAmt;

    const transactionNumber = await generateTransactionNumber(storeId);
    const receiptNumber = await generateReceiptNumber(storeId);

    const [posTx] = await prisma.$transaction(async (tx) => {
      const posTx = await tx.posTransaction.create({
        data: {
          sessionId,
          storeId,
          cashierId: sellerId,
          transactionNumber,
          subtotal,
          tax,
          discount: discountAmt,
          total,
          paymentMethod,
          paymentDetails,
          amountTendered: paymentDetails.amount_tendered ?? null,
          changeGiven: paymentDetails.change_given ?? null,
          customerName: customerName ?? null,
          customerPhone: customerPhone ?? null,
          customerEmail: customerEmail ?? null,
          status: 'completed',
          receiptNumber,
          items: {
            create: items.map((item: any) => ({
              productId: item.product_id ?? null,
              name: item.name,
              sku: item.sku ?? null,
              quantity: item.quantity,
              unitPrice: item.unit_price,
              discount: item.discount ?? 0,
              total: item.quantity * item.unit_price - (item.discount ?? 0),
            })),
          },
        },
        include: { items: true },
      });

      await tx.receipt.create({
        data: {
          receiptNumber,
          storeId,
          posTransactionId: posTx.id,
          items,
          subtotal,
          tax,
          discount: discountAmt,
          total,
          paymentMethod,
          mpesaCode: paymentDetails.mpesa_code ?? null,
          mpesaPhone: customerPhone ?? null,
          paymentVerified: true,
          paymentTime: new Date(),
          customerName: customerName ?? null,
          customerPhone: customerPhone ?? null,
          customerEmail: customerEmail ?? null,
          status: 'generated',
        },
      });

      for (const item of items) {
        if (!item.product_id) continue;
        const product = await tx.product.findUnique({ where: { id: item.product_id }, select: { stockQuantity: true, trackInventory: true } });
        if (!product || !product.trackInventory) continue;
        const newQty = product.stockQuantity - item.quantity;
        await tx.product.update({ where: { id: item.product_id }, data: { stockQuantity: Math.max(0, newQty) } });
        await tx.inventoryTransaction.create({
          data: {
            productId: item.product_id,
            storeId,
            type: 'sale',
            quantity: -item.quantity,
            previousQty: product.stockQuantity,
            newQty: Math.max(0, newQty),
            orderId: posTx.id,
            reason: `POS Sale ${transactionNumber}`,
          },
        });
      }

      const mpesaAmt = paymentMethod === 'mpesa' ? total : (paymentDetails.mpesa_amount ?? 0);
      const cashAmt = paymentMethod === 'cash' ? total : (paymentDetails.cash_amount ?? 0);
      const cardAmt = paymentMethod === 'card' ? total : (paymentDetails.card_amount ?? 0);

      await tx.posSession.update({
        where: { id: sessionId },
        data: {
          totalSales: { increment: total },
          totalTransactions: { increment: 1 },
          cashSales: { increment: cashAmt },
          mpesaSales: { increment: mpesaAmt },
          cardSales: { increment: cardAmt },
        },
      });

      if (cashAmt > 0) {
        await tx.cashDrawerMovement.create({
          data: {
            sessionId,
            storeId,
            cashierId: sellerId,
            type: 'sale',
            amount: cashAmt,
            transactionId: posTx.id,
            reason: `Sale ${transactionNumber}`,
          },
        });
      }

      return [posTx];
    });

    res.status(201).json({
      success: true,
      data: {
        transaction: posTx,
        receiptNumber,
        transactionNumber,
      },
    });
  } catch (error) {
    console.error('Process sale error:', error);
    res.status(500).json({ success: false, error: 'Failed to process sale' });
  }
};

export const getSessionTransactions = async (req: Request, res: Response) => {
  try {
    const sellerId = getSellerId(req, res);
    if (!sellerId) return;
    const { sessionId } = req.params;

    const transactions = await prisma.posTransaction.findMany({
      where: { sessionId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error('Get session transactions error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch transactions' });
  }
};

export const searchProducts = async (req: Request, res: Response) => {
  try {
    const sellerId = getSellerId(req, res);
    if (!sellerId) return;
    const storeId = await getStoreId(sellerId);
    if (!storeId) return res.json({ success: true, data: [] });

    const { q } = req.query;
    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.json({ success: true, data: [] });
    }

    const products = await prisma.product.findMany({
      where: {
        storeId,
        status: 'PUBLISHED',
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
          { barcode: { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        sku: true,
        category: true,
        sellingPrice: true,
        price: true,
        stockQuantity: true,
        images: true,
        allowBackorder: true,
      },
      take: 20,
    });

    const results = products.map(p => ({
      ...p,
      selling_price: Number(p.sellingPrice ?? p.price ?? 0),
      stock_quantity: p.stockQuantity,
    }));

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('POS search products error:', error);
    res.status(500).json({ success: false, error: 'Failed to search products' });
  }
};

export const scanBarcode = async (req: Request, res: Response) => {
  try {
    const sellerId = getSellerId(req, res);
    if (!sellerId) return;
    const storeId = await getStoreId(sellerId);
    if (!storeId) return res.status(404).json({ success: false, error: 'Store not found' });

    const { barcode } = req.body;
    if (!barcode) return res.status(400).json({ success: false, error: 'barcode required' });

    const product = await prisma.product.findFirst({
      where: { storeId, OR: [{ barcode }, { sku: barcode }] },
      select: {
        id: true,
        name: true,
        sku: true,
        sellingPrice: true,
        price: true,
        stockQuantity: true,
        images: true,
      },
    });

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.json({
      success: true,
      data: { ...product, selling_price: Number(product.sellingPrice ?? product.price ?? 0) },
    });
  } catch (error) {
    console.error('Barcode scan error:', error);
    res.status(500).json({ success: false, error: 'Failed to scan barcode' });
  }
};
