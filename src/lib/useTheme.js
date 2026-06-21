import { useState, useEffect } from 'react';

const THEME_KEY = 'food-order-theme';

export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    // Get saved theme or default to 'dark'
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
      return savedTheme;
    }
    return 'dark';
  });

  const [systemTheme, setSystemTheme] = useState(() => {
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  });

  useEffect(() => {
    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleChange = (e) => {
      setSystemTheme(e.matches ? 'light' : 'dark');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
  };

  const effectiveTheme = theme === 'system' ? systemTheme : theme;

  useEffect(() => {
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', effectiveTheme);
  }, [effectiveTheme]);

  return {
    theme,
    effectiveTheme,
    setTheme,
    systemTheme
  };
}