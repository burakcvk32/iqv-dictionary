export interface DictionaryItem {
  _id: string;
  english_term: string;
  turkish_term: string;
  description: string;
  group: string;
  subgroup?: string;
}

export interface DictionaryQuery {
  page: number;
  limit: number;
  search?: string;
  group?: string;
  subgroup?: string;
}

export interface DictionaryPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DictionaryListResponse {
  success: boolean;
  data: DictionaryItem[];
  pagination: DictionaryPagination;
}

export interface DictionaryStats {
  total: number;
  iqv_os_ai: number;
  industrial: number;
  subgroups: { name: string; count: number }[];
}

export interface DictionaryStatsResponse {
  success: boolean;
  data: DictionaryStats;
}

export interface DictionaryItemResponse {
  success: boolean;
  data: DictionaryItem;
}

export interface DictionarySubgroupsResponse {
  success: boolean;
  data: string[];
}

export type DictionaryFormValues = Omit<DictionaryItem, '_id'>;

export const DICTIONARY_GROUP_IQV_OS_AI = 'IQV OS AI';
export const DICTIONARY_GROUP_INDUSTRIAL = 'Endüstriyel';

export const DICTIONARY_GROUP_OPTIONS = [
  DICTIONARY_GROUP_IQV_OS_AI,
  DICTIONARY_GROUP_INDUSTRIAL,
];
