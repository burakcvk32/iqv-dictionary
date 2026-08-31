import { Router } from 'express';
import { createAuthMiddleware } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { DictionaryService } from '../modules/dictionary/dictionary.service';
import {
  parseListQuery,
  validateCreatePayload,
} from '../modules/dictionary/dictionary.validation';

/**
 * Compatibility layer for the old Node-RED endpoints (POST /list-dictionary,
 * POST /create-dictionary). Kept only so existing external consumers do not
 * break; both delegate to the exact same DictionaryService used by the new
 * /api/v1/dictionary routes — there is no second business-logic
 * implementation. New integrations should use /api/v1/dictionary instead.
 */
export const createLegacyDictionaryRouter = (
  service: DictionaryService,
  jwtSecret: string,
): Router => {
  const router = Router();
  const authenticate = createAuthMiddleware(jwtSecret);

  router.post(
    '/list-dictionary',
    authenticate,
    asyncHandler(async (req, res) => {
      const query = parseListQuery((req.body ?? {}) as Record<string, unknown>);
      const { data, total } = await service.list(query);

      res.status(200).json({
        success: true,
        data,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.limit)),
        },
      });
    }),
  );

  router.post(
    '/create-dictionary',
    authenticate,
    asyncHandler(async (req, res) => {
      const input = validateCreatePayload(
        (req.body ?? {}) as Record<string, unknown>,
      );
      const record = await service.create(input);
      res.status(201).json({ success: true, data: record });
    }),
  );

  return router;
};
