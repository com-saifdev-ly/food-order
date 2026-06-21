import { useState, useEffect } from 'react';
import PageShell from '../components/PageShell';
import { getLocalizedPath, translations } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { getProfileWithFallback } from '../lib/profile';
import TurnstileWidget from '../components/TurnstileWidget';

export default function SignInPage({ language }) {
  const copy = translations[language];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileError, setTurnstileError] = useState(false);
  const [turnstileResetTrigger, setTurnstileResetTrigger] = useState(0);

  // Check for URL parameters from signup redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailFromParams = params.get('email');
    const existingAccount = params.get('existing');

    if (emailFromParams) {
      setEmail(emailFromParams);
    }

    if (existingAccount === 'true') {
      setInfoMessage(copy.emailExistsMessage);
    }
  }, [language]);

  function sanitizePassword(value) {
    // Only allow: a-z, A-Z, 0-9, and common special characters
    // Remove spaces, Arabic characters, and other Unicode
    return value.replace(/[^a-zA-Z0-9!@#$%^&*(),.?":{}|<>]/g, '');
  }

  function getAuthErrorMessage(error) {
    const message = error.message?.toLowerCase() || '';

    if (message.includes('invalid login credentials')) {
      return copy.invalidCredentials;
    }
    if (message.includes('email not confirmed')) {
      return copy.signUpSuccessMessage;
    }
    if (message.includes('captcha')) {
      return copy.captchaVerificationFailed;
    }

    // Default to generic error for security
    return copy.invalidCredentials;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!turnstileToken) {
      setError(copy.captchaVerificationFailed);
      return;
    }

    setSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: {
        captchaToken: turnstileToken,
      },
    });

    if (signInError) {
      setError(getAuthErrorMessage(signInError));
      setSubmitting(false);
      // Reset Turnstile to allow new attempt
      setTurnstileToken('');
      setTurnstileResetTrigger(prev => prev + 1);
      return;
    }

    // Redirect to role-based dashboard
    const { data: { session } } = await supabase.auth.getSession();
    const profile = await getProfileWithFallback(session.user.id, session.user.email);
    const userRole = profile.role || 'customer';
    
    if (userRole === 'delivery') {
      window.location.href = getLocalizedPath('/driver-dashboard', language);
    } else {
      window.location.href = getLocalizedPath('/customer-dashboard', language);
    }
  }

  async function handlePasswordReset(event) {
    event.preventDefault();
    window.location.href = getLocalizedPath('/auth/reset-password-request', language);
  }

  function getResetErrorMessage(error) {
    const message = error.message?.toLowerCase() || '';

    if (message.includes('captcha')) {
      return copy.captchaVerificationFailed;
    }

    // Generic message for security
    return copy.passwordResetSent;
  }

  return (
    <PageShell language={language}>
      <section className="Hero-card Auth-card">

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
              value={password}
              onChange={(event) => setPassword(sanitizePassword(event.target.value))}
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
          {infoMessage && <p className="Auth-info" role="status">{infoMessage}</p>}
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
            <button type="submit" className="Primary-btn" disabled={submitting || !turnstileToken}>
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