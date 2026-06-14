import { useState } from 'react';
import PageShell from '../components/PageShell';
import { getLocalizedPath, translations } from '../lib/i18n';
import { supabase } from '../lib/supabase';

export default function SignInPage({ language }) {
  const copy = translations[language];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setSubmitting(false);
      return;
    }

    window.location.href = getLocalizedPath('/dashboard', language);
  }

  async function handlePasswordReset(event) {
    event.preventDefault();
    if (!email) {
      setError(copy.emailRequired);
      return;
    }
    setError('');
    setSubmitting(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (resetError) {
      setError(resetError.message);
    } else {
      setError(copy.passwordResetSent);
    }
  }

  return (
    <PageShell language={language}>
      <section className="Hero-card Auth-card">
        <p className="Eyebrow">{copy.accountEyebrow}</p>
        <h1>{copy.signInTitle}</h1>
        <p className="Auth-message">{copy.signInMessage}</p>

        <form className="Auth-form" onSubmit={handleSubmit}>
          <label className="Auth-field">
            <span>{copy.emailLabel}</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="Auth-field">
            <span>{copy.passwordLabel}</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error ? <p className="Auth-error" role="alert">{error}</p> : null}

          <div className="Action-row" style={{ justifyContent: 'flex-start' }}>
            <button 
              type="button" 
              className="Forgot-password-link"
              onClick={handlePasswordReset}
              disabled={submitting}
            >
              {copy.forgotPassword}
            </button>
          </div>

          <div className="Action-row">
            <button type="submit" className="Primary-btn" disabled={submitting}>
              {copy.submitSignIn}
            </button>
          </div>
        </form>

        <p className="Auth-switch">
          {copy.noAccount}{' '}
          <a href={getLocalizedPath('/auth/sign-up', language)}>{copy.signUp}</a>
        </p>
      </section>
    </PageShell>
  );
}