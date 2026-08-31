import http from 'k6/http';
import { check, sleep } from 'k6';

// Karma yuk: cogunluk okuma (dictionary list/search/stats), az miktarda
// personel okumasi -- gorev tanimi (madde 31) geregi ana yuk okuma
// uclarinda, personel/CRUD DUSUK yogunlukta kalir.
const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:4001';
const USERNAME = __ENV.K6_ADMIN_USERNAME || 'K6_perf_admin';
const PASSWORD = __ENV.K6_ADMIN_PASSWORD || 'K6_Perf_Test_Pass_2026!';

export const options = {
  scenarios: {
    default: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: JSON.parse(
        __ENV.STAGES ||
          '[{"duration":"10s","target":10},{"duration":"20s","target":10},{"duration":"5s","target":0}]',
      ),
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
  const headers = { Authorization: `Bearer ${data.token}` };
  const roll = Math.random();

  let res;
  if (roll < 0.6) {
    res = http.get(`${BASE_URL}/api/v1/dictionary?page=1&limit=20`, { headers });
  } else if (roll < 0.85) {
    res = http.get(`${BASE_URL}/api/v1/dictionary/stats`, { headers });
  } else {
    res = http.get(`${BASE_URL}/api/v1/users?page=1&limit=20`, { headers });
  }
  check(res, { 'mixed workload status is 200 or 429': (r) => r.status === 200 || r.status === 429 });
  sleep(0.2);
}
