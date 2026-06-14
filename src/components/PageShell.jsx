import { getLanguageLink, getLocalizedPath, translations } from '../lib/i18n';

function LanguageToggle({ language }) {
  const nextLanguage = language === 'ar' ? 'en' : 'ar';

  return (
    <a className="Language-toggle" href={getLanguageLink(nextLanguage)} lang={nextLanguage}>
      {translations[language].switchLanguage}
    </a>
  );
}

function HomeButton({ language }) {
  const { pathname } = window.location;
  
  if (pathname === '/' || pathname === `/?lang=${language}`) {
    return null;
  }

  return (
    <a className="Home-button" href={getLocalizedPath('/', language)}>
      {translations[language].backHome}
    </a>
  );
}

export default function PageShell({ language, children }) {
  return (
    <div className="App" dir={language === 'ar' ? 'rtl' : 'ltr'} lang={language}>
      <main className="App-shell">
        <LanguageToggle language={language} />
        <HomeButton language={language} />
        {children}
      </main>
    </div>
  );
}