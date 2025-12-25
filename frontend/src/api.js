const AUTH_API_BASE_URL = 'http://localhost:4001';
const WORK_API_BASE_URL = 'http://localhost:4002';
const ORDERS_API_BASE_URL = 'http://localhost:4003';

async function handleResponse(response) {
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    // если не JSON — оставляем пустой объект
  }

  if (!response.ok) {
    const message = data.message || `HTTP error ${response.status}`;
    throw new Error(message);
  }

  return data;
}

// ----- AUTH-SERVICE -----

export async function registerUser({ phone, password, name }) {
  const res = await fetch(`${AUTH_API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ phone, password, name })
  });

  return handleResponse(res);
}

export async function loginUser({ phone, password }) {
  const res = await fetch(`${AUTH_API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ phone, password })
  });

  return handleResponse(res);
}

export async function getMe(token) {
  const res = await fetch(`${AUTH_API_BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return handleResponse(res);
}

export async function updateProfile(token, { name, avatarUrl }) {
  const res = await fetch(`${AUTH_API_BASE_URL}/auth/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ name, avatarUrl })
  });

  return handleResponse(res);
}

// ----- WORK-SERVICE (смены, усталость) -----

export async function getCurrentShift(token) {
  const res = await fetch(`${WORK_API_BASE_URL}/shifts/current`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return handleResponse(res);
}

export async function startShift(token) {
  const res = await fetch(`${WORK_API_BASE_URL}/shifts/start`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return handleResponse(res);
}

export async function endShift(token) {
  const res = await fetch(`${WORK_API_BASE_URL}/shifts/end`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return handleResponse(res);
}

// ----- ORDERS-SERVICE (курьерские ручки) -----

export async function getAvailableOrders(token) {
  const res = await fetch(`${ORDERS_API_BASE_URL}/orders/available`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return handleResponse(res);
}

export async function getMyOrders(token) {
  const res = await fetch(`${ORDERS_API_BASE_URL}/orders/my`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return handleResponse(res);
}

export async function acceptOrder(token, orderId) {
  const res = await fetch(`${ORDERS_API_BASE_URL}/orders/${orderId}/accept`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return handleResponse(res);
}

export async function completeOrder(token, orderId) {
  const res = await fetch(`${ORDERS_API_BASE_URL}/orders/${orderId}/complete`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return handleResponse(res);
}

// ----- ORDERS-SERVICE (админские ручки) -----

export async function adminGetOrders(token) {
  const res = await fetch(`${ORDERS_API_BASE_URL}/admin/orders`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return handleResponse(res);
}

export async function adminCreateOrder(
  token,
  { address, payout, etaMinutes, destLat, destLng }
) {
  const res = await fetch(`${ORDERS_API_BASE_URL}/admin/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ address, payout, etaMinutes, destLat, destLng })
  });

  return handleResponse(res);
}

// ----- WORK-SERVICE (админ: курьеры) -----

export async function adminGetCouriers(token) {
  const res = await fetch(`${WORK_API_BASE_URL}/admin/couriers`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return handleResponse(res);
}

// ----- AUTH-SERVICE (админ: пользователи/курьеры) -----

export async function adminBlockUser(token, userId, { reason } = {}) {
  const res = await fetch(`${AUTH_API_BASE_URL}/admin/users/${userId}/block`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ reason: reason || null })
  });

  return handleResponse(res);
}

export async function adminUnblockUser(token, userId) {
  const res = await fetch(
    `${AUTH_API_BASE_URL}/admin/users/${userId}/unblock`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  return handleResponse(res);
}

export async function adminDeleteUser(token, userId) {
  const res = await fetch(`${AUTH_API_BASE_URL}/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return handleResponse(res);
}

// ----- ORDERS-SERVICE (geo helpers) -----

export async function geoSearchAddress(q) {
  const res = await fetch(
    `${ORDERS_API_BASE_URL}/geo/search?q=${encodeURIComponent(q)}`
  );

  return handleResponse(res);
}

export async function geoReverse({ lat, lng }) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng)
  });

  const res = await fetch(`${ORDERS_API_BASE_URL}/geo/reverse?${params}`);
  return handleResponse(res);
}

export async function geoGetRoute({ fromLat, fromLng, toLat, toLng }) {
  const params = new URLSearchParams({
    fromLat: String(fromLat),
    fromLng: String(fromLng),
    toLat: String(toLat),
    toLng: String(toLng)
  });

  const res = await fetch(`${ORDERS_API_BASE_URL}/geo/route?${params}`);
  return handleResponse(res);
}
