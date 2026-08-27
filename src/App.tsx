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

// Instagram's brand gradient, drawn with an SVG paint server so the glyph picks
// up the same sweep the handle text does (see `.tk-ig` in tokens.css). App
// renders once, so the gradient id is unique in the document.
function InstagramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="url(#tk-ig-gradient)"
      strokeWidth="2"
    >
      <defs>
        <linearGradient id="tk-ig-gradient" x1="0" y1="24" x2="24" y2="0">
          <stop offset="0%" stopColor="#f58529" />
          <stop offset="55%" stopColor="#ee2a7b" />
          <stop offset="100%" stopColor="#6228d7" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle
        cx="17.5"
        cy="6.5"
        r="1"
        fill="url(#tk-ig-gradient)"
        stroke="none"
      />
    </svg>
  );
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
          <Link className="tk-logo-link" to="/" aria-label="Kekartuan TCG home">
            <img
              className="tk-logo"
              src="/logo-kekartuan.png"
              alt=""
              aria-hidden="true"
            />
          </Link>
          <div className="tk-title">
            Kekartuan TCG
            <small>Play, Collect, Connect</small>
            <a
              className="tk-ig"
              href="https://www.instagram.com/kekartuantcg/"
              target="_blank"
              rel="noreferrer"
            >
              <InstagramIcon />
              <span className="tk-ig-handle">@kekartuantcg</span>
            </a>
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
