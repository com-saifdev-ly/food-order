import { useState, useEffect } from 'react';
import PageShell from '../components/PageShell';
import { getLocalizedPath, translations } from '../lib/i18n';
import { supabase } from '../lib/supabase';

export default function ResetPasswordPage({ language }) {
  const copy = translations[language];
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [validToken, setValidToken] = useState(false);

  useEffect(() => {
    async function checkToken() {
      // Check if we have a valid session from the reset link
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setValidToken(true);
      } else {
        // Try to extract tokens from URL
        const params = new URLSearchParams(window.location.search);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          if (!error) {
            setValidToken(true);
          } else {
            setError(copy.invalidResetLink);
          }
        } else {
          setError(copy.invalidResetLink);
        }
      }
      
      setLoading(false);
    }

    checkToken();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (password.length < 6) {
      setError(copy.passwordTooShort);
      return;
    }

    if (password !== confirmPassword) {
      setError(copy.passwordMismatch);
      return;
    }

    setSubmitting(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password: password,
    });

    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    // Password updated successfully, redirect to sign in
    window.location.href = getLocalizedPath('/auth/sign-in', language);
  }

  if (loading) {
    return (
      <PageShell language={language}>
        <section className="Hero-card">

          <h1>{copy.loading}</h1>
        </section>
      </PageShell>
    );
  }

  if (!validToken) {
    return (
      <PageShell language={language}>
        <section className="Hero-card Auth-card Callback-card Callback-card--error">

          <h1>{copy.resetPasswordErrorTitle}</h1>
          <p className="Auth-message">{error || copy.invalidResetLink}</p>

          <div className="Action-row">
            <a className="Primary-btn" href={getLocalizedPath('/auth/sign-in', language)}>
              {copy.signIn}
            </a>
            <a className="Secondary-link" href={getLocalizedPath('/', language)}>
              {copy.backHome}
            </a>
          </div>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell language={language}>
      <section className="Hero-card Auth-card">

        <h1>{copy.resetPasswordTitle}</h1>
        <p className="Auth-message">{copy.resetPasswordMessage}</p>

        <form className="Auth-form" onSubmit={handleSubmit}>
          <label className="Auth-field">
            <span>{copy.passwordLabel}</span>
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <label className="Auth-field">
            <span>{copy.confirmPasswordLabel}</span>
            <input
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>

          {error ? <p className="Auth-error" role="alert">{error}</p> : null}

          <div className="Action-row">
            <button type="submit" className="Primary-btn" disabled={submitting}>
              {submitting ? copy.updatingPassword : copy.updatePassword}
            </button>
          </div>
        </form>

        <p className="Auth-switch">
          <a href={getLocalizedPath('/auth/sign-in', language)}>{copy.backToSignIn}</a>
        </p>
      </section>
    </PageShell>
  );
}