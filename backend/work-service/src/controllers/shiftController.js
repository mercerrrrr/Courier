const db = require('../db');
const {
  BREAK_AFTER_HOURS,
  BREAK_DURATION_MINUTES,
  MAX_SHIFT_HOURS,
  HARD_REST_HOURS_AFTER_BLOCK,
  MIN_REST_BETWEEN_SHIFTS_HOURS,
  MIN_SHIFT_HOURS_BEFORE_CAN_END,
  TIME_ACCELERATION_FACTOR
} = require('../config');

/**
 * Вспомогательная функция: создаём событие смены
 */
async function createShiftEvent(shiftId, eventType, meta = null) {
  await db.query(
    `
    INSERT INTO work.shift_events (shift_id, event_type, meta)
    VALUES ($1, $2, $3)
    `,
    [shiftId, eventType, meta ? JSON.stringify(meta) : null]
  );
}

/**
 * Получить "открытую" смену (ended_at IS NULL)
 */
async function getOpenShift(userId) {
  const res = await db.query(
    `
    SELECT *
    FROM work.shifts
    WHERE user_id = $1 AND ended_at IS NULL
    ORDER BY started_at DESC
    LIMIT 1
    `,
    [userId]
  );
  return res.rows[0] || null;
}

/**
 * Последняя смена пользователя (для проверки блокировки / паузы между сменами)
 */
async function getLastShift(userId) {
  const res = await db.query(
    `
    SELECT *
    FROM work.shifts
    WHERE user_id = $1
    ORDER BY started_at DESC
    LIMIT 1
    `,
    [userId]
  );
  return res.rows[0] || null;
}

/**
 * Обновляет "открытую" смену с учётом прошедшего реального времени и TIME_ACCELERATION_FACTOR.
 * Может:
 *  - накопить рабочее время;
 *  - перевести в BREAK;
 *  - перевести в BLOCKED (и закрыть смену).
 * Возвращает актуальное состояние смены (уже после возможных изменений).
 */
async function updateOpenShiftState(shift) {
  if (!shift || !shift.last_status_change || !shift.status) {
    return shift;
  }

  const now = new Date();
  const lastChange = new Date(shift.last_status_change);
  const diffMs = now.getTime() - lastChange.getTime();

  if (diffMs <= 0) {
    return shift;
  }

  const realDeltaSeconds = Math.floor(diffMs / 1000);
  const virtualDeltaSeconds = realDeltaSeconds * TIME_ACCELERATION_FACTOR;

  let newShift = { ...shift };

  // ACTIVE: накапливаем рабочее время, проверяем пороги перерыва и бана
  if (shift.status === 'ACTIVE') {
    const prevWorkSeconds = shift.total_work_seconds;
    const newWorkSeconds = prevWorkSeconds + virtualDeltaSeconds;

    const prevWorkHours = prevWorkSeconds / 3600;
    const newWorkHours = newWorkSeconds / 3600;

    // 1) Проверка на переработку (бан)
    if (newWorkHours >= MAX_SHIFT_HOURS) {
      const blockedUntil = new Date(
        now.getTime() + HARD_REST_HOURS_AFTER_BLOCK * 3600 * 1000
      );

      await db.query(
        `
        UPDATE work.shifts
        SET status = 'BLOCKED',
            ended_at = $1,
            total_work_seconds = $2,
            last_status_change = $1,
            blocked_until = $3,
            updated_at = $1
        WHERE id = $4
        `,
        [now, newWorkSeconds, blockedUntil, shift.id]
      );

      await createShiftEvent(shift.id, 'BLOCK_START', {
        reason: 'MAX_SHIFT_HOURS_REACHED',
        total_work_hours: newWorkHours
      });

      newShift = {
        ...newShift,
        status: 'BLOCKED',
        ended_at: now.toISOString(),
        total_work_seconds: newWorkSeconds,
        last_status_change: now.toISOString(),
        blocked_until: blockedUntil.toISOString()
      };

      // После BLOCKED смена считается закрытой, open-смены больше нет
      return newShift;
    }

    // 2) Проверка на обязательный перерыв
    if (prevWorkHours < BREAK_AFTER_HOURS && newWorkHours >= BREAK_AFTER_HOURS) {
      await db.query(
        `
        UPDATE work.shifts
        SET status = 'BREAK',
            total_work_seconds = $1,
            last_status_change = $2,
            updated_at = $2
        WHERE id = $3
        `,
        [newWorkSeconds, now, shift.id]
      );

      await createShiftEvent(shift.id, 'BREAK_START', {
        total_work_hours_before_break: newWorkHours
      });

      newShift = {
        ...newShift,
        status: 'BREAK',
        total_work_seconds: newWorkSeconds,
        last_status_change: now.toISOString()
      };

      return newShift;
    }

    // 3) Просто накапливаем рабочее время
    await db.query(
      `
      UPDATE work.shifts
      SET total_work_seconds = $1,
          last_status_change = $2,
          updated_at = $2
      WHERE id = $3
      `,
      [newWorkSeconds, now, shift.id]
    );

    newShift = {
      ...newShift,
      total_work_seconds: newWorkSeconds,
      last_status_change: now.toISOString()
    };

    return newShift;
  }

  // BREAK: накапливаем время перерыва, проверяем окончание перерыва
  if (shift.status === 'BREAK') {
    const prevBreakSeconds = shift.total_break_seconds;
    const newBreakSeconds = prevBreakSeconds + virtualDeltaSeconds;

    const prevBreakMinutes = prevBreakSeconds / 60;
    const newBreakMinutes = newBreakSeconds / 60;

    // Перерыв закончился
    if (prevBreakMinutes < BREAK_DURATION_MINUTES && newBreakMinutes >= BREAK_DURATION_MINUTES) {
      await db.query(
        `
        UPDATE work.shifts
        SET status = 'ACTIVE',
            total_break_seconds = $1,
            last_status_change = $2,
            updated_at = $2
        WHERE id = $3
        `,
        [newBreakSeconds, now, shift.id]
      );

      await createShiftEvent(shift.id, 'BREAK_END', {
        total_break_minutes: newBreakMinutes
      });

      newShift = {
        ...newShift,
        status: 'ACTIVE',
        total_break_seconds: newBreakSeconds,
        last_status_change: now.toISOString()
      };

      return newShift;
    }

    // Перерыв ещё идёт
    await db.query(
      `
      UPDATE work.shifts
      SET total_break_seconds = $1,
          last_status_change = $2,
          updated_at = $2
      WHERE id = $3
      `,
      [newBreakSeconds, now, shift.id]
    );

    newShift = {
      ...newShift,
      total_break_seconds: newBreakSeconds,
      last_status_change: now.toISOString()
    };

    return newShift;
  }

  // FINISHED / BLOCKED: ничего не меняем
  return newShift;
}

