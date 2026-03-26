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

export const getInventoryDashboard = async (req: Request, res: Response) => {
  try {
    const sellerId = getSellerId(req, res);
    if (!sellerId) return;
    const storeId = await getStoreId(sellerId);
    if (!storeId) return res.json({ success: true, data: { totalProducts: 0, totalValue: 0, lowStockCount: 0, outOfStockCount: 0 } });

    const [products, lowStockCount, outOfStockCount] = await Promise.all([
      prisma.product.findMany({
        where: { storeId },
        select: { stockQuantity: true, costPrice: true, sellingPrice: true, price: true, trackInventory: true },
      }),
      prisma.product.count({ where: { storeId, stockQuantity: { lte: 10, gt: 0 } } }),
      prisma.product.count({ where: { storeId, stockQuantity: { lte: 0 } } }),
    ]);

    const totalValue = products.reduce((sum, p) => {
      const cost = Number(p.costPrice ?? p.sellingPrice ?? p.price ?? 0);
      return sum + cost * p.stockQuantity;
    }, 0);

    res.json({
      success: true,
      data: {
        totalProducts: products.length,
        totalValue: Math.round(totalValue * 100) / 100,
        lowStockCount,
        outOfStockCount,
        inStockCount: products.length - lowStockCount - outOfStockCount,
      },
    });
  } catch (error) {
    console.error('Inventory dashboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch inventory dashboard' });
  }
};

export const getInventoryLevels = async (req: Request, res: Response) => {
  try {
    const sellerId = getSellerId(req, res);
    if (!sellerId) return;
    const storeId = await getStoreId(sellerId);
    if (!storeId) return res.json({ success: true, data: [] });

    const { low_stock_only, search } = req.query;

    const where: any = { storeId };
    if (low_stock_only === 'true') {
      where.stockQuantity = { lte: prisma.product.fields.lowStockThreshold ?? 10 };
    }
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { sku: { contains: search as string, mode: 'insensitive' } },
        { category: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const products = await prisma.product.findMany({
      where: { storeId, ...(low_stock_only === 'true' ? {} : {}) },
      orderBy: { stockQuantity: 'asc' },
      select: {
        id: true,
        name: true,
        sku: true,
        category: true,
        stockQuantity: true,
        lowStockThreshold: true,
        costPrice: true,
        sellingPrice: true,
        price: true,
        images: true,
        status: true,
        trackInventory: true,
        updatedAt: true,
      },
    });

    let levels = products.map(p => ({
      ...p,
      product_id: p.id,
      current_quantity: p.stockQuantity,
      threshold: p.lowStockThreshold,
      selling_price: Number(p.sellingPrice ?? p.price ?? 0),
      cost_price: Number(p.costPrice ?? 0),
      stock_status:
        p.stockQuantity <= 0 ? 'out_of_stock' :
        p.stockQuantity <= p.lowStockThreshold ? 'low_stock' : 'in_stock',
    }));

    if (low_stock_only === 'true') {
      levels = levels.filter(l => l.stock_status !== 'in_stock');
    }

    if (search) {
      const q = (search as string).toLowerCase();
      levels = levels.filter(l =>
        l.name.toLowerCase().includes(q) ||
        (l.sku ?? '').toLowerCase().includes(q) ||
        (l.category ?? '').toLowerCase().includes(q)
      );
    }

    res.json({ success: true, data: levels });
  } catch (error) {
    console.error('Inventory levels error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch inventory levels' });
  }
};

export const adjustInventory = async (req: Request, res: Response) => {
  try {
    const sellerId = getSellerId(req, res);
    if (!sellerId) return;
    const storeId = await getStoreId(sellerId);
    if (!storeId) return res.status(404).json({ success: false, error: 'Store not found' });

    const { product_id, quantity_change, adjustment_type = 'adjustment', reason, notes } = req.body;

    if (!product_id || quantity_change === undefined) {
      return res.status(400).json({ success: false, error: 'product_id and quantity_change are required' });
    }

    const qty = parseInt(quantity_change);
    if (isNaN(qty)) return res.status(400).json({ success: false, error: 'quantity_change must be a number' });

    const product = await prisma.product.findFirst({ where: { id: product_id, storeId } });
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });

    const previousQty = product.stockQuantity;
    const newQty = previousQty + qty;

    if (newQty < 0 && !product.allowBackorder) {
      return res.status(400).json({ success: false, error: 'Insufficient stock' });
    }

    const [updated, tx] = await prisma.$transaction([
      prisma.product.update({
        where: { id: product_id },
        data: { stockQuantity: newQty, updatedAt: new Date() },
      }),
      prisma.inventoryTransaction.create({
        data: {
          productId: product_id,
          storeId,
          type: adjustment_type,
          quantity: qty,
          previousQty,
          newQty,
          reason: reason ?? null,
          notes: notes ?? null,
          performedBy: sellerId,
        },
      }),
    ]);

    if (newQty <= product.lowStockThreshold && newQty > 0) {
      await prisma.stockAlert.upsert({
        where: { id: `${product_id}-low` },
        update: { currentQuantity: newQty, status: 'pending' },
        create: {
          id: `${product_id}-low`,
          productId: product_id,
          storeId,
          alertType: 'low_stock',
          currentQuantity: newQty,
          thresholdQuantity: product.lowStockThreshold,
        },
      });
    } else if (newQty <= 0) {
      await prisma.stockAlert.upsert({
        where: { id: `${product_id}-out` },
        update: { currentQuantity: newQty, status: 'pending' },
        create: {
          id: `${product_id}-out`,
          productId: product_id,
          storeId,
          alertType: 'out_of_stock',
          currentQuantity: newQty,
          thresholdQuantity: 0,
        },
      });
    }

    res.json({ success: true, data: { product: updated, transaction: tx } });
  } catch (error) {
    console.error('Adjust inventory error:', error);
    res.status(500).json({ success: false, error: 'Failed to adjust inventory' });
  }
};

