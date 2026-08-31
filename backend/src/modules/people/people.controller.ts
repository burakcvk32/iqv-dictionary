import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/apiError';
import { isFullPeopleListRole } from '../../middleware/auth';
import { isValidObjectId } from '../../utils/objectId';
import { PeopleService } from './people.service';
import {
  parsePeopleListQuery,
  validatePeopleCreatePayload,
  validatePeopleUpdatePayload,
} from './people.validation';

const paginationMeta = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

export const createPeopleController = (service: PeopleService) => ({
  list: asyncHandler(async (req: Request, res: Response) => {
    const query = parsePeopleListQuery(req.query as Record<string, unknown>);

    // TURN: satir-bazli (row-level) kisitlama -- bkz. middleware/auth.ts
    // isFullPeopleListRole. Yonetici-katmani roller (superadmin/
    // companyadmin/organizationadmin/admin) mevcut davranista kalir: TUM
    // (izin verilen) kayitlari gorur. 'user' rolu -- `users.read` izni
    // acikca verilmis olsa BILE -- yalnizca KENDI kaydini gorur.
    // `scopeToUserId`, req.query/body'den DEGIL, DOGRULANMIS JWT'deki
    // req.user._id'den (sahtelenemez) doldurulur; client farkli bir id
    // GONDEREMEZ (query nesnesinde boyle bir alan zaten yok).
    const scopedQuery = isFullPeopleListRole(req.user!)
      ? query
      : { ...query, scopeToUserId: req.user?._id };

    const { data, total } = await service.list(scopedQuery);

    res.status(200).json({
      success: true,
      data,
      pagination: paginationMeta(query.page, query.limit, total),
    });
  }),

  // TURN: "Personel Oluştur" -- `update`'teki AYNI desen: gövde
  // `validatePeopleCreatePayload`'da doğrulanır (allowlist + zorunlu alan
  // kontrolü orada), oluşturan kimlik `req.body`'den DEĞİL, doğrulanmış
  // JWT'den (`req.user._id`) alınır.
  create: asyncHandler(async (req: Request, res: Response) => {
    const input = validatePeopleCreatePayload(req.body ?? {});
    const actorId =
      typeof req.user?._id === 'string' ? req.user._id : undefined;

    const record = await service.create(input, actorId);

    res.status(201).json({ success: true, data: record });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      throw ApiError.badRequest('Geçersiz kullanıcı kimliği.');
    }

    const input = validatePeopleUpdatePayload(req.body ?? {});
    // Frontend'in gonderdigi `_id`/role/permission degerlerine "kor guven"
    // duyulmaz: hangi alanlarin degistirilebilecegi zaten
    // validatePeopleUpdatePayload'da allowlist'lenir (password asla kabul
    // edilmez), islemi yapan kimlik ise req.body'den DEGIL, dogrulanmis
    // JWT'den (`req.user._id`) alinir. `req.user`'in TAMAMI (sadece id
    // degil, rol de) service katmanina gecilir ki kendi-hesabinda yetki
    // yukseltme kontrolu (bkz. people.service.ts update()) actor'un GERCEK,
    // sahtelenemez rolunu kullanabilsin.
    const actorId =
      typeof req.user?._id === 'string' ? req.user._id : undefined;

    const record = await service.update(id, input, actorId, req.user);

    res.status(200).json({ success: true, data: record });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      throw ApiError.badRequest('Geçersiz kullanıcı kimliği.');
    }

    await service.remove(id);

    res.status(200).json({ success: true, data: null });
  }),
});
