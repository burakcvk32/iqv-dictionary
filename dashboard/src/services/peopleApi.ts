import { apiRoutes } from '../routes/api';
import http from '../utils/http';
import {
  PeopleListResponse,
  PeopleQuery,
  PersonCreateInput,
  PersonResponse,
  PersonUpdateInput,
} from '../interfaces/models/person';

// Centralized People (Kişi) API client — same pattern as dictionaryApi.ts.
// Reuses the shared `http` axios instance (Bearer token + 401 handling
// already wired), so no ad-hoc fetch/axios calls in the page component.
export const peopleApi = {
  list: (query: PeopleQuery) =>
    http
      .get<PeopleListResponse>(apiRoutes.people, { params: query })
      .then((res) => res.data),

  // TURN: "Personel Oluştur" -- backend'in GERÇEK create endpoint'i
  // (POST /api/v1/users, requirePermission('users.create')) zaten
  // varken yenisi İCAT EDİLMEDİ; mevcut list/update/remove ile AYNI
  // paylaşılan `http` axios instance'ı kullanılır.
  create: (payload: PersonCreateInput) =>
    http
      .post<PersonResponse>(apiRoutes.people, payload)
      .then((res) => res.data),

  update: (id: string, payload: PersonUpdateInput) =>
    http
      .patch<PersonResponse>(`${apiRoutes.people}/${id}`, payload)
      .then((res) => res.data),

  remove: (id: string) =>
    http.delete(`${apiRoutes.people}/${id}`).then((res) => res.data),
};
