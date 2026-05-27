/**
 * k6 Load Test Script for ViralFabrics CRM
 * 
 * Installation: 
 *   brew install k6 (macOS)
 *   sudo apt install k6 (Ubuntu)
 *   choco install k6 (Windows)
 * 
 * Usage:
 *   k6 run load-tests/k6-stress-test.js
 *   k6 run --env BASE_URL=https://your-domain.com load-tests/k6-stress-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const ordersFetchDuration = new Trend('orders_fetch_duration');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 50 },    // Ramp up to 50 users
    { duration: '2m', target: 100 },   // Ramp up to 100 users (sustained load)
    { duration: '1m', target: 200 },   // Spike to 200 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    errors: ['rate<0.05'],              // Error rate under 5%
    'login_duration': ['p(95)<1000'],   // Login under 1s
    'orders_fetch_duration': ['p(95)<3000'], // Orders fetch under 3s
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test data
const TEST_USER = {
  username: __ENV.TEST_USERNAME || 'testuser',
  password: __ENV.TEST_PASSWORD || 'testpassword123',
};

export function setup() {
  // Login once and get token for all VUs
  console.log(`Running load test against: ${BASE_URL}`);
  return {};
}

export default function () {
  let authToken = null;

  // 1. Login Test
  group('Authentication', () => {
    const loginStart = Date.now();
    const loginRes = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify(TEST_USER),
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: '10s',
      }
    );

    loginDuration.add(Date.now() - loginStart);

    const loginSuccess = check(loginRes, {
      'login status is 200': (r) => r.status === 200,
      'login returns token': (r) => {
        try {
          const body = JSON.parse(r.body);
          if (body.token) {
            authToken = body.token;
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },
    });

    errorRate.add(!loginSuccess);
  });

  sleep(1);

  // 2. Dashboard Stats Test
  if (authToken) {
    group('Dashboard', () => {
      const headers = {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      };

      const dashboardRes = http.get(`${BASE_URL}/api/dashboard/stats-instant`, {
        headers,
        timeout: '15s',
      });

      const dashboardSuccess = check(dashboardRes, {
        'dashboard status is 200': (r) => r.status === 200,
        'dashboard returns data': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.success === true;
          } catch {
            return false;
          }
        },
      });

      errorRate.add(!dashboardSuccess);
    });

    sleep(0.5);

    // 3. Orders List Test
    group('Orders', () => {
      const headers = {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      };

      const ordersStart = Date.now();
      const ordersRes = http.get(`${BASE_URL}/api/orders?page=1&limit=25`, {
        headers,
        timeout: '15s',
      });
      ordersFetchDuration.add(Date.now() - ordersStart);

      const ordersSuccess = check(ordersRes, {
        'orders status is 200': (r) => r.status === 200,
        'orders returns array': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.success === true && Array.isArray(body.data);
          } catch {
            return false;
          }
        },
      });

      errorRate.add(!ordersSuccess);
    });

    sleep(0.5);

    // 4. Session Validation Test
    group('Session Validation', () => {
      const headers = {
        Authorization: `Bearer ${authToken}`,
        'Cache-Control': 'no-cache',
      };

      const validateRes = http.get(`${BASE_URL}/api/auth/validate-session`, {
        headers,
        timeout: '5s',
      });

      const validateSuccess = check(validateRes, {
        'validate status is 200': (r) => r.status === 200,
        'validate returns user': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.success === true && body.user;
          } catch {
            return false;
          }
        },
      });

      errorRate.add(!validateSuccess);
    });

    sleep(0.5);

    // 5. Parties List Test
    group('Parties', () => {
      const headers = {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      };

      const partiesRes = http.get(`${BASE_URL}/api/parties?limit=100`, {
        headers,
        timeout: '10s',
      });

      const partiesSuccess = check(partiesRes, {
        'parties status is 200': (r) => r.status === 200,
      });

      errorRate.add(!partiesSuccess);
    });

    sleep(1);

    // 6. Fabrics List Test
    group('Fabrics', () => {
      const headers = {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      };

      const fabricsRes = http.get(`${BASE_URL}/api/fabrics?page=1&limit=25`, {
        headers,
        timeout: '10s',
      });

      const fabricsSuccess = check(fabricsRes, {
        'fabrics status is 200': (r) => r.status === 200,
      });

      errorRate.add(!fabricsSuccess);
    });
  }

  sleep(1);
}

export function handleSummary(data) {
  return {
    'load-tests/summary.json': JSON.stringify(data, null, 2),
  };
}

