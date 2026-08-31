import { apiRoutes } from '../routes/api';
import http from '../utils/http';
import {
  DictionaryFormValues,
  DictionaryItemResponse,
  DictionaryListResponse,
  DictionaryQuery,
  DictionaryStatsResponse,
  DictionarySubgroupsResponse,
} from '../interfaces/models/dictionary';

// Centralized Dictionary API client. All Dictionary HTTP calls go through
// here (reusing the shared `http` axios instance, which already attaches
// the dashboard's Bearer token and handles 401 via its interceptors) so no
// page makes ad-hoc fetch()/axios calls of its own.
export const dictionaryApi = {
  list: (query: DictionaryQuery) =>
    http
      .get<DictionaryListResponse>(apiRoutes.dictionary, { params: query })
      .then((res) => res.data),

  getById: (id: string) =>
    http
      .get<DictionaryItemResponse>(`${apiRoutes.dictionary}/${id}`)
      .then((res) => res.data),

  stats: () =>
    http
      .get<DictionaryStatsResponse>(apiRoutes.dictionaryStats)
      .then((res) => res.data),

  subgroups: (group: string) =>
    http
      .get<DictionarySubgroupsResponse>(apiRoutes.dictionarySubgroups, {
        params: { group },
      })
      .then((res) => res.data),

  create: (payload: DictionaryFormValues) =>
    http
      .post<DictionaryItemResponse>(apiRoutes.dictionary, payload)
      .then((res) => res.data),

  update: (id: string, payload: Partial<DictionaryFormValues>) =>
    http
      .put<DictionaryItemResponse>(`${apiRoutes.dictionary}/${id}`, payload)
      .then((res) => res.data),

  remove: (id: string) =>
    http.delete(`${apiRoutes.dictionary}/${id}`).then((res) => res.data),
};
