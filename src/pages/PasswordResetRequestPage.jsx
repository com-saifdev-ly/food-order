import { useState } from 'react';
import PageShell from '../components/PageShell';
import { getLocalizedPath, translations } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import TurnstileWidget from '../components/TurnstileWidget';

export default function PasswordResetRequestPage({ language }) {
  const copy = translations[language];
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileError, setTurnstileError] = useState(false);
  const [turnstileResetTrigger, setTurnstileResetTrigger] = useState(0);

  function getAuthErrorMessage(error) {
    const message = error.message?.toLowerCase() || '';

    if (message.includes('captcha')) {
      return copy.captchaVerificationFailed;
    }
    if (message.includes('invalid email')) {
      return copy.invalidEmail;
    }

    // Generic error for security
    return copy.genericAuthError;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(copy.emailInvalid);
      return;
    }

    if (!turnstileToken) {
      setError(copy.captchaVerificationFailed);
      return;
    }

    setSubmitting(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      captchaToken: turnstileToken,
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setSubmitting(false);

    if (resetError) {
      setError(getAuthErrorMessage(resetError));
      // Reset Turnstile to allow new attempt
      setTurnstileToken('');
      setTurnstileResetTrigger(prev => prev + 1);
    } else {
      setCompleted(true);
    }
  }

  if (completed) {
    return (
      <PageShell language={language}>
        <section className="Hero-card Auth-card Callback-card Callback-card--success">

          <h1>{copy.passwordResetSentTitle}</h1>
          <p className="Auth-message">
            {copy.passwordResetSent}
          </p>

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

        <h1>{copy.forgotPassword}</h1>
        <p className="Auth-message">
          {copy.forgotPasswordMessage}
        </p>

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

          <div className="Auth-field">
            <TurnstileWidget
              language={language}
              resetTrigger={turnstileResetTrigger}
              onVerify={(token) => {
                setTurnstileToken(token);
                setTurnstileError(false);
              }}
              onExpire={() => {
                setTurnstileToken('');
                setTurnstileError(false);
              }}
              onError={() => {
                setTurnstileToken('');
                setTurnstileError(true);
              }}
            />
          </div>

          {turnstileError && <p className="Auth-error" role="alert">{copy.captchaVerificationFailed}</p>}
          {error ? <p className="Auth-error" role="alert">{error}</p> : null}

          <div className="Action-row">
            <button 
              type="submit" 
              className="Primary-btn" 
              disabled={submitting || !turnstileToken}
            >
              {submitting ? copy.sending : copy.sendResetLink}
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
