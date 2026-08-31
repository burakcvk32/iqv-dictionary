import { ApiError } from '../../utils/apiError';
import {
  DictionaryCreateInput,
  DictionaryUpdateInput,
} from './dictionary.types';

export interface FieldError {
  field: string;
  message: string;
}

const MAX_TERM_LENGTH = 200;
const MAX_GROUP_LENGTH = 100;
const MAX_SUBGROUP_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 2000;

const isBlank = (value: unknown): boolean =>
  typeof value !== 'string' || value.trim().length === 0;

const pushIfInvalid = (
  errors: FieldError[],
  condition: boolean,
  field: string,
  message: string,
): void => {
  if (condition) {
    errors.push({ field, message });
  }
};

export const validateCreatePayload = (
  body: Record<string, unknown>,
): DictionaryCreateInput => {
  const errors: FieldError[] = [];

  pushIfInvalid(
    errors,
    isBlank(body.english_term),
    'english_term',
    'İngilizce terim zorunludur.',
  );
  pushIfInvalid(
    errors,
    isBlank(body.turkish_term),
    'turkish_term',
    'Türkçe karşılık zorunludur.',
  );
  pushIfInvalid(
    errors,
    isBlank(body.description),
    'description',
    'Açıklama zorunludur.',
  );
  pushIfInvalid(errors, isBlank(body.group), 'group', 'Grup zorunludur.');

  if (
    typeof body.english_term === 'string' &&
    body.english_term.trim().length > MAX_TERM_LENGTH
  ) {
    errors.push({
      field: 'english_term',
      message: `İngilizce terim en fazla ${MAX_TERM_LENGTH} karakter olabilir.`,
    });
  }

  if (
    typeof body.turkish_term === 'string' &&
    body.turkish_term.trim().length > MAX_TERM_LENGTH
  ) {
    errors.push({
      field: 'turkish_term',
      message: `Türkçe karşılık en fazla ${MAX_TERM_LENGTH} karakter olabilir.`,
    });
  }

  if (
    typeof body.group === 'string' &&
    body.group.trim().length > MAX_GROUP_LENGTH
  ) {
    errors.push({
      field: 'group',
      message: `Grup en fazla ${MAX_GROUP_LENGTH} karakter olabilir.`,
    });
  }

  if (
    typeof body.description === 'string' &&
    body.description.trim().length > MAX_DESCRIPTION_LENGTH
  ) {
    errors.push({
      field: 'description',
      message: `Açıklama en fazla ${MAX_DESCRIPTION_LENGTH} karakter olabilir.`,
    });
  }

  if (body.subgroup !== undefined && body.subgroup !== null) {
    if (typeof body.subgroup !== 'string') {
      errors.push({ field: 'subgroup', message: 'Alt grup metin olmalıdır.' });
    } else if (body.subgroup.trim().length > MAX_SUBGROUP_LENGTH) {
      errors.push({
        field: 'subgroup',
        message: `Alt grup en fazla ${MAX_SUBGROUP_LENGTH} karakter olabilir.`,
      });
    }
  }

  if (errors.length > 0) {
    throw ApiError.unprocessable('Girilen bilgiler geçersiz.', errors);
  }

  const subgroupRaw =
    typeof body.subgroup === 'string' ? body.subgroup.trim() : undefined;

  return {
    english_term: (body.english_term as string).trim(),
    turkish_term: (body.turkish_term as string).trim(),
    description: (body.description as string).trim(),
    group: (body.group as string).trim(),
    subgroup: subgroupRaw && subgroupRaw.length > 0 ? subgroupRaw : undefined,
  };
};

export const validateUpdatePayload = (
  body: Record<string, unknown>,
): DictionaryUpdateInput => {
  const errors: FieldError[] = [];
  const result: DictionaryUpdateInput = {};

  if (body.english_term !== undefined) {
    if (isBlank(body.english_term)) {
      errors.push({
        field: 'english_term',
        message: 'İngilizce terim boş olamaz.',
      });
    } else if ((body.english_term as string).trim().length > MAX_TERM_LENGTH) {
      errors.push({
        field: 'english_term',
        message: `İngilizce terim en fazla ${MAX_TERM_LENGTH} karakter olabilir.`,
      });
    } else {
      result.english_term = (body.english_term as string).trim();
    }
  }

  if (body.turkish_term !== undefined) {
    if (isBlank(body.turkish_term)) {
      errors.push({
        field: 'turkish_term',
        message: 'Türkçe karşılık boş olamaz.',
      });
    } else if ((body.turkish_term as string).trim().length > MAX_TERM_LENGTH) {
      errors.push({
        field: 'turkish_term',
        message: `Türkçe karşılık en fazla ${MAX_TERM_LENGTH} karakter olabilir.`,
      });
    } else {
      result.turkish_term = (body.turkish_term as string).trim();
    }
  }

  if (body.description !== undefined) {
    if (isBlank(body.description)) {
      errors.push({ field: 'description', message: 'Açıklama boş olamaz.' });
    } else if (
      (body.description as string).trim().length > MAX_DESCRIPTION_LENGTH
    ) {
      errors.push({
        field: 'description',
        message: `Açıklama en fazla ${MAX_DESCRIPTION_LENGTH} karakter olabilir.`,
      });
    } else {
      result.description = (body.description as string).trim();
    }
  }

  if (body.group !== undefined) {
    if (isBlank(body.group)) {
      errors.push({ field: 'group', message: 'Grup boş olamaz.' });
    } else if ((body.group as string).trim().length > MAX_GROUP_LENGTH) {
      errors.push({
        field: 'group',
        message: `Grup en fazla ${MAX_GROUP_LENGTH} karakter olabilir.`,
      });
    } else {
      result.group = (body.group as string).trim();
    }
  }

  if (body.subgroup !== undefined) {
    if (body.subgroup === null) {
      result.subgroup = undefined;
    } else if (typeof body.subgroup !== 'string') {
      errors.push({ field: 'subgroup', message: 'Alt grup metin olmalıdır.' });
    } else if (body.subgroup.trim().length > MAX_SUBGROUP_LENGTH) {
      errors.push({
        field: 'subgroup',
        message: `Alt grup en fazla ${MAX_SUBGROUP_LENGTH} karakter olabilir.`,
      });
    } else {
      const trimmed = body.subgroup.trim();
      result.subgroup = trimmed.length > 0 ? trimmed : undefined;
    }
  }

  if (Object.keys(result).length === 0 && errors.length === 0) {
    throw ApiError.unprocessable(
      'Güncellenecek en az bir alan gönderilmelidir.',
    );
  }

  if (errors.length > 0) {
    throw ApiError.unprocessable('Girilen bilgiler geçersiz.', errors);
  }

  return result;
};

export const parseListQuery = (query: Record<string, unknown>) => {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(String(query.limit ?? '20'), 10) || 20),
  );

  const search =
    typeof query.search === 'string' && query.search.trim().length > 0
      ? query.search.trim()
      : undefined;
  const group =
    typeof query.group === 'string' && query.group.trim().length > 0
      ? query.group.trim()
      : undefined;
  const subgroup =
    typeof query.subgroup === 'string' && query.subgroup.trim().length > 0
      ? query.subgroup.trim()
      : undefined;

  return { page, limit, search, group, subgroup };
};
