const db = require('../db');

function isTruthy(v) {
  return v === true || v === 'true' || v === '1' || v === 1;
}

// GET /admin/users
// includeDeleted=true  - показать удалённых
exports.getAllUsers = async (req, res) => {
  try {
    const includeDeleted = isTruthy(req.query.includeDeleted);

    const result = await db.query(
      `
      SELECT
        id,
        phone,
        name,
        role,
        avatar_url,
        is_blocked,
        blocked_reason,
        deleted_at,
        created_at,
        updated_at
      FROM auth.users
      WHERE ($1::boolean = true) OR deleted_at IS NULL
      ORDER BY id;
      `,
      [includeDeleted]
    );

    return res.json({ users: result.rows });
  } catch (err) {
    console.error('Error in getAllUsers:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /admin/users/:id/block
exports.blockUser = async (req, res) => {
  const userId = Number(req.params.id);
  const { reason } = req.body || {};

  if (!Number.isFinite(userId)) {
    return res.status(400).json({ message: 'Некорректный id' });
  }

  try {
    const result = await db.query(
      `
      UPDATE auth.users
      SET is_blocked = TRUE,
          blocked_reason = COALESCE($1, blocked_reason, 'Заблокировано администратором'),
          updated_at = NOW()
      WHERE id = $2 AND deleted_at IS NULL
      RETURNING id, phone, name, role, avatar_url, is_blocked, blocked_reason, deleted_at, created_at, updated_at;
      `,
      [reason || null, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    return res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Error in blockUser:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /admin/users/:id/unblock
exports.unblockUser = async (req, res) => {
  const userId = Number(req.params.id);

  if (!Number.isFinite(userId)) {
    return res.status(400).json({ message: 'Некорректный id' });
  }

  try {
    const result = await db.query(
      `
      UPDATE auth.users
      SET is_blocked = FALSE,
          blocked_reason = NULL,
          updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id, phone, name, role, avatar_url, is_blocked, blocked_reason, deleted_at, created_at, updated_at;
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    return res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Error in unblockUser:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// DELETE /admin/users/:id
exports.deleteUser = async (req, res) => {
  const userId = Number(req.params.id);

  if (!Number.isFinite(userId)) {
    return res.status(400).json({ message: 'Некорректный id' });
  }

  try {
    const result = await db.query(
      `
      UPDATE auth.users
      SET deleted_at = NOW(),
          is_blocked = TRUE,
          blocked_reason = 'Аккаунт удалён',
          updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id;
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('Error in deleteUser:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
