import { Router } from 'express';
import { productController } from '../controllers/productController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Protect all product endpoints
router.use(authMiddleware);

// CRUD endpoints
router.get('/', productController.getProducts);
router.get('/:code', productController.getProductByCode);
router.post('/', productController.createProduct);
router.put('/:code', productController.updateProduct);
router.delete('/:code', productController.deleteProduct);

export default router;
