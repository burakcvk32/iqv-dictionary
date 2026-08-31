import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:4001';
const USERNAME = __ENV.K6_ADMIN_USERNAME || 'K6_perf_admin';
const PASSWORD = __ENV.K6_ADMIN_PASSWORD || 'K6_Perf_Test_Pass_2026!';

export const options = {
  scenarios: {
    default: {
      executor: 'shared-iterations',
      vus: Number(__ENV.VUS || 3),
      iterations: Number(__ENV.ITERATIONS || 20),
      maxDuration: __ENV.MAX_DURATION || '30s',
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
  const res = http.get(`${BASE_URL}/api/v1/users?page=1&limit=20`, { headers });
  check(res, { 'personnel list status is 200 or 429': (r) => r.status === 200 || r.status === 429 });
  sleep(0.3);
}
