import './App.css';

const translations = {
  en: {
    languageName: 'English',
    switchLanguage: 'العربية',
    homeEyebrow: 'Order and pick up food for your family and friends',
    homeTitle: 'Welcome to Food Order',
    downloadApp: 'Download the app',
    platforms: ['Windows', 'Linux', 'Mac', 'iOS', 'Android'],
    accountEyebrow: 'Food Order account',
    successTitle: 'Email confirmed',
    successMessage: 'Your email address has been verified. You can return to Food Order and sign in.',
    errorTitle: 'Email confirmation failed',
    pendingTitle: 'Checking confirmation link',
    pendingMessage: 'This page is ready for Supabase email confirmation links.',
    backHome: 'Back to Food Order',
  },
  ar: {
    languageName: 'العربية',
    switchLanguage: 'English',
    homeEyebrow: 'اطلب الطعام واستلمه لك ولعائلتك وأصدقائك',
    homeTitle: 'مرحباً بك في Food Order',
    downloadApp: 'تحميل التطبيق',
    platforms: ['ويندوز', 'لينكس', 'ماك', 'iOS', 'أندرويد'],
    accountEyebrow: 'حساب Food Order',
    successTitle: 'تم تأكيد البريد الإلكتروني',
    successMessage: 'تم التحقق من بريدك الإلكتروني بنجاح. يمكنك العودة إلى Food Order وتسجيل الدخول.',
    errorTitle: 'فشل تأكيد البريد الإلكتروني',
    pendingTitle: 'جار التحقق من رابط التأكيد',
    pendingMessage: 'هذه الصفحة جاهزة للتعامل مع روابط تأكيد البريد الإلكتروني من Supabase.',
    backHome: 'العودة إلى Food Order',
  },
};

function getLanguage(location = window.location) {
  const params = new URLSearchParams(location.search);
  const requestedLanguage = params.get('lang');

  if (requestedLanguage === 'ar' || requestedLanguage === 'en') {
    return requestedLanguage;
  }

  return navigator.language?.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

function readAuthParams(location) {
  const params = new URLSearchParams(location.search);
  const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
  const hashParams = new URLSearchParams(hash);

  hashParams.forEach((value, key) => {
    if (!params.has(key)) {
      params.set(key, value);
    }
  });

  return params;
}

function getLanguageLink(nextLanguage) {
  const url = new URL(window.location.href);
  url.searchParams.set('lang', nextLanguage);
  return `${url.pathname}${url.search}${url.hash}`;
}

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

function LanguageToggle({ language }) {
  const nextLanguage = language === 'ar' ? 'en' : 'ar';

  return (
    <a className="Language-toggle" href={getLanguageLink(nextLanguage)} lang={nextLanguage}>
      {translations[language].switchLanguage}
    </a>
  );
}

export function getAuthCallbackState(location = window.location, language = 'en') {
  const copy = translations[language] || translations.en;
  const params = readAuthParams(location);
  const error = params.get('error_description') || params.get('error');
  const type = params.get('type');
  const hasConfirmation = Boolean(
    params.get('code') ||
    params.get('access_token') ||
    params.get('token_hash') ||
    type === 'signup' ||
    type === 'email_change',
  );

  if (error) {
    return {
      status: 'error',
      title: copy.errorTitle,
      message: error.replace(/\+/g, ' '),
    };
  }

  if (hasConfirmation) {
    return {
      status: 'success',
      title: copy.successTitle,
      message: copy.successMessage,
    };
  }

  return {
    status: 'pending',
    title: copy.pendingTitle,
    message: copy.pendingMessage,
  };
}

function AuthCallback({ language }) {
  const copy = translations[language];
  const callbackState = getAuthCallbackState(window.location, language);

  return (
    <div className="App" dir={language === 'ar' ? 'rtl' : 'ltr'} lang={language}>
      <main className="App-shell">
        <LanguageToggle language={language} />
        <section className={`Hero-card Callback-card Callback-card--${callbackState.status}`}>
          <p className="Eyebrow">{copy.accountEyebrow}</p>
          <div className="Callback-title">
            <StatusIcon status={callbackState.status} />
            <h1>{callbackState.title}</h1>
          </div>
          <p className="Callback-message">{callbackState.message}</p>

          <div className="Action-row">
            <a className="Primary-btn" href={`/?lang=${language}`}>
              {copy.backHome}
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

function HomePage({ language }) {
  const copy = translations[language];

  return (
    <div className="App" dir={language === 'ar' ? 'rtl' : 'ltr'} lang={language}>
      <main className="App-shell">
        <LanguageToggle language={language} />
        <section className="Hero-card">
          <p className="Eyebrow">{copy.homeEyebrow}</p>
          <h1>{copy.homeTitle}</h1>

          <div className="Action-row">
            <button type="button" className="Primary-btn" onClick={(event) => event.preventDefault()}>
              {copy.downloadApp}
            </button>
          </div>

          <div className="Download-grid">
            {copy.platforms.map((platform) => (
              <button key={platform} type="button" className="Download-btn" onClick={(event) => event.preventDefault()}>
                {platform}
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function App() {
  const language = getLanguage();

  if (window.location.pathname === '/auth/callback') {
    return <AuthCallback language={language} />;
  }

  return <HomePage language={language} />;
}

export default App;
