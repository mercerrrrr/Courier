const { pool } = require('../db');

// Общий SELECT, чтобы сразу вернуть поля в camelCase
const BASE_SELECT = `
  SELECT
    id,
    address,
    payout,
    eta_minutes AS "etaMinutes",
    status,
    courier_id AS "courierId",
    created_by AS "createdBy",
    dest_lat AS "destLat",
    dest_lng AS "destLng",
    created_at AS "createdAt",
    updated_at AS "updatedAt"
  FROM orders.orders
`;

function normalizeInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function normalizeNullableNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

// ----- Админские ручки -----

// GET /admin/orders
async function getAllOrders(req, res) {
  try {
    const result = await pool.query(`
      ${BASE_SELECT}
      ORDER BY created_at DESC
    `);
    return res.json({ orders: result.rows });
  } catch (err) {
    console.error('getAllOrders error:', err);
    return res.status(500).json({ message: 'Ошибка при получении заказов' });
  }
}

// POST /admin/orders
async function createOrder(req, res) {
  try {
    const { address, payout, etaMinutes, destLat, destLng } = req.body;

    if (!address || payout === undefined || etaMinutes === undefined) {
      return res
        .status(400)
        .json({ message: 'address, payout, etaMinutes обязательны' });
    }

    const payoutInt = normalizeInt(payout);
    const etaInt = normalizeInt(etaMinutes);

    if (payoutInt === null || etaInt === null) {
      return res
        .status(400)
        .json({ message: 'payout и etaMinutes должны быть числами' });
    }

    const lat = normalizeNullableNumber(destLat);
    const lng = normalizeNullableNumber(destLng);

    // Если координаты переданы частично — отклоняем
    if ((lat === null && lng !== null) || (lat !== null && lng === null)) {
      return res.status(400).json({ message: 'destLat и destLng должны быть указаны вместе' });
    }

    const result = await pool.query(
      `
      INSERT INTO orders.orders (
        address,
        payout,
        eta_minutes,
        status,
        courier_id,
        created_by,
        dest_lat,
        dest_lng
      )
      VALUES ($1, $2, $3, 'NEW', NULL, $4, $5, $6)
      RETURNING
        id,
        address,
        payout,
        eta_minutes AS "etaMinutes",
        status,
        courier_id AS "courierId",
        created_by AS "createdBy",
        dest_lat AS "destLat",
        dest_lng AS "destLng",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `,
      [address, payoutInt, etaInt, req.user.id, lat, lng]
    );

    return res.status(201).json({
      message: 'Заказ создан',
      order: result.rows[0]
    });
  } catch (err) {
    console.error('createOrder error:', err);
    return res.status(500).json({ message: 'Ошибка при создании заказа' });
  }
}

// ----- Курьерские ручки -----

// GET /orders/available
async function getAvailableOrders(req, res) {
  try {
    const result = await pool.query(
      `
      ${BASE_SELECT}
      WHERE status = 'NEW'
      ORDER BY created_at ASC
    `
    );

    return res.json({ orders: result.rows });
  } catch (err) {
    console.error('getAvailableOrders error:', err);
    return res
      .status(500)
      .json({ message: 'Ошибка при получении доступных заказов' });
  }
}

// GET /orders/my
async function getMyOrders(req, res) {
  try {
    const courierId = req.user.id;

    const result = await pool.query(
      `
      ${BASE_SELECT}
      WHERE courier_id = $1
      ORDER BY created_at DESC
    `,
      [courierId]
    );

    return res.json({ orders: result.rows });
  } catch (err) {
    console.error('getMyOrders error:', err);
    return res
      .status(500)
      .json({ message: 'Ошибка при получении заказов курьера' });
  }
}

// POST /orders/:id/accept
async function acceptOrder(req, res) {
  try {
    const orderId = normalizeInt(req.params.id);
    if (!orderId) {
      return res.status(400).json({ message: 'Некорректный id заказа' });
    }

    const courierId = req.user.id;

    // Атомарный апдейт: только если статус сейчас NEW
    const result = await pool.query(
      `
      UPDATE orders.orders
      SET
        status = 'IN_PROGRESS',
        courier_id = $1,
        updated_at = NOW()
      WHERE id = $2
        AND status = 'NEW'
      RETURNING
        id,
        address,
        payout,
        eta_minutes AS "etaMinutes",
        status,
        courier_id AS "courierId",
        created_by AS "createdBy",
        dest_lat AS "destLat",
        dest_lng AS "destLng",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `,
      [courierId, orderId]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        message: 'Заказ не найден или уже взят другим курьером'
      });
    }

    return res.json({
      message: 'Заказ принят в работу',
      order: result.rows[0]
    });
  } catch (err) {
    console.error('acceptOrder error:', err);
    return res.status(500).json({ message: 'Ошибка при взятии заказа' });
  }
}

// POST /orders/:id/complete
async function completeOrder(req, res) {
  try {
    const orderId = normalizeInt(req.params.id);
    if (!orderId) {
      return res.status(400).json({ message: 'Некорректный id заказа' });
    }

    const courierId = req.user.id;

    // Завершить заказ может только тот курьер, который его выполняет.
    const result = await pool.query(
      `
      UPDATE orders.orders
      SET
        status = 'DONE',
        updated_at = NOW()
      WHERE id = $1
        AND courier_id = $2
        AND status = 'IN_PROGRESS'
      RETURNING
        id,
        address,
        payout,
        eta_minutes AS "etaMinutes",
        status,
        courier_id AS "courierId",
        created_by AS "createdBy",
        dest_lat AS "destLat",
        dest_lng AS "destLng",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `,
      [orderId, courierId]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        message:
          'Нельзя завершить этот заказ: он либо не ваш, либо не в статусе IN_PROGRESS'
      });
    }

    return res.json({
      message: 'Заказ отмечен как выполненный',
      order: result.rows[0]
    });
  } catch (err) {
    console.error('completeOrder error:', err);
    return res.status(500).json({ message: 'Ошибка при завершении заказа' });
  }
}

module.exports = {
  getAllOrders,
  createOrder,
  getAvailableOrders,
  getMyOrders,
  acceptOrder,
  completeOrder
};
