import { useState, useEffect } from 'react';
import { getLanguageLink, getLocalizedPath, translations, saveLanguagePreference } from '../lib/i18n';
import { useAuthSession } from '../lib/useAuthSession';
import { useNotifications } from '../lib/useNotifications';
import { getProfileWithFallback } from '../lib/profile';
import { useTheme } from '../lib/useTheme';
import { 
  NotificationBell, 
  NotificationDropdown, 
  NotificationContainer 
} from './Notifications';
import { ThemeToggle } from './ThemeToggle';

function LanguageToggle({ language }) {
  const nextLanguage = language === 'ar' ? 'en' : 'ar';

  const handleClick = () => {
    saveLanguagePreference(nextLanguage);
  };

  return (
    <a 
      className="Language-toggle" 
      href={getLanguageLink(nextLanguage)} 
      lang={nextLanguage}
      onClick={handleClick}
    >
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
    <a className="Home-button" href={getLocalizedPath('/', language)} aria-label={translations[language].backHome}>
      <svg viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 6V15H6V11C6 9.89543 6.89543 9 8 9C9.10457 9 10 9.89543 10 11V15H15V6L8 0L1 6Z"/>
      </svg>
    </a>
  );
}

export default function PageShell({ language, children }) {
  const { session } = useAuthSession();
  const userId = session?.user?.id;
  const { theme, setTheme } = useTheme();
  
  const [showNotifications, setShowNotifications] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [profile, setProfile] = useState(null);
  
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotifications(userId);

  useEffect(() => {
    async function loadProfile() {
      if (session) {
        try {
          const userProfile = await getProfileWithFallback(session.user.id, session.user.email);
          setProfile(userProfile);
        } catch (error) {
          console.error('Error loading profile:', error);
        }
      }
    }
    loadProfile();
  }, [session]);

  // Automatically show toasts for unread notifications
  useEffect(() => {
    if (!notifications || notifications.length === 0) return;
    
    try {
      // Get previously shown notification IDs from localStorage
      let shownNotifications = JSON.parse(localStorage.getItem('shownNotifications') || '[]');
      
      // Clean up old notification IDs (keep only last 100 to prevent localStorage bloat)
      if (shownNotifications.length > 100) {
        shownNotifications = shownNotifications.slice(-100);
      }
      
      // Show toasts only for new unread notifications
      notifications.forEach(notification => {
        if (!notification.read && !shownNotifications.includes(notification.id) && !toasts.find(t => t.notification.id === notification.id)) {
          addToast(notification);
          
          // Mark this notification as shown
          shownNotifications.push(notification.id);
        }
      });
      
      // Update localStorage with new shown notifications
      localStorage.setItem('shownNotifications', JSON.stringify(shownNotifications));
    } catch (error) {
      console.error('Error managing notification toasts:', error);
    }
  }, [notifications]);

  const addToast = (notification) => {
    const toastId = `${notification.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts(prev => [...prev, { id: toastId, notification }]);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toastId));
    }, 10000);
  };

  const removeToast = (toastId) => {
    setToasts(prev => prev.filter(t => t.id !== toastId));
  };

  return (
    <div className="App" dir={language === 'ar' ? 'rtl' : 'ltr'} lang={language}>
      <main className="App-shell">
        <div className="Header-controls">
          <LanguageToggle language={language} />
          <ThemeToggle theme={theme} setTheme={setTheme} language={language} />
          
          {/* Notification Bell */}
          {userId && (
            <div className="Notification-header-wrapper">
              <NotificationBell 
                unreadCount={unreadCount} 
                onClick={() => setShowNotifications(!showNotifications)}
                language={language}
              />
              
              {showNotifications && (
                <NotificationDropdown
                  notifications={notifications}
                  unreadCount={unreadCount}
                  onMarkAsRead={markAsRead}
                  onMarkAllAsRead={markAllAsRead}
                  onDelete={deleteNotification}
                  onClose={() => setShowNotifications(false)}
                  userRole={profile?.role}
                  language={language}
                />
              )}
            </div>
          )}
        </div>
        <HomeButton language={language} />
        
        {children}
        
        {/* Footer with Support Link */}
        <footer className="App-footer">
          <a href={getLocalizedPath('/support', language)} className="Footer-link">
            {translations[language].support}
          </a>
        </footer>
        
        {/* Toast Container */}
        <NotificationContainer 
          toasts={toasts} 
          removeToast={removeToast}
          language={language}
        />
      </main>
    </div>
  );
}
