import { useEffect, useState } from 'react';
import PageShell from '../components/PageShell';
import { getLocalizedPath, translations } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { useAuthSession } from '../lib/useAuthSession';

export default function DashboardPage({ language }) {
  const copy = translations[language];
  const { session, loading: authLoading } = useAuthSession();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUserData() {
      if (!session) return;

      try {
        // Fetch user data from Supabase auth API
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.error('Error fetching user data:', userError);
          setLoading(false);
          return;
        }

        // Get user metadata and additional user info
        const userMetadata = user.user_metadata || {};
        setUserData({
          fullName: userMetadata.full_name || user.email?.split('@')[0] || 'Unknown',
          email: user.email || 'Unknown',
          accountType: userMetadata.account_type || 'customer',
        });
        setLoading(false);
      } catch (error) {
        console.error('Error fetching user data:', error);
        setLoading(false);
      }
    }

    fetchUserData();
  }, [session]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = getLocalizedPath('/', language);
  }

  if (authLoading || loading) {
    return (
      <PageShell language={language}>
        <section className="Hero-card">
          <p className="Eyebrow">{copy.accountEyebrow}</p>
          <h1>{copy.loading}</h1>
        </section>
      </PageShell>
    );
  }

  if (!session) {
    window.location.href = getLocalizedPath('/auth/sign-in', language);
    return null;
  }

  const fullName = userData?.fullName || copy.unknown;
  const accountType = userData?.accountType || copy.unknown;
  const email = userData?.email || copy.unknown;

  return (
    <PageShell language={language}>
      <section className="Hero-card Dashboard-card">
        <p className="Eyebrow">{copy.accountEyebrow}</p>
        <h1>{copy.dashboardTitle}</h1>
        <p className="Auth-message">{copy.welcome}, {fullName}!</p>

        <div className="Dashboard-info">
          <div className="Dashboard-info-item">
            <span className="Dashboard-info-label">{copy.fullNameLabel}:</span>
            <span className="Dashboard-info-value">{fullName}</span>
          </div>
          <div className="Dashboard-info-item">
            <span className="Dashboard-info-label">{copy.emailLabel}:</span>
            <span className="Dashboard-info-value">{email}</span>
          </div>
          <div className="Dashboard-info-item">
            <span className="Dashboard-info-label">{copy.accountTypeDisplayLabel}:</span>
            <span className="Dashboard-info-value">
              {accountType === 'customer' ? copy.customer : accountType === 'delivery' ? copy.delivery : copy.unknown}
            </span>
          </div>
        </div>

        <div className="Action-row">
          <button type="button" className="Primary-btn" onClick={handleSignOut}>
            {copy.signOut}
          </button>
        </div>
      </section>
    </PageShell>
  );
}