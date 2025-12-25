const db = require('../db');

// GET /admin/couriers
exports.getCouriers = async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT
        u.id,
        u.phone,
        u.name,
        u.avatar_url,
        u.is_blocked,
        u.blocked_reason,
        u.deleted_at,

        s.id AS shift_id,
        s.status AS shift_status,
        s.started_at,
        s.ended_at,
        s.total_work_seconds,
        s.total_break_seconds,
        s.blocked_until
      FROM auth.users u
      LEFT JOIN LATERAL (
        SELECT *
        FROM work.shifts ws
        WHERE ws.user_id = u.id
        ORDER BY ws.started_at DESC
        LIMIT 1
      ) s ON TRUE
      WHERE u.role = 'courier'
        AND u.deleted_at IS NULL
      ORDER BY u.id;
      `
    );

    const couriers = result.rows.map((r) => {
      const workMinutes = r.total_work_seconds ? Math.floor(r.total_work_seconds / 60) : 0;
      const breakMinutes = r.total_break_seconds ? Math.floor(r.total_break_seconds / 60) : 0;

      return {
        id: r.id,
        phone: r.phone,
        name: r.name,
        avatar_url: r.avatar_url,
        is_blocked: r.is_blocked,
        blocked_reason: r.blocked_reason,
        shift: r.shift_id
          ? {
              id: r.shift_id,
              status: r.shift_status,
              started_at: r.started_at,
              ended_at: r.ended_at,
              work_minutes: workMinutes,
              break_minutes: breakMinutes,
              blocked_until: r.blocked_until
            }
          : null
      };
    });

    return res.json({ couriers });
  } catch (err) {
    console.error('Error in getCouriers:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
