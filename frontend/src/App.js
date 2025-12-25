import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  registerUser,
  loginUser,
  getMe,
  getCurrentShift,
  startShift,
  endShift,
  updateProfile,
  getAvailableOrders,
  getMyOrders,
  acceptOrder,
  completeOrder,
  adminGetOrders,
  adminCreateOrder,
  adminGetCouriers,
  adminBlockUser,
  adminUnblockUser,
  adminDeleteUser,
  geoSearchAddress,
  geoReverse
} from './api';

import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix Leaflet marker icons in CRA/Webpack builds
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

/* Базовый адрес компании (офис / склад) */
const BASE_ADDRESS = 'Астрахань, ул. Ленина, 15';

/* Адрес для отдыха во время перерыва */
const REST_PLACE_ADDRESS = 'Астрахань, Петровский парк';

/* Подборка парков/скверов Астрахани для перерыва */
const ASTRAKHAN_PARKS = [
  {
    id: 'petrovsky',
    name: 'Петровский парк',
    description:
      'Тень от деревьев, скамейки и спокойная атмосфера недалеко от центра. Удобно, если вы рядом с исторической частью города.',
    imageUrl:
      'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?auto=format&fit=crop&w=800&q=80',
    mapsQuery: 'Петровский парк, Астрахань'
  },
  {
    id: 'naberezhnaya',
    name: 'Набережная Волги',
    description:
      'Прогулка вдоль воды, можно посидеть, подышать и дать отдых спине. Хороший вариант для смены обстановки.',
    imageUrl:
      'https://images.unsplash.com/photo-1505142468610-359e7d316be0?auto=format&fit=crop&w=800&q=80',
    mapsQuery: 'Набережная реки Волга, Астрахань'
  },
  {
    id: 'gorodskoy-sad',
    name: 'Городской сад',
    description:
      'Зелёная зона с дорожками и лавочками, удобно для короткого перерыва и лёгкой прогулки.',
    imageUrl:
      'https://images.unsplash.com/photo-1571863533956-01c88e79957e?auto=format&fit=crop&w=800&q=80',
    mapsQuery: 'Городской сад, Астрахань'
  }
];

