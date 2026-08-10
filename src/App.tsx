import { useEffect } from 'react';
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useAdminSession } from './hooks/useAdminSession';
import { useEventState } from './hooks/useEventState';
import { useTheme } from './hooks/useTheme';
import ThemeToggle from './components/ThemeToggle';
import type { Mode } from './lib/eventStore';
import AdminLogin from './components/AdminLogin';
import CurrentEventPage from './pages/CurrentEventPage';
import PastEventsPage from './pages/PastEventsPage';
import ArchivedEventPage from './pages/ArchivedEventPage';

const MODE_TABS: [Mode, string][] = [
  ['swiss', 'Swiss'],
  // ['single', 'Single Elim'],
  // ['double', 'Double Elim'],
];

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
  const ev = useEventState();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // The header lives above the routes, so it derives its active states from the
  // URL rather than from a `view` flag.
  const onCurrentEvent = pathname === '/';
  const onArchive =
    pathname.startsWith('/past-events') || pathname.startsWith('/event/');

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
          <div className="tk-tabs">
            {MODE_TABS.map(([k, label]) => (
              <button
                key={k}
                className={`tk-tab ${onCurrentEvent && ev.mode === k ? 'active' : ''}`}
                onClick={() => {
                  ev.setMode(k);
                  navigate('/');
                }}
              >
                {label}
              </button>
            ))}
          </div>
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
        <Route
          path="/"
          element={<CurrentEventPage ev={ev} isAdmin={isAdmin} />}
        />
        <Route path="/past-events" element={<PastEventsPage />} />
        <Route
          path="/event/:eventId"
          element={<ArchivedEventPage isAdmin={isAdmin} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
