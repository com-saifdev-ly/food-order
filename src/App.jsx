import { useEffect, useState } from 'react';
import './App.css';
import PageShell from './components/PageShell';
import {
  confirmAuthSession,
  getAuthCallbackDisplayState,
} from './lib/authCallback';
import { getLanguage, getLocalizedPath, translations } from './lib/i18n';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import DashboardPage from './pages/DashboardPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import { supabase } from './lib/supabase';
import { useAuthSession } from './lib/useAuthSession';
import { Analytics } from '@vercel/analytics/react';

export { getLanguage } from './lib/i18n';

function StatusIcon({ status }) {
  if (status === 'success') {
    return (
      <span className="Status-icon Status-icon--success" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
    );
  }

  if (status === 'error') {
    return (
      <span className="Status-icon Status-icon--error" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M12 8v5" />
          <path d="M12 17h.01" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      </span>
    );
  }

  return null;
}

function AuthCallback({ language }) {
  const copy = translations[language];
  const [callbackState, setCallbackState] = useState(() =>
    getAuthCallbackDisplayState({ status: 'pending' }, language, translations),
  );

  useEffect(() => {
    let cancelled = false;

    async function verifyEmailConfirmation() {
      const result = await confirmAuthSession(supabase, window.location);

      if (!cancelled) {
        setCallbackState(getAuthCallbackDisplayState(result, language, translations));
      }
    }

    verifyEmailConfirmation();

    return () => {
      cancelled = true;
    };
  }, [language]);

  return (
    <PageShell language={language}>
      <section className={`Hero-card Callback-card Callback-card--${callbackState.status}`}>
        <p className="Eyebrow">{copy.accountEyebrow}</p>
        <div className="Callback-title">
          <StatusIcon status={callbackState.status} />
          <h1>{callbackState.title}</h1>
        </div>
        <p className="Callback-message">{callbackState.message}</p>

        <div className="Action-row">
          {callbackState.status === 'success' ? (
            <a className="Primary-btn" href={getLocalizedPath('/auth/sign-in', language)}>
              {copy.signIn}
            </a>
          ) : null}
          <a className="Secondary-link" href={getLocalizedPath('/', language)}>
            {copy.backHome}
          </a>
        </div>
      </section>
    </PageShell>
  );
}

function HomePage({ language }) {
  const copy = translations[language];
  const { session, loading } = useAuthSession();
  const [showDownloads, setShowDownloads] = useState(false);

  // Redirect to dashboard if already authenticated
  if (!loading && session) {
    window.location.href = getLocalizedPath('/dashboard', language);
    return null;
  }

  return (
    <PageShell language={language}>
      <section className="Hero-card">
        <p className="Eyebrow">{copy.homeEyebrow}</p>
        <h1>{copy.homeTitle}</h1>

        <div className="Action-row">
          <a className="Primary-btn" href={getLocalizedPath('/auth/sign-in', language)}>
            {copy.signIn}
          </a>
          <a className="Secondary-link" href={getLocalizedPath('/auth/sign-up', language)}>
            {copy.signUp}
          </a>
        </div>

        <div className="Action-row">
          <button 
            type="button" 
            className="Primary-btn" 
            onClick={() => setShowDownloads(!showDownloads)}
          >
            {copy.downloadApp}
          </button>
        </div>

        {showDownloads && (
          <div className="Download-grid">
            {copy.platforms.map((platform) => (
              <button key={platform} type="button" className="Download-btn" onClick={(event) => event.preventDefault()}>
                {platform}
              </button>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}

function App() {
  const language = getLanguage();
  const { pathname } = window.location;

  if (pathname === '/auth/callback') {
    return (
      <>
        <AuthCallback language={language} />
        <Analytics />
      </>
    );
  }

  if (pathname === '/auth/sign-in') {
    return (
      <>
        <SignInPage language={language} />
        <Analytics />
      </>
    );
  }

  if (pathname === '/auth/sign-up') {
    return (
      <>
        <SignUpPage language={language} />
        <Analytics />
      </>
    );
  }

  if (pathname === '/reset-password') {
    return (
      <>
        <ResetPasswordPage language={language} />
        <Analytics />
      </>
    );
  }

  if (pathname === '/dashboard') {
    return (
      <>
        <DashboardPage language={language} />
        <Analytics />
      </>
    );
  }

  return (
    <>
      <HomePage language={language} />
      <Analytics />
    </>
  );
}

export default App;