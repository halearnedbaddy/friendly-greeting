import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getInventoryDashboard,
  getInventoryLevels,
  adjustInventory,
  getInventoryAdjustments,
  getInventoryLocations,
  createInventoryLocation,
  getInventoryTransfers,
  createInventoryTransfer,
  getInventorySuppliers,
  createInventorySupplier,
  getReorderRecommendations,
  getStockAlerts,
} from '../controllers/inventoryController';

const router = Router();
router.use(authenticate);

router.get('/dashboard', getInventoryDashboard);
router.get('/levels', getInventoryLevels);
router.post('/adjust', adjustInventory);
router.get('/adjustments', getInventoryAdjustments);
router.get('/locations', getInventoryLocations);
router.post('/locations', createInventoryLocation);
router.get('/transfers', getInventoryTransfers);
router.post('/transfers', createInventoryTransfer);
router.get('/suppliers', getInventorySuppliers);
router.post('/suppliers', createInventorySupplier);
router.get('/reorder', getReorderRecommendations);
router.get('/alerts', getStockAlerts);

export default router;
