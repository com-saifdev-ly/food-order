import { translations } from '../lib/i18n';

export function ThemeToggle({ theme, setTheme, language = 'en' }) {
  const copy = translations[language];

  return (
    <div className="Theme-toggle">
      <button
        type="button"
        className={`Theme-toggle-btn ${theme === 'light' ? 'Theme-toggle-btn--active' : ''}`}
        onClick={() => setTheme('light')}
        aria-label={copy.themeLight}
        title={copy.themeLight}
      >
        ☀️
      </button>
      <button
        type="button"
        className={`Theme-toggle-btn ${theme === 'dark' ? 'Theme-toggle-btn--active' : ''}`}
        onClick={() => setTheme('dark')}
        aria-label={copy.themeDark}
        title={copy.themeDark}
      >
        🌙
      </button>
      <button
        type="button"
        className={`Theme-toggle-btn ${theme === 'system' ? 'Theme-toggle-btn--active' : ''}`}
        onClick={() => setTheme('system')}
        aria-label={copy.themeSystem}
        title={copy.themeSystem}
      >
        ⚙️
      </button>
    </div>
  );
}