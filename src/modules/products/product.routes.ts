import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { env } from '../../config/env';
import { authenticate, authorize } from '../auth/auth.middleware';
import { UserRole } from '../auth/auth.types';
import { publicLimiter } from '../../shared/middleware/rateLimiter';
import {
  createProductValidators,
  mongoIdParam,
  paginationQueryValidators,
  categoryQueryValidator,
  validate,
} from '../../shared/utils/validators';
import { body, query } from 'express-validator';
import {
  getAllProductsHandler,
  getProductByIdHandler,
  getNewCollectionHandler,
  getPopularInCategoryHandler,
  createProductHandler,
  updateProductHandler,
  deleteProductHandler,
  uploadImageHandler,
} from './product.controller';

const router = Router();

// ── Multer config ─────────────────────────────────────────────────────────────
const uploadDir = path.join(process.cwd(), env.upload.dir);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeName = `product_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, safeName);
  },
});

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.upload.maxFileSizeMb * 1024 * 1024 },
});

// ── Update validators (all fields optional) ──────────────────────────────────
const updateProductValidators = [
  body('name').optional().trim().notEmpty().isLength({ max: 200 }),
  body('category').optional().trim().notEmpty(),
  body('new_price').optional().isFloat({ min: 0 }),
  body('old_price').optional().isFloat({ min: 0 }),
  body('available').optional().isBoolean(),
];

// ── Public routes ─────────────────────────────────────────────────────────────

/**
 * @route  GET /api/products
 * @access Public
 */
router.get(
  '/',
  publicLimiter,
  paginationQueryValidators,
  categoryQueryValidator,
  query('minPrice').optional().isFloat({ min: 0 }).withMessage('minPrice must be a non-negative number'),
  query('maxPrice').optional().isFloat({ min: 0 }).withMessage('maxPrice must be a non-negative number'),
  validate,
  getAllProductsHandler,
);

/**
 * @route  GET /api/products/new-collection
 * @access Public
 */
router.get('/new-collection', publicLimiter, getNewCollectionHandler);

/**
 * @route  GET /api/products/popular/:category
 * @access Public
 */
router.get('/popular/:category', publicLimiter, getPopularInCategoryHandler);

/**
 * @route  GET /api/products/:id
 * @access Public
 */
router.get('/:id', publicLimiter, mongoIdParam('id'), validate, getProductByIdHandler);

// ── Admin-only routes ─────────────────────────────────────────────────────────

/**
 * @route  POST /api/products/upload
 * @access Admin
 */
router.post(
  '/upload',
  authenticate,
  authorize(UserRole.ADMIN),
  upload.single('product'),
  uploadImageHandler,
);

/**
 * @route  POST /api/products
 * @access Admin
 */
router.post(
  '/',
  authenticate,
  authorize(UserRole.ADMIN),
  createProductValidators,
  validate,
  createProductHandler,
);

/**
 * @route  PATCH /api/products/:id
 * @access Admin
 */
router.patch(
  '/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  mongoIdParam('id'),
  updateProductValidators,
  validate,
  updateProductHandler,
);

/**
 * @route  DELETE /api/products/:id
 * @access Admin
 */
router.delete(
  '/:id',
  authenticate,
  authorize(UserRole.ADMIN),
  mongoIdParam('id'),
  validate,
  deleteProductHandler,
);

export { router as productRouter };