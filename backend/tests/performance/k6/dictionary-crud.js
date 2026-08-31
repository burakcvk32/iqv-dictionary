import http from 'k6/http';
import { check, sleep } from 'k6';

// KOK NEDEN / ONEMLI: gorev tanimi (madde 31-32) CRUD yuk testinde
// DUSUK concurrency istiyor ve `K6_` on ekli veri + TEMIZLIK zorunlu
// kiliyor. Bu script HER ITERASYONDA: create -> update -> delete yapar --
// hicbir K6_ kaydi arkada BIRAKILMAZ (delete cagrisi basarisiz olsa bile
// check() bunu GORUNUR sekilde raporlar, sessizce yutulmaz).
const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:4001';
const USERNAME = __ENV.K6_ADMIN_USERNAME || 'K6_perf_admin';
const PASSWORD = __ENV.K6_ADMIN_PASSWORD || 'K6_Perf_Test_Pass_2026!';

export const options = {
  scenarios: {
    default: {
      executor: 'shared-iterations',
      vus: Number(__ENV.VUS || 2),
      iterations: Number(__ENV.ITERATIONS || 20),
      maxDuration: __ENV.MAX_DURATION || '60s',
    },
  },
};

export function setup() {
  const res = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ username: USERNAME, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  const token = JSON.parse(res.body).token;
  return { token };
}

export default function (data) {
  const headers = {
    Authorization: `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };
  const uniqueSuffix = `${__VU}_${__ITER}_${Date.now()}`;

  const createRes = http.post(
    `${BASE_URL}/api/v1/dictionary`,
    JSON.stringify({
      english_term: `K6_CRUD_EN_${uniqueSuffix}`,
      turkish_term: `K6_CRUD_TR_${uniqueSuffix}`,
      description: 'k6 dictionary-crud.js tarafindan uretildi',
      group: 'IQV OS AI',
    }),
    { headers },
  );
  const createOk = check(createRes, {
    'create status 201': (r) => r.status === 201,
  });
  if (!createOk) {
    sleep(0.2);
    return;
  }
  const created = JSON.parse(createRes.body).data;

  const updateRes = http.put(
    `${BASE_URL}/api/v1/dictionary/${created._id}`,
    JSON.stringify({ description: 'k6 dictionary-crud.js GUNCELLENDI' }),
    { headers },
  );
  check(updateRes, { 'update status 200': (r) => r.status === 200 });

  const deleteRes = http.del(`${BASE_URL}/api/v1/dictionary/${created._id}`, null, { headers });
  check(deleteRes, {
    'K6_ kaydi temizlendi (delete status 200/204)': (r) =>
      r.status === 200 || r.status === 204,
  });

  sleep(0.3);
}
