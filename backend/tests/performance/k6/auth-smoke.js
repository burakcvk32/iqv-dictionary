import http from 'k6/http';
import { check, sleep } from 'k6';

// K6_ ON EKI: bu script SADECE k6TestServer.ts'in urettigi K6_ seed
// verisine/kullanicisina karsi calisir -- gercek/uretim backend'ine ASLA
// yonlendirilmemelidir (bkz. BASE_URL varsayilani: localhost).
const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:4001';
const USERNAME = __ENV.K6_ADMIN_USERNAME || 'K6_perf_admin';
const PASSWORD = __ENV.K6_ADMIN_PASSWORD || 'K6_Perf_Test_Pass_2026!';

export const options = {
  vus: Number(__ENV.VUS || 1),
  duration: __ENV.DURATION || '10s',
  thresholds: {},
};

export default function () {
  const res = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ username: USERNAME, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(res, {
    'login status 200': (r) => r.status === 200,
    'login returns token': (r) => {
      try {
        return !!JSON.parse(r.body).token;
      } catch {
        return false;
      }
    },
  });
  sleep(1);
}
