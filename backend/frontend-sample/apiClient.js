const API_BASE = process.env.CORTEX_API_BASE || 'http://localhost:8080';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Request failed: ${response.status}`);
  }
  return body;
}

async function signup(payload) {
  return request('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function login(payload) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function refreshToken(refreshTokenValue) {
  return request('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: refreshTokenValue }),
  });
}

async function fetchDistricts() {
  return request('/reference/districts');
}

async function fetchColleges(districtId) {
  const q = districtId ? `?districtId=${encodeURIComponent(districtId)}` : '';
  return request(`/reference/colleges${q}`);
}

async function fetchDegrees() {
  return request('/reference/degrees');
}

async function fetchCourses(degreeId) {
  const q = degreeId ? `?degreeId=${encodeURIComponent(degreeId)}` : '';
  return request(`/reference/courses${q}`);
}

module.exports = {
  signup,
  login,
  refreshToken,
  fetchDistricts,
  fetchColleges,
  fetchDegrees,
  fetchCourses,
};
