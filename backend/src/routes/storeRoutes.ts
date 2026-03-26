import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { getMyStore, createStore, updateStore, updateStoreStatus } from '../controllers/storeController';
import { scanStore } from '../services/socialScanService';
import { prisma } from '../config/database';
import type { Request, Response } from 'express';

const router = Router();

// Seller-only routes
router.use(authenticate);
router.use(requireRole('SELLER'));

/**
 * GET /api/v1/store/me
 * Get current seller's store
 */
router.get('/me', getMyStore);

/**
 * POST /api/v1/store
 * Create store for current seller (one-time)
 */
router.post('/', createStore);

/**
 * PATCH /api/v1/store
 * Update store details (name, slug, logo, bio, visibility)
 */
router.patch('/', updateStore);

/**
 * PATCH /api/v1/store/status
 * Update store status (INACTIVE | ACTIVE | FROZEN)
 */
router.patch('/status', updateStoreStatus);

/**
 * GET /api/v1/store/readiness
 * Returns a checklist of what's required / recommended before going live
 */
router.get('/readiness', async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Authentication required' });
    const sellerId = req.user.userId;

    const [store, productCount, paymentMethod] = await Promise.all([
      prisma.store.findUnique({ where: { sellerId }, include: { socialAccounts: true } }),
      prisma.product.count({ where: { store: { sellerId }, status: 'PUBLISHED' } }),
      prisma.paymentMethod.findFirst({ where: { userId: sellerId, isActive: true } }),
    ]);

    if (!store) {
      return res.status(404).json({ success: false, error: 'Store not found' });
    }

    const checks = [
      {
        id: 'name',
        label: 'Store name set',
        done: !!store.name,
        required: true,
      },
      {
        id: 'slug',
        label: 'Store URL slug set',
        done: !!store.slug,
        required: true,
      },
      {
        id: 'logo',
        label: 'Store logo uploaded',
        done: !!store.logo,
        required: false,
      },
      {
        id: 'bio',
        label: 'Store description added',
        done: !!store.bio,
        required: false,
      },
      {
        id: 'products',
        label: 'At least 1 published product',
        done: productCount > 0,
        required: false,
        detail: `${productCount} published`,
      },
      {
        id: 'payout',
        label: 'Payout method added',
        done: !!paymentMethod,
        required: false,
        detail: paymentMethod ? 'M-Pesa connected' : 'Needed to receive payments',
      },
    ];

    const canActivate = checks.filter((c) => c.required).every((c) => c.done);

    res.json({
      success: true,
      data: {
        storeStatus: store.status,
        canActivate,
        checks,
        publishedProductCount: productCount,
      },
    });
  } catch (error) {
    console.error('Readiness check error:', error);
    res.status(500).json({ success: false, error: 'Failed to check readiness' });
  }
});

/**
 * POST /api/v1/store/rescan
 * Manually trigger rescan of all connected social pages
 */
router.post('/rescan', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Authentication required' });
    const store = await prisma.store.findUnique({ where: { sellerId: req.user.userId } });
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });
    await scanStore(store.id);
    res.json({ success: true, message: 'Rescan triggered' });
  } catch (error) {
    console.error('Manual rescan error:', error);
    res.status(500).json({ success: false, error: 'Failed to trigger rescan' });
  }
});

export default router;