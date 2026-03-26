import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getReceipts,
  getReceipt,
  getReceiptHtml,
  getReceiptByOrder,
  generateReceiptFromTransaction,
  downloadReceiptPdf,
  markReceiptSent,
} from '../controllers/receiptController';

const router = Router();

router.get('/view/:id', getReceiptHtml);
router.get('/download/:id', downloadReceiptPdf);
router.get('/by-order/:orderId', getReceiptByOrder);

router.use(authenticate);
router.get('/', getReceipts);
router.post('/generate', generateReceiptFromTransaction);
router.get('/:id', getReceipt);
router.patch('/:id/sent', markReceiptSent);

export default router;
