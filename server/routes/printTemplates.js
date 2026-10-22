import { Router } from 'express';
import { asyncHandler, parseOrThrow } from '../lib/errors.js';
import {
  createPrintTemplateSchema,
  updatePrintTemplateSchema,
} from '../lib/validators.js';
import { authRequired, requirePasswordChanged } from '../middleware/auth.js';
import {
  createPrintTemplate,
  deletePrintTemplate,
  listPrintTemplates,
  updatePrintTemplate,
} from '../services/printTemplates.js';

const router = Router();

router.use(authRequired, requirePasswordChanged);

router.get('/', (req, res) => {
  res.json({ items: listPrintTemplates() });
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = parseOrThrow(createPrintTemplateSchema, req.body);
    const template = createPrintTemplate(data, req.user, req.ip);
    res.status(201).json(template);
  }),
);

router.patch('/:id', (req, res) => {
  const data = parseOrThrow(updatePrintTemplateSchema, req.body);
  const template = updatePrintTemplate(Number(req.params.id), data, req.user, req.ip);
  res.json(template);
});

router.delete('/:id', (req, res) => {
  const result = deletePrintTemplate(Number(req.params.id), req.user, req.ip);
  res.json(result);
});

export default router;
