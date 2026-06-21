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
import CustomerDashboardPage from './pages/CustomerDashboardPage';
import DriverDashboardPage from './pages/DriverDashboardPage';
import CreateOrderPage from './pages/CreateOrderPage';
import EditOrderPage from './pages/EditOrderPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import DeliveryNetworkPage from './pages/DeliveryNetworkPage';
import AvailableOrdersPage from './pages/AvailableOrdersPage';
import MyDeliveriesPage from './pages/MyDeliveriesPage';
import DeliveryOrderDetailPage from './pages/DeliveryOrderDetailPage';
import DeliveryRequestsPage from './pages/DeliveryRequestsPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import PasswordResetRequestPage from './pages/PasswordResetRequestPage';
import SupportPage from './pages/SupportPage';
import CalculateOrdersPricePage from './pages/CalculateOrdersPricePage';
import { supabase } from './lib/supabase';
import { useAuthSession } from './lib/useAuthSession';
import { getProfileWithFallback } from './lib/profile';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';


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
  const [showDownloads, setShowDownloads] = useState(false);

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
  const { session, loading: authLoading } = useAuthSession();
  const { pathname } = window.location;

  // Immediate redirect for authenticated users - no rendering at all
  if (!authLoading && session) {
    const userRole = session.user.user_metadata?.role || 'customer';
    
    // Only redirect if on home page or auth pages
    if (pathname === '/' || pathname.startsWith('/auth/') || pathname === '/reset-password') {
      const redirectPath = userRole === 'delivery'
        ? getLocalizedPath('/driver-dashboard', language)
        : getLocalizedPath('/customer-dashboard', language);
      window.location.href = redirectPath;
      return null; // Don't render anything
    }
  }

  // Show nothing during auth loading
  if (authLoading) {
    return null;
  }

  // Check if current path is an auth page - allow these even if authenticated
  const isAuthPage = pathname === '/auth/sign-in' || 
                    pathname === '/auth/sign-up' || 
                    pathname === '/auth/callback' ||
                    pathname === '/reset-password' ||
                    pathname === '/auth/reset-password-request';

  // Redirect authenticated users away from auth pages (without profile check for speed)
  if (session && isAuthPage && pathname !== '/auth/callback') {
    // Use basic role from metadata for immediate redirect
    const userRole = session.user.user_metadata?.role || 'customer';
    const redirectPath = userRole === 'delivery' 
      ? getLocalizedPath('/driver-dashboard', language)
      : getLocalizedPath('/customer-dashboard', language);
    window.location.href = redirectPath;
    return null;
  }

  let page;
  if (pathname === '/auth/callback') {
    page = <AuthCallback language={language} />;
  } else if (pathname === '/auth/sign-in') {
    page = <SignInPage language={language} />;
  } else if (pathname === '/auth/sign-up') {
    page = <SignUpPage language={language} />;
  } else if (pathname === '/reset-password') {
    page = <ResetPasswordPage language={language} />;
  } else if (pathname === '/auth/reset-password-request') {
    page = <PasswordResetRequestPage language={language} />;
  } else if (pathname === '/customer-dashboard') {
    page = <CustomerDashboardPage language={language} />;
  } else if (pathname === '/create-order') {
    page = <CreateOrderPage language={language} />;
  } else if (pathname === '/edit-order') {
    page = <EditOrderPage language={language} />;
  } else if (pathname === '/orders') {
    page = <OrdersPage language={language} />;
  } else if (pathname === '/calculate-orders-price') {
    page = <CalculateOrdersPricePage language={language} />;
  } else if (pathname === '/order-detail') {
    page = <OrderDetailPage language={language} />;
  } else if (pathname === '/delivery-network') {
    page = <DeliveryNetworkPage language={language} />;
  } else if (pathname === '/driver-dashboard') {
    page = <DriverDashboardPage language={language} />;
  } else if (pathname === '/available-orders') {
    page = <AvailableOrdersPage language={language} />;
  } else if (pathname === '/my-deliveries') {
    page = <MyDeliveriesPage language={language} />;
  } else if (pathname === '/delivery-order-detail') {
    page = <DeliveryOrderDetailPage language={language} />;
  } else if (pathname === '/delivery-requests') {
    page = <DeliveryRequestsPage language={language} />;
  } else if (pathname === '/support') {
    page = <SupportPage language={language} />;
  } else {
    page = <HomePage language={language} />;
  }

  return (
    <>
      {page}
      <ConfirmDialog />
    return (
      <>
        <AuthCallback language={language} />
        <Analytics />
        <SpeedInsights />
      </>
    );
  }

  if (pathname === '/auth/sign-in') {
    return (
      <>
        <SignInPage language={language} />
        <Analytics />
        <SpeedInsights />
      </>
    );
  }

  if (pathname === '/auth/sign-up') {
    return (
      <>
        <SignUpPage language={language} />
        <Analytics />
        <SpeedInsights />
      </>
    );
  }

  if (pathname === '/reset-password') {
    return (
      <>
        <ResetPasswordPage language={language} />
        <Analytics />
        <SpeedInsights />
      </>
    );
  }

  if (pathname === '/dashboard') {
    return (
      <>
        <DashboardPage language={language} />
        <Analytics />
        <SpeedInsights />
      </>
    );
  }

  return (
    <>
      <HomePage language={language} />
      <Analytics />
      <SpeedInsights />
    </>
  );
}

export default App;
