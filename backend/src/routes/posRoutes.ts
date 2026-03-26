import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  startSession,
  getCurrentSession,
  closeSession,
  getSessions,
  processSale,
  getSessionTransactions,
  searchProducts,
  scanBarcode,
} from '../controllers/posController';

const router = Router();
router.use(authenticate);

router.post('/session/start', startSession);
router.get('/session/current', getCurrentSession);
router.post('/session/close', closeSession);
router.get('/sessions', getSessions);
router.post('/sale', processSale);
router.get('/session/:sessionId/transactions', getSessionTransactions);
router.get('/products/search', searchProducts);
router.post('/scan', scanBarcode);

export default router;
