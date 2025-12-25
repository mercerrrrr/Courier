// Geo endpoints for address search / reverse geocoding and route building
// Uses public services:
// - Nominatim (OpenStreetMap) for geocoding
// - OSRM public demo server for routing

// NOTE: Node.js 18+ has global fetch. In Node 24 (your setup) it's available.

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map(); // key -> { ts, data }

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCached(key, data) {
  cache.set(key, { ts: Date.now(), data });
}

function toNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Форматирует адрес, убирая почтовые индексы и лишние детали
function formatAddressClean(displayName) {
  if (!displayName) return displayName;

  // Убираем почтовые индексы (цифры в формате 414000, 414-000 и т.д.)
  let cleaned = displayName.replace(/,?\s*\d{3,6}(-\d{3,6})?\s*,?/g, ',');

  // Убираем дубли запятых и лишние пробелы
  cleaned = cleaned.replace(/,\s*,+/g, ',').replace(/,\s*$/g, '').replace(/^\s*,/g, '');
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  return cleaned;
}

exports.searchAddress = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ results: [] });

    const cacheKey = `search:${q}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ results: cached });

    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(
      q
    )}`;

    const resp = await fetch(url, {
      headers: {
        // Nominatim просит осмысленный User-Agent.
        'User-Agent': 'CourierOps/1.0'
      }
    });

    if (!resp.ok) {
      return res.status(502).json({ message: 'Geo provider error' });
    }

    const data = await resp.json();
    const results = (data || []).map((x) => ({
      displayName: formatAddressClean(x.display_name),
      lat: Number(x.lat),
      lng: Number(x.lon)
    }));

    setCached(cacheKey, results);
    return res.json({ results });
  } catch (err) {
    console.error('geo search error:', err);
    return res.status(500).json({ message: 'Geo search failed' });
  }
};

exports.getRoute = async (req, res) => {
  try {
    const fromLat = toNum(req.query.fromLat);
    const fromLng = toNum(req.query.fromLng);
    const toLat = toNum(req.query.toLat);
    const toLng = toNum(req.query.toLng);

    if (
      fromLat === null ||
      fromLng === null ||
      toLat === null ||
      toLng === null
    ) {
      return res.status(400).json({ message: 'Invalid coordinates' });
    }

    const cacheKey = `route:${fromLat},${fromLng}->${toLat},${toLng}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ route: cached });

    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const resp = await fetch(url);
    if (!resp.ok) {
      return res.status(502).json({ message: 'Route provider error' });
    }

    const data = await resp.json();
    const route = data?.routes?.[0];
    if (!route) return res.json({ route: null });

    const payload = {
      distance: route.distance,
      duration: route.duration,
      geometry: route.geometry
    };

    setCached(cacheKey, payload);
    return res.json({ route: payload });
  } catch (err) {
    console.error('geo route error:', err);
    return res.status(500).json({ message: 'Route failed' });
  }
};

// GET /geo/reverse?lat=..&lng=..
// Возвращает человекочитаемый адрес по координатам.
exports.reverseGeocode = async (req, res) => {
  try {
    const lat = toNum(req.query.lat);
    const lng = toNum(req.query.lng);

    if (lat === null || lng === null) {
      return res.status(400).json({ message: 'Invalid coordinates' });
    }

    const cacheKey = `reverse:${lat},${lng}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ result: cached });

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(
      String(lat)
    )}&lon=${encodeURIComponent(String(lng))}`;

    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'CourierOps/1.0'
      }
    });

    if (!resp.ok) {
      return res.status(502).json({ message: 'Geo provider error' });
    }

    const data = await resp.json();
    const result = {
      displayName: formatAddressClean(data?.display_name) || null,
      lat,
      lng
    };

    setCached(cacheKey, result);
    return res.json({ result });
  } catch (err) {
    console.error('geo reverse error:', err);
    return res.status(500).json({ message: 'Geo reverse failed' });
  }
};
