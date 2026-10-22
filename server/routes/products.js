import { Router } from 'express';
import { asyncHandler, parseOrThrow } from '../lib/errors.js';
import { createProductSchema, updateProductSchema } from '../lib/validators.js';
import { authRequired, requireAdmin, requirePasswordChanged } from '../middleware/auth.js';
import {
  createProduct,
  deleteProduct,
  listProductOptions,
  listProducts,
  updateProduct,
} from '../services/products.js';

const router = Router();

router.use(authRequired, requirePasswordChanged);

router.get('/options', (req, res) => {
  res.json({ items: listProductOptions() });
});

router.get('/', (req, res) => {
  res.json(listProducts(req.query));
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = parseOrThrow(createProductSchema, req.body);
    const product = createProduct(data, req.user, req.ip);
    res.status(201).json(product);
  }),
);

router.patch('/:id', (req, res) => {
  const data = parseOrThrow(updateProductSchema, req.body);
  const product = updateProduct(Number(req.params.id), data, req.user, req.ip);
  res.json(product);
});

router.delete('/:id', requireAdmin, (req, res) => {
  const result = deleteProduct(Number(req.params.id), req.user, req.ip);
  res.json(result);
});

export default router;