function App() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const [token, setToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  const [loading, setLoading] = useState(false); // для auth
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [activeTab, setActiveTab] = useState('shift'); // 'shift' | 'profile' | 'admin'

  const isAdmin = currentUser?.role === 'admin';

  // Для админа "Моя смена" не нужна — сразу перекидываем в админ-панель.
  useEffect(() => {
    if (isAdmin && activeTab === 'shift') {
      setActiveTab('admin');
    }
  }, [isAdmin, activeTab]);

  // При первом рендере пробуем восстановить токен из localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('auth_user');

    if (!savedToken) return;

    setToken(savedToken);

    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        console.error('Failed to parse saved user', e);
      }
    } else {
      (async () => {
        try {
          setLoading(true);
          setError('');
          const data = await getMe(savedToken);
          handleUserUpdated(data.user);
        } catch (e) {
          console.error(e);
          setError(
            'Не удалось получить данные пользователя. Попробуйте войти снова.'
          );
          setToken(null);
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
        } finally {
          setLoading(false);
        }
      })();
    }
  }, []);

  function handleUserUpdated(user) {
    setCurrentUser(user);
    if (user) {
      localStorage.setItem('auth_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('auth_user');
    }
  }

  function resetMessages() {
    setError('');
    setSuccessMessage('');
  }

  async function handleRegister(e) {
    e.preventDefault();
    resetMessages();

    if (!phone || !password || !name) {
      setError('Пожалуйста, заполните все поля');
      return;
    }

    try {
      setLoading(true);
      const data = await registerUser({ phone, password, name });

      setSuccessMessage('Регистрация прошла успешно! Вы вошли в систему.');
      setToken(data.token);
      localStorage.setItem('auth_token', data.token);
      handleUserUpdated(data.user);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    resetMessages();

    if (!phone || !password) {
      setError('Введите телефон и пароль');
      return;
    }

    try {
      setLoading(true);
      const data = await loginUser({ phone, password });

      setSuccessMessage('Вход выполнен успешно!');
      setToken(data.token);
      localStorage.setItem('auth_token', data.token);
      handleUserUpdated(data.user);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    setToken(null);
    handleUserUpdated(null);
    localStorage.removeItem('auth_token');
    setSuccessMessage('Вы вышли из системы');
    setActiveTab('shift');
  }

  const isLoggedIn = !!token && !!currentUser;

  /* ---------- ЭКРАН ВХОДА / РЕГИСТРАЦИИ ---------- */

  if (!isLoggedIn) {
    return (
      <div className="auth-page">
        <div className="auth-panel-wrapper">
          <div className="auth-panel">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div>
                <h6 className="mb-1 text-muted">Courier Ops</h6>
                <h4 className="fw-bold mb-0">
                  {mode === 'login' ? 'Вход' : 'Регистрация'}
                </h4>
              </div>
              <img
                src="https://cdn-icons-png.flaticon.com/512/2972/2972185.png"
                alt="Courier Icon"
                style={{ width: '40px', height: '40px' }}
              />
            </div>

            <div className="btn-group mb-4 w-100 mode-toggle" role="group">
              <button
                type="button"
                className={`btn ${
                  mode === 'login' ? 'btn-primary' : 'btn-outline-primary'
                }`}
                onClick={() => {
                  setMode('login');
                  resetMessages();
                }}
              >
                Вход
              </button>
              <button
                type="button"
                className={`btn ${
                  mode === 'register' ? 'btn-primary' : 'btn-outline-primary'
                }`}
                onClick={() => {
                  setMode('register');
                  resetMessages();
                }}
              >
                Регистрация
              </button>
            </div>

            {error && (
              <div className="alert alert-danger py-2 text-small" role="alert">
                {error}
              </div>
            )}
            {successMessage && (
              <div className="alert alert-success py-2 text-small" role="alert">
                {successMessage}
              </div>
            )}

            <form onSubmit={mode === 'login' ? handleLogin : handleRegister}>
              {mode === 'register' && (
                <div className="mb-3">
                  <label className="form-label">Имя</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Например, Дима"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}

              <div className="mb-3">
                <label className="form-label">Телефон</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="+7 999 888 77 66"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Пароль</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Минимум 6 символов"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="btn btn-pastel-primary w-100 mt-2"
                disabled={loading}
              >
                {loading
                  ? 'Подождите...'
                  : mode === 'login'
                  ? 'Войти'
                  : 'Зарегистрироваться'}
              </button>
            </form>

            <div className="text-small text-muted mt-3">
              Создайте аккаунт или войдите, чтобы перейти в рабочий кабинет.
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- ОБОЛОЧКА ПРИЛОЖЕНИЯ ПОСЛЕ ВХОДА ---------- */

  const avatarUrl =
    (currentUser && currentUser.avatar_url) ||
    'https://cdn-icons-png.flaticon.com/512/2202/2202112.png';

  return (
    <div className="app-shell">
      {/* Верхний bar */}
      <header className="app-header">
        <div className="app-header-left">
          <div className="app-logo-dot" />
          <div>
            <div className="app-header-title">Courier Ops</div>
            <div className="app-header-tagline">Заказы, смены и контроль нагрузки</div>
          </div>
        </div>
        <div className="app-header-right">
          <img src={avatarUrl} alt="Avatar" className="header-avatar" />
        </div>
      </header>

      <div className="app-body">
        {/* Сайдбар */}
        <aside className="app-sidebar">
          <div>
            <div className="sidebar-user-block">
              <div className="sidebar-user-name">{currentUser.name}</div>
              <div className="sidebar-user-phone">{currentUser.phone}</div>
              <div className="sidebar-role-badge">
                <span>●</span>
                <span>Роль: {currentUser.role}</span>
              </div>
            </div>

            <div className="sidebar-nav nav flex-column mt-3">
              {!isAdmin && (
                <button
                  type="button"
                  className={`nav-link ${
                    activeTab === 'shift' ? 'active' : ''
                  }`.trim()}
                  onClick={() => setActiveTab('shift')}
                >
                  <span>📍</span>
                  <span>Моя смена</span>
                </button>
              )}

              <button
                type="button"
                className={`nav-link ${
                  activeTab === 'profile' ? 'active' : ''
                }`.trim()}
                onClick={() => setActiveTab('profile')}
              >
                <span>👤</span>
                <span>Профиль</span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  className={`nav-link ${
                    activeTab === 'admin' ? 'active' : ''
                  }`.trim()}
                  onClick={() => setActiveTab('admin')}
                >
                  <span>🛠</span>
                  <span>Админ панель</span>
                </button>
              )}
            </div>
          </div>

          <div className="sidebar-footer">
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={handleLogout}
            >
              Выйти из аккаунта
            </button>
          </div>
        </aside>

        {/* Основная часть */}
        <main className="app-main">
          <div className="card main-card">
            <div className="card-body p-3 p-md-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h4 className="mb-0">
                    {activeTab === 'shift'
                      ? 'Рабочий кабинет курьера'
                      : activeTab === 'profile'
                      ? 'Профиль курьера'
                      : 'Админ панель'}
                  </h4>
                  <div className="text-small text-muted">
                    {activeTab === 'shift' &&
                      'Отслеживание смены, перерывов, блокировок и заказов'}
                    {activeTab === 'profile' &&
                      'Изменение имени и аватара, телефон зафиксирован'}
                    {activeTab === 'admin' &&
                      'Создание заказов и контроль очереди для курьеров'}
                  </div>
                </div>
              </div>

              {activeTab === 'shift' && <ShiftDashboard token={token} />}
              {activeTab === 'profile' && (
                <ProfileView
                  user={currentUser}
                  token={token}
                  onUserUpdated={handleUserUpdated}
                />
              )}
              {activeTab === 'admin' && isAdmin && (
                <AdminPanel token={token} />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ---------- КОМПОНЕНТ "МОЯ СМЕНА" ---------- */

function ShiftDashboard({ token }) {
  const [shiftData, setShiftData] = useState(null);
  const [loading, setLoading] = useState(false); // загрузка статуса смены
  const [actionLoading, setActionLoading] = useState(false); // кнопки
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  // уведомления
  const [notifications, setNotifications] = useState([]);
  const [notificationHistory, setNotificationHistory] = useState([]);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showNotificationsFloating, setShowNotificationsFloating] =
    useState(true);
  const breakSoonRef = useRef(false);
  const blockSoonRef = useRef(false);
  const nextNotificationIdRef = useRef(1);

  // заказы из orders-service
  const [orders, setOrders] = useState([]);

  // В work-service время хранится в секундах (виртуальных).
  // Для UI удобнее показывать *минуты* и (опционально) человекочитаемый формат.
  function formatDuration(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0));
    const totalMinutes = Math.floor(s / 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const human = h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
    return { totalMinutes, h, m, human };
  }

  function addNotification(title, text, type = 'info') {
    const id = nextNotificationIdRef.current++;
    const createdAt = new Date();
    const note = { id, title, text, type, createdAt };

    // в историю
    setNotificationHistory((prev) => [note, ...prev]);

    // во всплывающие тосты — только если включены
    if (showNotificationsFloating) {
      setNotifications((prev) => [...prev, note]);
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, 8000);
    }
  }

  async function loadCurrentShift() {
    if (!token) return;
    try {
      setLoading(true);
      setError('');
      const data = await getCurrentShift(token);
      setShiftData(data);

      if (data.breakSoon && !breakSoonRef.current) {
        addNotification(
          'Скоро обязательный перерыв',
          `Через ~${data.timeToBreakMinutes} мин доступ к заказам будет временно закрыт.`,
          'warning'
        );
      }
      breakSoonRef.current = !!data.breakSoon;

      if (data.blockSoon && !blockSoonRef.current) {
        addNotification(
          'Риск переработки',
          `Через ~${data.timeToBlockMinutes} мин смена будет завершена автоматически, а доступ будет ограничен.`,
          'danger'
        );
      }
      blockSoonRef.current = !!data.blockSoon;
    } catch (e) {
      console.error(e);
      setError(e.message || 'Не удалось получить состояние смены');
    } finally {
      setLoading(false);
    }
  }

  async function loadOrders() {
    if (!token) return;
    try {
      const [availableData, myData] = await Promise.all([
        getAvailableOrders(token),
        getMyOrders(token)
      ]);

      const available = availableData.orders || [];
      const mine = myData.orders || [];

      const mineWithoutNew = mine.filter((o) => o.status !== 'NEW');

      setOrders([...available, ...mineWithoutNew]);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Не удалось получить список заказов');
    }
  }

  useEffect(() => {
    loadCurrentShift();
    loadOrders();

    const intervalId = setInterval(() => {
      loadCurrentShift();
      loadOrders();
    }, 5000);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleStartShift() {
    try {
      setActionLoading(true);
      setError('');
      setInfoMessage('');
      await startShift(token);
      setInfoMessage('Смена успешно начата');
      await loadCurrentShift();
    } catch (e) {
      console.error(e);
      setError(e.message || 'Не удалось начать смену');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleEndShift() {
    try {
      setActionLoading(true);
      setError('');
      setInfoMessage('');
      const res = await endShift(token);
      setInfoMessage(res.message || 'Смена завершена');
      await loadCurrentShift();
    } catch (e) {
      console.error(e);
      setError(e.message || 'Не удалось завершить смену');
    } finally {
      setActionLoading(false);
    }
  }

  // ----- Логика заказов -----

  const activeOrder =
    orders.find((o) => o.status === 'IN_PROGRESS') || null;

  async function handleAcceptOrder(orderId) {
    if (!token) return;
    try {
      setActionLoading(true);
      setError('');
      setInfoMessage('');
      await acceptOrder(token, orderId);
      setInfoMessage('Заказ принят в работу');
      await loadOrders();
      addNotification(
        'Новый заказ взят в работу',
        'Не забудьте завершить заказ перед окончанием смены.',
        'info'
      );
    } catch (e) {
      console.error(e);
      setError(e.message || 'Не удалось принять заказ');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleFinishOrder(orderId) {
    if (!token) return;
    try {
      setActionLoading(true);
      setError('');
      setInfoMessage('');
      await completeOrder(token, orderId);
      setInfoMessage('Заказ отмечен как выполненный');
      await loadOrders();
      addNotification(
        'Заказ выполнен',
        'Система усталости теперь может отправить вас на перерыв или отдых, если вы переработали.',
        'info'
      );
    } catch (e) {
      console.error(e);
      setError(e.message || 'Не удалось завершить заказ');
    } finally {
      setActionLoading(false);
    }
  }

  const orderDestinationAddress = activeOrder
    ? activeOrder.address
    : BASE_ADDRESS;

  const rawStatus = shiftData ? shiftData.status : null;
  let status = rawStatus;
  let restDelayedByOrder = false;

  if (
    activeOrder &&
    (rawStatus === 'BREAK' || rawStatus === 'BLOCKED')
  ) {
    status = 'ACTIVE';
    restDelayedByOrder = true;
  }

  const isBreak = status === 'BREAK';
  const targetAddress = isBreak ? REST_PLACE_ADDRESS : orderDestinationAddress;

  const mapEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(
    targetAddress
  )}&output=embed`;

  const mapsRouteUrl = `https://www.google.com/maps/dir/${encodeURIComponent(
    BASE_ADDRESS
  )}/${encodeURIComponent(targetAddress)}`;

  let title = 'Статус смены';
  let statusBadge = null;
  let mainText = null;
  let secondaryText = [];
  let canStart = false;
  let canEnd = false;

  if (status === 'ACTIVE') {
    title = 'Смена активна';
    statusBadge = <span className="badge bg-success">ACTIVE</span>;

    const work = formatDuration(shiftData?.workSeconds);
    mainText = 'Вы сейчас на смене.';
    secondaryText.push(
      `Отработано: ${work.totalMinutes} мин${work.totalMinutes >= 60 ? ` (≈ ${work.human})` : ''}.`
    );
    if (shiftData?.timeToBreakMinutes != null) {
      secondaryText.push(
        `До обязательного перерыва: около ${shiftData.timeToBreakMinutes} мин.`
      );
    }
    if (shiftData?.timeToBlockMinutes != null) {
      secondaryText.push(
        `До ограничения из-за переработки: ~ ${shiftData.timeToBlockMinutes} мин.`
      );
    }
    if (activeOrder) {
      secondaryText.push(
        'Во время выполнения заказа вы сначала сдаёте заказ, и только потом система может отправить вас на перерыв или отдых.'
      );
    }
    if (restDelayedByOrder) {
      secondaryText.push(
        'Система уже считает, что вам нужен отдых, но он будет применён сразу после завершения текущего заказа.'
      );
    }

    canEnd = true;
  } else if (status === 'BREAK') {
    title = 'Обязательный перерыв';
    statusBadge = <span className="badge bg-warning text-dark">BREAK</span>;
    const br = formatDuration(shiftData?.breakSeconds);
    mainText = `Сейчас идёт обязательный перерыв. Отдых: ${br.totalMinutes} мин${br.totalMinutes >= 60 ? ` (≈ ${br.human})` : ''}.`;
    secondaryText = [
      'Во время перерыва заказы недоступны.',
      'После окончания перерыва смена автоматически вернётся в статус ACTIVE.'
    ];
    canEnd = true;
  } else if (status === 'BLOCKED') {
    title = 'Вы заблокированы для работы';
    statusBadge = <span className="badge bg-danger">BLOCKED</span>;
    mainText = 'Вы слишком долго работали и временно заблокированы.';
    const blockedUntilText = shiftData?.blockedUntil
      ? new Date(shiftData.blockedUntil).toLocaleString()
      : null;
    if (blockedUntilText) {
      secondaryText.push(`Доступ к сменам будет открыт после: ${blockedUntilText}.`);
    }
    if (shiftData?.blockedMinutesLeft != null) {
      secondaryText.push(
        `Осталось примерно ${shiftData.blockedMinutesLeft} мин отдыха.`
      );
    }
  } else if (status === 'OUT_OF_SHIFT' || !status) {
    title = 'Вы сейчас не на смене';
    statusBadge = <span className="badge bg-secondary">OUT OF SHIFT</span>;
    mainText = 'Чтобы начать работать курьером, запустите новую смену.';
    secondaryText = ['Во время отсутствия смены заказы не приходят.'];
    canStart = true;
  }

  const canEndShiftButton = canEnd && !activeOrder;

  const statusPanelVariant =
    status === 'ACTIVE'
      ? 'status-panel--active'
      : status === 'BREAK'
      ? 'status-panel--break'
      : status === 'BLOCKED'
      ? 'status-panel--blocked'
      : 'status-panel--out';

  const workMetric = shiftData ? formatDuration(shiftData.workSeconds) : null;
  const breakMetric = shiftData ? formatDuration(shiftData.breakSeconds) : null;

  return (
    <div className="position-relative">
      {showNotificationModal && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center notification-modal-backdrop">
          <div className="card bg-white shadow-lg notification-modal-card">
            <div className="card-body p-3 p-md-4">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="mb-0">Уведомления</h5>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setShowNotificationModal(false)}
                >
                  ✕
                </button>
              </div>
              <div className="text-small text-muted mb-2">
                Здесь сохраняются все уведомления о перерывах, блокировках и заказах
                за текущую сессию.
              </div>

              <div className="form-check form-switch mb-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="toggleFloatingNotifications"
                  checked={showNotificationsFloating}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setShowNotificationsFloating(enabled);
                    if (!enabled) {
                      setNotifications([]);
                    }
                  }}
                />
                <label
                  className="form-check-label text-small"
                  htmlFor="toggleFloatingNotifications"
                >
                  Показывать всплывающие уведомления в правом верхнем углу
                </label>
              </div>

              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="text-small text-muted">
                  {notificationHistory.length === 0
                    ? 'История пуста'
                    : `Всего уведомлений: ${notificationHistory.length}`}
                </span>
                {notificationHistory.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => {
                      setNotificationHistory([]);
                      setNotifications([]);
                    }}
                  >
                    Очистить
                  </button>
                )}
              </div>

              <div className="notification-history-scroll mt-2">
                {notificationHistory.length === 0 ? (
                  <div className="text-small text-muted">
                    У вас пока не было уведомлений.
                  </div>
                ) : (
                  notificationHistory.map((note) => (
                    <div
                      key={note.id}
                      className="border rounded-3 p-2 mb-2 bg-light"
                    >
                      <div className="d-flex justify-content-between mb-1">
                        <strong className="text-small">{note.title}</strong>
                        <span className="text-small text-muted">
                          {note.createdAt.toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-small">{note.text}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showNotificationsFloating && (
        <div className="notification-stack position-absolute top-0 end-0 p-2">
          {notifications.map((n) => {
            let bg = '#e0f2fe';
            if (n.type === 'warning') bg = '#fef3c7';
            if (n.type === 'danger') bg = '#fee2e2';

            return (
              <div
                key={n.id}
                className="toast show mb-2 position-relative"
                style={{
                  minWidth: '260px',
                  background: bg
                }}
              >
                <div className="toast-body">
                  <strong className="d-block mb-1">{n.title}</strong>
                  <span className="text-small">{n.text}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="alert alert-danger py-2 text-small mt-1" role="alert">
          {error}
        </div>
      )}
      {infoMessage && (
        <div className="alert alert-success py-2 text-small mt-1" role="alert">
          {infoMessage}
        </div>
      )}

      <div className="d-flex justify-content-end mb-2">
        <button
          className="btn btn-outline-secondary btn-sm btn-bell"
          type="button"
          onClick={() => setShowNotificationModal(true)}
        >
          🔔 История уведомлений
        </button>
      </div>

      <div className="p-3 p-md-4 rounded-4 shift-card-inner">
        <div className="row g-3">
          <div className="col-lg-8 col-md-7">
            <div className={`status-panel ${statusPanelVariant}`}>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="mb-0">{title}</h5>
                {statusBadge}
              </div>

              {loading && !shiftData && (
                <div className="text-small text-muted">Загрузка состояния смены...</div>
              )}

              {shiftData && (
                <>
                  <p className="mb-1">{mainText}</p>

                  {secondaryText && secondaryText.length > 0 && (
                    <ul className="mb-2 text-small text-muted">
                      {secondaryText.map((t, idx) => (
                        <li key={idx}>{t}</li>
                      ))}
                    </ul>
                  )}

                  <div className="metric-row mt-3">
                    <div className="metric-card">
                      <div className="metric-label">Работа</div>
                      <div className="metric-value">
                        {workMetric ? `${workMetric.totalMinutes} мин` : '—'}
                      </div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Перерыв</div>
                      <div className="metric-value">
                        {breakMetric ? `${breakMetric.totalMinutes} мин` : '—'}
                      </div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">
                        {status === 'ACTIVE'
                          ? 'До перерыва'
                          : status === 'BLOCKED'
                          ? 'До разблокировки'
                          : 'Статус'}
                      </div>
                      <div className="metric-value">
                        {status === 'ACTIVE'
                          ? shiftData?.timeToBreakMinutes != null
                            ? `${shiftData.timeToBreakMinutes} мин`
                            : '—'
                          : status === 'BLOCKED'
                          ? shiftData?.blockedMinutesLeft != null
                            ? `${shiftData.blockedMinutesLeft} мин`
                            : '—'
                          : status}
                      </div>
                    </div>
                  </div>

                  {activeOrder && (
                    <div className="alert alert-info py-2 text-small mt-3 mb-0">
                      Текущий заказ: <strong>{activeOrder.address}</strong>, оплата{' '}
                      <strong>{activeOrder.payout} ₽</strong>, ориентировочно{' '}
                      {activeOrder.etaMinutes} мин в пути.
                    </div>
                  )}

                  <div className="d-flex flex-wrap gap-2 mt-3">
                    {canStart && (
                      <button
                        className="btn btn-pastel-primary"
                        onClick={handleStartShift}
                        disabled={actionLoading}
                      >
                        {actionLoading ? 'Запуск...' : 'Начать смену'}
                      </button>
                    )}

                    {canEndShiftButton && (
                      <button
                        className="btn btn-outline-danger"
                        onClick={handleEndShift}
                        disabled={actionLoading}
                      >
                        {actionLoading ? 'Завершение...' : 'Завершить смену'}
                      </button>
                    )}

                    {!canEndShiftButton && canEnd && activeOrder && (
                      <button
                        className="btn btn-outline-danger"
                        disabled
                        title="Сначала завершите текущий заказ"
                      >
                        Завершить смену (недоступно — есть заказ)
                      </button>
                    )}
                  </div>
                </>
              )}

              {!shiftData && !loading && (
                <div className="text-small text-muted mt-2">
                  Нет данных о смене. Ожидайте автоматического обновления.
                </div>
              )}
            </div>
          </div>

          <div className="col-lg-4 col-md-5">
            <div className="map-card p-3 h-100 bg-white">
              <h6 className="mb-2">
                {isBreak ? 'Карта отдыха' : 'Карта маршрута'}
              </h6>
              <div
                className="rounded-4 overflow-hidden mb-2"
                style={{
                  height: '260px',
                  border: '1px solid rgba(148,163,184,0.4)'
                }}
              >
                <iframe
                  title="map"
                  src={mapEmbedUrl}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                ></iframe>
              </div>
              <p className="text-small mb-1">
                База компании: <strong>{BASE_ADDRESS}</strong>
              </p>
              <p className="text-small mb-1">
                {isBreak ? (
                  <>
                    Рекомендованное место отдыха:{' '}
                    <strong>{REST_PLACE_ADDRESS}</strong>
                  </>
                ) : (
                  <>
                    Адрес доставки:{' '}
                    <strong>
                      {activeOrder
                        ? activeOrder.address
                        : 'нет активного заказа — карта показывает базу'}
                    </strong>
                  </>
                )}
              </p>
              <p className="text-small mb-2">
                Маршрут можно открыть во внешней карте:
              </p>
              <a
                href={mapsRouteUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline-primary btn-sm mb-3"
              >
                Открыть маршрут в Google Maps
              </a>

              {isBreak ? (
                <div className="mt-2">
                  <h6 className="mb-2">Где можно отдохнуть</h6>
                  <p className="text-small mb-3">
                    Во время перерыва сервис подсказывает несколько спокойных мест в
                    Астрахани, где можно размяться, посидеть и снизить нагрузку.
                  </p>

                  <div className="row g-2 mb-2">
                    {ASTRAKHAN_PARKS.map((park) => (
                      <div key={park.id} className="col-12">
                        <div className="d-flex gap-2 align-items-stretch rounded-4 border bg-white overflow-hidden">
                          <div style={{ flex: '0 0 36%', maxWidth: '36%' }}>
                            <img
                              src={park.imageUrl}
                              alt={park.name}
                              className="w-100 h-100"
                              style={{ objectFit: 'cover' }}
                            />
                          </div>
                          <div className="p-2" style={{ flex: '1 1 auto' }}>
                            <div className="fw-semibold text-small mb-1">
                              {park.name}
                            </div>
                            <div className="text-small text-muted mb-2">
                              {park.description}
                            </div>
                            <a
                              href={`https://www.google.com/maps/search/${encodeURIComponent(
                                park.mapsQuery
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-outline-success btn-sm"
                            >
                              Открыть на карте
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-small text-muted mb-1">
                    Совет: даже короткий выход из плотного городского потока снижает
                    когнитивную нагрузку и риск ошибок при следующем заказе.
                  </p>
                </div>
              ) : (
                <>
                  <hr className="my-2" />
                  <h6 className="mb-2">Доступные заказы</h6>
                  <ul className="list-group list-group-flush text-small">
                    {orders.map((o) => (
                      <li
                        key={o.id}
                        className="list-group-item px-0 py-2 d-flex justify-content-between align-items-start"
                      >
                        <div>
                          <div className="fw-semibold">{o.address}</div>
                          <div className="text-muted">
                            Оплата: {o.payout} ₽ · ~{o.etaMinutes} мин
                          </div>
                          <div className="text-muted">
                            Статус:{' '}
                            {o.status === 'NEW' && 'новый'}
                            {o.status === 'IN_PROGRESS' && 'выполняется'}
                            {o.status === 'DONE' && 'выполнен'}
                          </div>
                        </div>
                        <div className="ms-2">
                          {o.status === 'NEW' && (
                            <button
                              className="btn btn-sm btn-pastel-primary"
                              disabled={!!activeOrder || status !== 'ACTIVE'}
                              onClick={() => handleAcceptOrder(o.id)}
                            >
                              Принять
                            </button>
                          )}
                          {o.status === 'IN_PROGRESS' && (
                            <button
                              className="btn btn-sm btn-outline-success"
                              onClick={() => handleFinishOrder(o.id)}
                            >
                              Завершить
                            </button>
                          )}
                          {o.status === 'DONE' && (
                            <span className="badge bg-success mt-1">Готово</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- ПРОФИЛЬ ---------- */

function ProfileView({ user, token, onUserUpdated }) {
  const [editName, setEditName] = useState(user?.name || '');
  const [editAvatarUrl, setEditAvatarUrl] = useState(user?.avatar_url || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setEditName(user?.name || '');
    setEditAvatarUrl(user?.avatar_url || '');
  }, [user]);

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!editName && !editAvatarUrl) {
      setError('Нет данных для обновления');
      return;
    }

    try {
      setSaving(true);
      const data = await updateProfile(token, {
        name: editName,
        avatarUrl: editAvatarUrl
      });
      onUserUpdated(data.user);
      setMessage('Профиль обновлён');
    } catch (e) {
      console.error(e);
      setError(e.message || 'Не удалось обновить профиль');
    } finally {
      setSaving(false);
    }
  }

  const previewAvatar =
    editAvatarUrl ||
    user?.avatar_url ||
    'https://cdn-icons-png.flaticon.com/512/2202/2202112.png';

  return (
    <div className="p-3 p-md-4 rounded-4 profile-card-inner">
      <h5 className="mb-3">Профиль курьера</h5>

      <div className="row g-3">
        <div className="col-md-4 d-flex flex-column align-items-center">
          <img
            src={previewAvatar}
            alt="Avatar preview"
            className="avatar-circle mb-2"
          />
          <div className="text-small text-muted text-center">
            Аватар отображается в кабинете курьера и в верхнем баре.
          </div>
        </div>
        <div className="col-md-8">
          {error && (
            <div className="alert alert-danger py-2 text-small" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="alert alert-success py-2 text-small" role="alert">
              {message}
            </div>
          )}

          <form onSubmit={handleSave}>
            <div className="mb-3">
              <label className="form-label">Имя</label>
              <input
                type="text"
                className="form-control"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Ваше имя"
              />
            </div>

            <div className="mb-3">
              <label className="form-label">
                Телефон (используется для входа, нельзя изменить)
              </label>
              <input
                type="text"
                className="form-control"
                value={user.phone}
                disabled
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Ссылка на аватар</label>
              <input
                type="text"
                className="form-control"
                value={editAvatarUrl}
                onChange={(e) => setEditAvatarUrl(e.target.value)}
                placeholder="https://пример.сайт/avatar.png"
              />
              <div className="form-text text-small">
                Можно использовать любую публичную картинку из интернета.
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-pastel-primary"
              disabled={saving}
            >
              {saving ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ---------- АДМИН-ПАНЕЛЬ ---------- */

function AdminPanel({ token }) {
  const [adminTab, setAdminTab] = useState('orders'); // orders | couriers

  // ---- Orders
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ---- Couriers
  const [couriers, setCouriers] = useState([]);
  const [couriersLoading, setCouriersLoading] = useState(false);
  const [timeFactor, setTimeFactor] = useState(60);

  // ---- Form: Create order
  const [address, setAddress] = useState('');
  const [payout, setPayout] = useState('');
  const [etaMinutes, setEtaMinutes] = useState('');
  const [selectedGeo, setSelectedGeo] = useState(null); // { displayName, lat, lng }
  const [basePoint, setBasePoint] = useState({ lat: 46.3497, lng: 48.0408 });
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Инициализация базы: пытаемся получить координаты BASE_ADDRESS один раз,
  // чтобы карта при создании заказа сразу показывала базу.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await geoSearchAddress(BASE_ADDRESS);
        const first = data?.results?.[0];
        if (!cancelled && first) {
          setBasePoint({ lat: first.lat, lng: first.lng });
        }
      } catch (e) {
        // молча: есть fallback-координаты
        console.error('BASE_ADDRESS geocode failed:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadOrders = useCallback(async () => {
    if (!token) return;
    try {
      setOrdersLoading(true);
      setError('');
      const data = await adminGetOrders(token);
      setOrders(data.orders || []);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Не удалось получить заказы');
    } finally {
      setOrdersLoading(false);
    }
  }, [token]);

  const loadCouriers = useCallback(async () => {
    if (!token) return;
    try {
      setCouriersLoading(true);
      setError('');
      const data = await adminGetCouriers(token);
      setCouriers(data.couriers || []);
      if (data.timeAccelerationFactor) {
        setTimeFactor(data.timeAccelerationFactor);
      }
    } catch (e) {
      console.error(e);
      setError(e.message || 'Не удалось получить курьеров');
    } finally {
      setCouriersLoading(false);
    }
  }, [token]);

  function formatMinutes(min) {
    const m = Math.max(0, Math.floor(Number(min || 0)));
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const mm = m % 60;
      return `${m} мин (≈ ${h} ч ${mm} мин)`;
    }
    return `${m} мин`;
  }

  async function handleBlockCourier(courier) {
    const reason = window.prompt('Причина блокировки (необязательно):', courier?.blocked_reason || '') || '';
    try {
      setError('');
      setMessage('');
      await adminBlockUser(token, courier.id, { reason });
      setMessage('Курьер заблокирован');
      await loadCouriers();
    } catch (e) {
      console.error(e);
      setError(e.message || 'Не удалось заблокировать курьера');
    }
  }

  async function handleUnblockCourier(courier) {
    try {
      setError('');
      setMessage('');
      await adminUnblockUser(token, courier.id);
      setMessage('Курьер разблокирован');
      await loadCouriers();
    } catch (e) {
      console.error(e);
      setError(e.message || 'Не удалось разблокировать курьера');
    }
  }

  async function handleDeleteCourier(courier) {
    if (!window.confirm(`Удалить пользователя "${courier.name}"? Действие необратимо.`)) return;
    try {
      setError('');
      setMessage('');
      await adminDeleteUser(token, courier.id);
      setMessage('Пользователь удалён');
      await loadCouriers();
    } catch (e) {
      console.error(e);
      setError(e.message || 'Не удалось удалить пользователя');
    }
  }

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Auto-refresh orders too (no "Обновить" button)
  useEffect(() => {
    if (!token) return;
    if (adminTab !== 'orders') return;
    loadOrders();
    const t = setInterval(() => {
      loadOrders();
    }, 7000);
    return () => clearInterval(t);
  }, [adminTab, token, loadOrders]);

  // Auto-refresh couriers ("реальное время" без кнопки обновить)
  useEffect(() => {
    if (!token) return;
    if (adminTab !== 'couriers') return;
    loadCouriers();
    const t = setInterval(() => {
      loadCouriers();
    }, 5000);
    return () => clearInterval(t);
  }, [adminTab, token, loadCouriers]);

  // Address suggestions (debounce)
  useEffect(() => {
    const q = String(address || '').trim();
    if (adminTab !== 'orders') return;

    if (!q || q.length < 3) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      return;
    }

    const query = q.toLowerCase().includes('астрах')
      ? q
      : `Астрахань, ${q}`;

    const timer = setTimeout(async () => {
      try {
        const data = await geoSearchAddress(query);
        setSuggestions(data.results || []);
        setSuggestionsOpen(true);
      } catch (e) {
        // молча, чтобы не раздражать пользователя на каждое нажатие клавиши
        console.error('geoSearchAddress error:', e);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [address, adminTab]);

  function pickSuggestion(s) {
    setSelectedGeo(s);
    setAddress(s.displayName);
    setSuggestionsOpen(false);
    setSuggestions([]);
  }

  async function pickMapPoint({ lat, lng }) {
    // Сначала фиксируем координаты, потом пробуем получить красивый адрес.
    setSelectedGeo({ displayName: null, lat, lng });
    setSuggestionsOpen(false);
    setSuggestions([]);

    try {
      const data = await geoReverse({ lat, lng });
      const displayName = data?.result?.displayName;
      if (displayName) {
        setAddress(displayName);
        setSelectedGeo({ displayName, lat, lng });
      }
    } catch (e) {
      console.error('geoReverse error:', e);
      // адрес не обязателен, главное — координаты
    }
  }

  async function handleCreateOrder(e) {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!address || !payout || !etaMinutes) {
      setError('Заполните адрес, оплату и ожидаемое время');
      return;
    }

    if (!selectedGeo) {
      setError('Выберите точку на карте (или из подсказок), чтобы зафиксировать координаты доставки.');
      return;
    }

    const payoutNum = Number(payout);
    const etaNum = Number(etaMinutes);
    if (!Number.isFinite(payoutNum) || !Number.isFinite(etaNum)) {
      setError('Оплата и время должны быть числами');
      return;
    }

    try {
      setSaving(true);
      await adminCreateOrder(token, {
        address,
        payout: payoutNum,
        etaMinutes: etaNum,
        destLat: selectedGeo.lat,
        destLng: selectedGeo.lng
      });

      setMessage('Заказ создан');
      setAddress('');
      setPayout('');
      setEtaMinutes('');
      setSelectedGeo(null);
      setSuggestions([]);
      setSuggestionsOpen(false);
      await loadOrders();
    } catch (e) {
      console.error(e);
      setError(e.message || 'Не удалось создать заказ');
    } finally {
      setSaving(false);
    }
  }

  const mapFocusPoint = selectedGeo ? { lat: selectedGeo.lat, lng: selectedGeo.lng } : basePoint;

  function MapAutoCenter({ point }) {
    const map = useMap();
    useEffect(() => {
      if (!point) return;
      map.setView([point.lat, point.lng], 15, { animate: true });
    }, [map, point]);
    return null;
  }

  function MapClickPicker({ onPick }) {
    useMapEvents({
      click: (e) => {
        onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    });
    return null;
  }

  return (
    <div className="p-3 p-md-4 rounded-4 bg-white">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h5 className="mb-1">Админ-панель</h5>
          <div className="text-small text-muted">
            Управление заказами и мониторинг смен курьеров (обновление каждые 5 сек).
          </div>
        </div>

        <div className="btn-group" role="group" aria-label="Admin tabs">
          <button
            type="button"
            className={`btn btn-sm ${adminTab === 'orders' ? 'btn-pastel-primary' : 'btn-outline-secondary'}`}
            onClick={() => setAdminTab('orders')}
          >
            Заказы
          </button>
          <button
            type="button"
            className={`btn btn-sm ${adminTab === 'couriers' ? 'btn-pastel-primary' : 'btn-outline-secondary'}`}
            onClick={() => setAdminTab('couriers')}
          >
            Курьеры
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger py-2 text-small" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="alert alert-success py-2 text-small" role="alert">
          {message}
        </div>
      )}

      {adminTab === 'orders' && (
        <div className="row g-4">
          <div className="col-lg-4">
            <h6 className="mb-3">Создать заказ</h6>

            <form onSubmit={handleCreateOrder} autoComplete="off">
              <div className="mb-3 position-relative">
                <label className="form-label">Адрес доставки</label>
                <input
                  type="text"
                  className="form-control"
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setSelectedGeo(null);
                  }}
                  onFocus={() => {
                    if (suggestions.length > 0) setSuggestionsOpen(true);
                  }}
                  placeholder="Например: Ленина 15"
                />

                {suggestionsOpen && suggestions.length > 0 && (
                  <div className="list-group position-absolute w-100 shadow-sm" style={{ zIndex: 20 }}>
                    {suggestions.map((s, idx) => (
                      <button
                        key={`${s.lat}-${s.lng}-${idx}`}
                        type="button"
                        className="list-group-item list-group-item-action text-start"
                        onClick={() => pickSuggestion(s)}
                      >
                        <div className="fw-semibold" style={{ fontSize: 13 }}>
                          {s.displayName}
                        </div>
                        <div className="text-muted" style={{ fontSize: 12 }}>
                          {s.lat.toFixed(5)}, {s.lng.toFixed(5)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {selectedGeo && (
                  <div className="mt-2 text-small text-muted">
                    ✅ Координаты зафиксированы: {selectedGeo.lat.toFixed(5)}, {selectedGeo.lng.toFixed(5)}
                  </div>
                )}
              </div>

              <div className="mb-3">
                <div className="text-small text-muted mb-2">
                  <strong>Кликните по карте</strong> для выбора адреса доставки. Карта центрирована на Астрахани.
                </div>
                <div
                  className="rounded-4 overflow-hidden border shadow-sm"
                  style={{ height: '450px', cursor: 'crosshair' }}
                >
                  <MapContainer
                    center={[basePoint.lat, basePoint.lng]}
                    zoom={13}
                    scrollWheelZoom
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution="&copy; OpenStreetMap contributors"
                    />
                    <Marker position={[basePoint.lat, basePoint.lng]} />
                    {selectedGeo && (
                      <Marker position={[selectedGeo.lat, selectedGeo.lng]} />
                    )}
                    <MapAutoCenter point={mapFocusPoint} />
                    <MapClickPicker onPick={pickMapPoint} />
                  </MapContainer>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">Оплата (₽)</label>
                <input
                  type="number"
                  className="form-control"
                  value={payout}
                  onChange={(e) => setPayout(e.target.value)}
                  placeholder="Например, 300"
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Ожидаемое время (мин)</label>
                <input
                  type="number"
                  className="form-control"
                  value={etaMinutes}
                  onChange={(e) => setEtaMinutes(e.target.value)}
                  placeholder="Например, 25"
                />
              </div>

              <button
                type="submit"
                className="btn btn-pastel-primary w-100"
                disabled={saving}
              >
                {saving ? 'Создание...' : 'Создать заказ'}
              </button>
            </form>

            <p className="text-small text-muted mt-3 mb-0">
              Выбирайте доставку подсказками или кликом на карте — координаты будут сохранены вместе с заказом.
            </p>
          </div>

          <div className="col-lg-8">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
              <h6 className="mb-0">Все заказы</h6>
              <div className="text-small text-muted">
                Автообновление каждые ~7 сек
              </div>
            </div>



            {ordersLoading ? (
              <div className="text-small text-muted">Загрузка заказов...</div>
            ) : orders.length === 0 ? (
              <div className="text-small text-muted">Заказов пока нет.</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm align-middle">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Адрес</th>
                      <th>Оплата</th>
                      <th>ETA</th>
                      <th>Коорд.</th>
                      <th>Статус</th>
                      <th>Курьер</th>
                      <th>Создан</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td>{o.id}</td>
                        <td style={{ maxWidth: 260 }}>
                          <div className="text-truncate" title={o.address}>
                            {o.address}
                          </div>
                        </td>
                        <td>{o.payout} ₽</td>
                        <td>{o.etaMinutes} мин</td>
                        <td>
                          {o.destLat && o.destLng ? (
                            <span className="badge text-bg-success">OK</span>
                          ) : (
                            <span className="badge text-bg-secondary">—</span>
                          )}
                        </td>
                        <td>{o.status}</td>
                        <td>{o.courierId || '—'}</td>
                        <td>
                          {o.createdAt
                            ? new Date(o.createdAt).toLocaleString()
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {adminTab === 'couriers' && (
        <div>
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
            <h6 className="mb-0">Курьеры и время смен</h6>
            <div className="text-small text-muted">
              Масштаб времени: <span className="fw-semibold">{timeFactor}×</span>
            </div>
          </div>

          {couriersLoading ? (
            <div className="text-small text-muted">Загрузка курьеров...</div>
          ) : couriers.length === 0 ? (
            <div className="text-small text-muted">Пользователей пока нет.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>Пользователь</th>
                    <th>Аккаунт</th>
                    <th>Смена</th>
                    <th>Работа</th>
                    <th>Перерыв</th>
                    <th>Блокировка</th>
                    <th>Старт смены</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {couriers.map((c) => {
                    const s = c.shift;
                    const shiftStatus = s?.status || '—';
                    const shiftStatusClass =
                      shiftStatus === 'ACTIVE'
                        ? 'text-bg-success'
                        : shiftStatus === 'BREAK'
                        ? 'text-bg-warning'
                        : shiftStatus === 'BLOCKED'
                        ? 'text-bg-danger'
                        : 'text-bg-secondary';

                    return (
                      <tr key={c.id}>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <img
                              src={c.avatar_url || 'https://cdn-icons-png.flaticon.com/512/847/847969.png'}
                              alt="avatar"
                              style={{ width: 34, height: 34, borderRadius: 12, objectFit: 'cover' }}
                            />
                            <div>
                              <div className="fw-semibold" style={{ lineHeight: 1.1 }}>
                                {c.name}
                              </div>
                              <div className="text-muted" style={{ fontSize: 12 }}>
                                {c.phone}
                              </div>
                              <div className="text-muted" style={{ fontSize: 12 }}>
                                роль: {c.role}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>
                          {c.is_blocked ? (
                            <span
                              className="badge text-bg-danger"
                              title={c.blocked_reason || 'Заблокирован'}
                            >
                              BLOCKED
                            </span>
                          ) : (
                            <span className="badge text-bg-success">OK</span>
                          )}
                          {c.blocked_reason && (
                            <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>
                              {c.blocked_reason}
                            </div>
                          )}
                        </td>

                        <td>
                          <span className={`badge ${shiftStatusClass}`}>{shiftStatus}</span>
                        </td>

                        <td>{s ? formatMinutes(s.work_minutes) : '—'}</td>
                        <td>{s ? formatMinutes(s.break_minutes) : '—'}</td>
                        <td>
                          {s?.blocked_until ? new Date(s.blocked_until).toLocaleString() : '—'}
                        </td>
                        <td>
                          {s?.started_at ? new Date(s.started_at).toLocaleString() : '—'}
                        </td>
                        <td>
                          <div className="d-flex flex-wrap gap-2">
                            {c.role !== 'admin' && (
                              <>
                                {c.is_blocked ? (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-success"
                                    onClick={() => handleUnblockCourier(c)}
                                  >
                                    Разблокировать
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-warning"
                                    onClick={() => handleBlockCourier(c)}
                                  >
                                    Заблокировать
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => handleDeleteCourier(c)}
                                >
                                  Удалить
                                </button>
                              </>
                            )}
                            {c.role === 'admin' && (
                              <span className="text-muted" style={{ fontSize: 12 }}>
                                действия недоступны
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
