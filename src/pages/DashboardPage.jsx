import PageShell from '../components/PageShell';
import { getLocalizedPath, translations } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { useAuthSession } from '../lib/useAuthSession';

export default function DashboardPage({ language }) {
  const copy = translations[language];
  const { session, loading } = useAuthSession();

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = getLocalizedPath('/', language);
  }

  if (loading) {
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

  const userMetadata = session.user.user_metadata || {};
  const fullName = userMetadata.full_name || copy.unknown;
  const accountType = userMetadata.account_type || copy.unknown;
  const email = session.user.email;

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
            <span className="Dashboard-info-label">{copy.accountTypeLabel}:</span>
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