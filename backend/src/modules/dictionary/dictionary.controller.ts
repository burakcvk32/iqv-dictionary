import { Request, Response } from 'express';
import { ApiError } from '../../utils/apiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { isValidObjectId } from '../../utils/objectId';
import { DictionaryService } from './dictionary.service';
import {
  parseListQuery,
  validateCreatePayload,
  validateUpdatePayload,
} from './dictionary.validation';

const paginationMeta = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

export const createDictionaryController = (service: DictionaryService) => ({
  list: asyncHandler(async (req: Request, res: Response) => {
    const query = parseListQuery(req.query as Record<string, unknown>);
    const { data, total } = await service.list(query);

    res.status(200).json({
      success: true,
      data,
      pagination: paginationMeta(query.page, query.limit, total),
    });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      throw ApiError.badRequest('Geçersiz kayıt kimliği.');
    }

    const record = await service.getById(id);
    res.status(200).json({ success: true, data: record });
  }),

  stats: asyncHandler(async (_req: Request, res: Response) => {
    const stats = await service.stats();
    res.status(200).json({ success: true, data: stats });
  }),

  subgroups: asyncHandler(async (req: Request, res: Response) => {
    const group = typeof req.query.group === 'string' ? req.query.group : '';
    if (!group) {
      throw ApiError.badRequest('group parametresi zorunludur.');
    }

    const subgroups = await service.subgroupsForGroup(group);
    res.status(200).json({ success: true, data: subgroups });
  }),

  // TURN: created_by -- oluşturan kimlik `req.body`'den DEĞİL, doğrulanmış
  // JWT'den (`req.user._id`) alınır -- people.controller.ts create() ile
  // AYNI desen. Client'in gövdede göndermeye çalıştığı herhangi bir
  // created_by/created_at/updated_at zaten validateCreatePayload'da
  // (dictionary.validation.ts) okunmaz/yok sayılır; buradaki `actorId`
  // frontend payload'ından TAMAMEN bağımsız, tek gerçek kaynaktır.
  create: asyncHandler(async (req: Request, res: Response) => {
    const input = validateCreatePayload(req.body ?? {});
    const actorId =
      typeof req.user?._id === 'string' ? req.user._id : undefined;

    const record = await service.create(input, actorId);

    res.status(201).json({ success: true, data: record });
  }),

  // TURN: updated_by_id -- güncelleyen kimlik `req.body`'den DEĞİL,
  // doğrulanmış JWT'den (`req.user._id`) alınır -- create() ile AYNI desen
  // (people.controller.ts update() ile de tutarlı). Client'in gövdede
  // göndermeye çalıştığı herhangi bir created_by_id/updated_by_id/
  // created_at/updated_at zaten validateUpdatePayload'da
  // (dictionary.validation.ts) okunmaz/yok sayılır.
  update: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      throw ApiError.badRequest('Geçersiz kayıt kimliği.');
    }

    const input = validateUpdatePayload(req.body ?? {});
    const actorId =
      typeof req.user?._id === 'string' ? req.user._id : undefined;

    const record = await service.update(id, input, actorId);

    res.status(200).json({ success: true, data: record });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      throw ApiError.badRequest('Geçersiz kayıt kimliği.');
    }

    await service.remove(id);

    res.status(200).json({ success: true, data: null });
  }),
});