/**
 * POST /shifts/start
 * Запуск новой смены
 */
exports.startShift = async (req, res) => {
  const userId = req.user.userId;

  try {
    const now = new Date();

    // 1. Проверяем, нет ли уже открытой смены
    const openShift = await getOpenShift(userId);
    if (openShift) {
      return res.status(400).json({ message: 'У вас уже есть активная смена' });
    }

    // 2. Проверяем последнюю смену на блокировку и отдых между сменами
    const lastShift = await getLastShift(userId);

    if (lastShift && lastShift.blocked_until) {
      const blockedUntil = new Date(lastShift.blocked_until);
      if (blockedUntil > now) {
        return res.status(400).json({
          message: `Вы заблокированы до ${blockedUntil.toLocaleString()}`,
          blockedUntil
        });
      }
    }

    if (lastShift && lastShift.ended_at) {
      const endedAt = new Date(lastShift.ended_at);
      const diffMs = now.getTime() - endedAt.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours < MIN_REST_BETWEEN_SHIFTS_HOURS) {
        const needMinutes = Math.ceil(
          (MIN_REST_BETWEEN_SHIFTS_HOURS - diffHours) * 60
        );
        return res.status(400).json({
          message: `Нельзя начать новую смену сразу. Отдохните ещё ~${needMinutes} минут.`
        });
      }
    }

    // 3. Создаём новую смену
    const insertRes = await db.query(
      `
      INSERT INTO work.shifts (
        user_id, status, started_at, last_status_change
      )
      VALUES ($1, 'ACTIVE', $2, $2)
      RETURNING *
      `,
      [userId, now]
    );

    const shift = insertRes.rows[0];

    await createShiftEvent(shift.id, 'WORK_START', null);

    return res.status(201).json({
      message: 'Смена начата',
      shift
    });
  } catch (err) {
    console.error('Error in startShift:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * POST /shifts/end
 * Завершение текущей смены (если отработал минимум N часов)
 */
exports.endShift = async (req, res) => {
  const userId = req.user.userId;

  try {
    let openShift = await getOpenShift(userId);

    if (!openShift) {
      return res.status(400).json({ message: 'У вас нет активной смены' });
    }

    // Обновляем состояние (добавляем последнее рабочее время)
    openShift = await updateOpenShiftState(openShift);

    // Если в процессе обновления смену заблочило (BLOCKED), она уже закрыта
    if (openShift.status === 'BLOCKED' && openShift.ended_at) {
      return res.status(400).json({
        message:
          'Смена уже автоматически завершена из-за переработки и вы заблокированы.',
        shift: openShift
      });
    }

    const now = new Date();
    const workHours = openShift.total_work_seconds / 3600;

    if (workHours < MIN_SHIFT_HOURS_BEFORE_CAN_END) {
      return res.status(400).json({
        message: `Нельзя завершить смену раньше, чем через ${MIN_SHIFT_HOURS_BEFORE_CAN_END} часа(ов) работы. Сейчас: ${workHours.toFixed(
          2
        )} ч`
      });
    }

    // Завершаем смену
    const updateRes = await db.query(
      `
      UPDATE work.shifts
      SET status = 'FINISHED',
          ended_at = $1,
          last_status_change = $1,
          updated_at = $1
      WHERE id = $2
      RETURNING *
      `,
      [now, openShift.id]
    );

    const finishedShift = updateRes.rows[0];

    await createShiftEvent(openShift.id, 'WORK_END', {
      total_work_hours: finishedShift.total_work_seconds / 3600,
      total_break_minutes: finishedShift.total_break_seconds / 60
    });

    return res.json({
      message: 'Смена завершена',
      shift: finishedShift
    });
  } catch (err) {
    console.error('Error in endShift:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * GET /shifts/current
 * Текущее состояние смены / блокировки для главной страницы курьера
 */
exports.getCurrentShift = async (req, res) => {
  const userId = req.user.userId;
  const now = new Date();

  try {
    let openShift = await getOpenShift(userId);

    if (openShift) {
      openShift = await updateOpenShiftState(openShift);
    }

    const lastShift = await getLastShift(userId);

    // Если есть открытая смена (ACTIVE или BREAK)
    if (openShift && !openShift.ended_at) {
      const workHours = openShift.total_work_seconds / 3600;
      const breakMinutes = openShift.total_break_seconds / 60;

      let timeToBreakMinutes = null;
      let timeToBlockMinutes = null;
      let breakSoon = false;
      let blockSoon = false;

      if (openShift.status === 'ACTIVE') {
        const hoursToBreak = BREAK_AFTER_HOURS - workHours;
        if (hoursToBreak > 0) {
          timeToBreakMinutes = Math.max(0, Math.round(hoursToBreak * 60));
          breakSoon = timeToBreakMinutes <= 30;
        }

        const hoursToBlock = MAX_SHIFT_HOURS - workHours;
        if (hoursToBlock > 0) {
          timeToBlockMinutes = Math.max(0, Math.round(hoursToBlock * 60));
          blockSoon = timeToBlockMinutes <= 30;
        }
      }

      return res.json({
        status: openShift.status, // ACTIVE или BREAK
        shiftId: openShift.id,
        workSeconds: openShift.total_work_seconds,
        breakSeconds: openShift.total_break_seconds,
        workHours: Number(workHours.toFixed(2)),
        breakMinutes: Math.round(breakMinutes),
        timeToBreakMinutes,
        timeToBlockMinutes,
        breakSoon,
        blockSoon,
        blockedUntil: openShift.blocked_until
      });
    }

    // Если нет открытой смены, но последняя смена дала блок
    if (
      lastShift &&
      lastShift.blocked_until &&
      new Date(lastShift.blocked_until) > now
    ) {
      const blockedUntil = new Date(lastShift.blocked_until);
      const msLeft = blockedUntil.getTime() - now.getTime();
      const minutesLeft = Math.ceil(msLeft / 1000 / 60);

      return res.json({
        status: 'BLOCKED',
        shiftId: lastShift.id,
        workSeconds: lastShift.total_work_seconds,
        breakSeconds: lastShift.total_break_seconds,
        workHours: Number((lastShift.total_work_seconds / 3600).toFixed(2)),
        breakMinutes: Math.round(lastShift.total_break_seconds / 60),
        timeToBreakMinutes: null,
        timeToBlockMinutes: null,
        breakSoon: false,
        blockSoon: false,
        blockedUntil: lastShift.blocked_until,
        blockedMinutesLeft: minutesLeft
      });
    }

    // Вообще нет активной смены и блокировки
    return res.json({
      status: 'OUT_OF_SHIFT',
      shiftId: null,
      workSeconds: 0,
      breakSeconds: 0,
      workHours: 0,
      breakMinutes: 0,
      timeToBreakMinutes: null,
      timeToBlockMinutes: null,
      breakSoon: false,
      blockSoon: false,
      blockedUntil: null
    });
  } catch (err) {
    console.error('Error in getCurrentShift:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * GET /shifts/history
 * История смен пользователя (для профиля/отчётов)
 */
exports.getHistory = async (req, res) => {
  const userId = req.user.userId;

  try {
    const result = await db.query(
      `
      SELECT
        id,
        status,
        started_at,
        ended_at,
        total_work_seconds,
        total_break_seconds,
        blocked_until
      FROM work.shifts
      WHERE user_id = $1
      ORDER BY started_at DESC
      LIMIT 50
      `,
      [userId]
    );

    return res.json({ shifts: result.rows });
  } catch (err) {
    console.error('Error in getHistory:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
