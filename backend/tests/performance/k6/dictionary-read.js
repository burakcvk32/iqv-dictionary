import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:4001';
const USERNAME = __ENV.K6_ADMIN_USERNAME || 'K6_perf_admin';
const PASSWORD = __ENV.K6_ADMIN_PASSWORD || 'K6_Perf_Test_Pass_2026!';

export const options = {
  scenarios: {
    default: {
      executor: 'shared-iterations',
      vus: Number(__ENV.VUS || 5),
      iterations: Number(__ENV.ITERATIONS || 50),
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

const SUBGROUPS = [
  'Üretim',
  'Bakım',
  'Kalite',
  'Enerji ve Sürdürülebilirlik',
];

export default function (data) {
  const headers = { Authorization: `Bearer ${data.token}` };
  const page = 1 + (__ITER % 10);

  // 1) sayfali liste
  const listRes = http.get(
    `${BASE_URL}/api/v1/dictionary?page=${page}&limit=20`,
    { headers },
  );
  check(listRes, {
    'list status is 200 or 429': (r) => r.status === 200 || r.status === 429,
  });

  // 2) arama
  const searchRes = http.get(
    `${BASE_URL}/api/v1/dictionary?search=K6_Term_EN_1&page=1&limit=20`,
    { headers },
  );
  check(searchRes, {
    'search status is 200 or 429': (r) => r.status === 200 || r.status === 429,
  });

  // 3) grup+alt grup filtresi (Endustriyel alt grup senaryosu)
  const subgroup = SUBGROUPS[__ITER % SUBGROUPS.length];
  const filterRes = http.get(
    `${BASE_URL}/api/v1/dictionary?group=${encodeURIComponent('Endüstriyel')}&subgroup=${encodeURIComponent(subgroup)}&page=1&limit=20`,
    { headers },
  );
  check(filterRes, {
    'subgroup filter status is 200 or 429': (r) => r.status === 200 || r.status === 429,
  });

  // 4) istatistikler
  const statsRes = http.get(`${BASE_URL}/api/v1/dictionary/stats`, { headers });
  check(statsRes, {
    'stats status is 200 or 429': (r) => r.status === 200 || r.status === 429,
  });

  sleep(0.2);
}
