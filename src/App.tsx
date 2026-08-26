import { useEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAdminSession } from './hooks/useAdminSession';
import { useTheme } from './hooks/useTheme';
import ThemeToggle from './components/ThemeToggle';
import AdminLogin from './components/AdminLogin';
import EventsDashboardPage from './pages/EventsDashboardPage';
import PastEventsPage from './pages/PastEventsPage';
import EventPage from './pages/EventPage';

/** The router keeps the previous scroll position; start each page at the top. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const { session, isAdmin } = useAdminSession();
  const { theme, toggleTheme } = useTheme();
  const { pathname } = useLocation();

  // The header lives above the routes, so it derives its active states from the
  // URL rather than from a `view` flag. `/event/:id` matches neither tab — it
  // can be a running event or an archived one.
  const onEvents = pathname === '/';
  const onArchive = pathname.startsWith('/past-events');

  return (
    <div className="tk-root">
      <ScrollToTop />
      <div className="tk-header">
        <div className="tk-brand">
          <img
            className="tk-logo"
            src="/logo-kekartuan.png"
            alt=""
            aria-hidden="true"
          />
          <div className="tk-title">
            Kekartuan TCG
            <small>Pairing &amp; Bracket Engine</small>
          </div>
        </div>
        <div className="tk-headright">
          <Link className={`tk-btn ghost ${onEvents ? 'active' : ''}`} to="/">
            Events
          </Link>
          <Link
            className={`tk-btn ghost ${onArchive ? 'active' : ''}`}
            to="/past-events"
          >
            Past events
          </Link>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <AdminLogin isAdmin={isAdmin} userSession={session} />
        </div>
      </div>

      <Routes>
        <Route path="/" element={<EventsDashboardPage isAdmin={isAdmin} />} />
        <Route path="/past-events" element={<PastEventsPage />} />
        <Route
          path="/event/:eventId"
          element={<EventPage isAdmin={isAdmin} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