export const getInventoryAdjustments = async (req: Request, res: Response) => {
  try {
    const sellerId = getSellerId(req, res);
    if (!sellerId) return;
    const storeId = await getStoreId(sellerId);
    if (!storeId) return res.json({ success: true, data: [] });

    const adjustments = await prisma.inventoryTransaction.findMany({
      where: { storeId },
      include: { product: { select: { name: true, sku: true, images: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({ success: true, data: adjustments });
  } catch (error) {
    console.error('Get adjustments error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch adjustments' });
  }
};

export const getInventoryLocations = async (req: Request, res: Response) => {
  try {
    const sellerId = getSellerId(req, res);
    if (!sellerId) return;
    const storeId = await getStoreId(sellerId);

    res.json({
      success: true,
      data: [
        { id: 1, name: 'Main Location', code: 'MAIN', is_default: true, city: '', country: 'KE', location_type: 'warehouse' }
      ]
    });
  } catch (error) {
    console.error('Get locations error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch locations' });
  }
};

export const createInventoryLocation = async (req: Request, res: Response) => {
  try {
    const sellerId = getSellerId(req, res);
    if (!sellerId) return;

    res.status(201).json({
      success: true,
      data: { id: Date.now(), ...req.body, createdAt: new Date() },
    });
  } catch (error) {
    console.error('Create location error:', error);
    res.status(500).json({ success: false, error: 'Failed to create location' });
  }
};

export const getInventoryTransfers = async (req: Request, res: Response) => {
  res.json({ success: true, data: [] });
};

export const createInventoryTransfer = async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: { id: crypto.randomUUID(), ...req.body, status: 'pending', createdAt: new Date() } });
};

export const getInventorySuppliers = async (req: Request, res: Response) => {
  res.json({ success: true, data: [] });
};

export const createInventorySupplier = async (req: Request, res: Response) => {
  res.status(201).json({ success: true, data: { id: crypto.randomUUID(), ...req.body, createdAt: new Date() } });
};

export const getReorderRecommendations = async (req: Request, res: Response) => {
  try {
    const sellerId = getSellerId(req, res);
    if (!sellerId) return;
    const storeId = await getStoreId(sellerId);
    if (!storeId) return res.json({ success: true, data: [] });

    const lowStock = await prisma.product.findMany({
      where: { storeId, stockQuantity: { lte: 10 } },
      select: { id: true, name: true, sku: true, stockQuantity: true, lowStockThreshold: true, images: true },
      orderBy: { stockQuantity: 'asc' },
      take: 50,
    });

    const recommendations = lowStock.map(p => ({
      product_id: p.id,
      product_name: p.name,
      sku: p.sku,
      current_quantity: p.stockQuantity,
      reorder_quantity: Math.max(p.lowStockThreshold * 3, 50),
      priority: p.stockQuantity <= 0 ? 'critical' : 'high',
      images: p.images,
    }));

    res.json({ success: true, data: recommendations });
  } catch (error) {
    console.error('Reorder recommendations error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch reorder recommendations' });
  }
};

export const getStockAlerts = async (req: Request, res: Response) => {
  try {
    const sellerId = getSellerId(req, res);
    if (!sellerId) return;
    const storeId = await getStoreId(sellerId);
    if (!storeId) return res.json({ success: true, data: [] });

    const alerts = await prisma.stockAlert.findMany({
      where: { storeId, status: { in: ['pending', 'sent'] } },
      include: { product: { select: { name: true, sku: true, images: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: alerts });
  } catch (error) {
    console.error('Stock alerts error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stock alerts' });
  }
};
