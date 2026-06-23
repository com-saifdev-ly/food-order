import { useState, useEffect } from 'react';
import PageShell from '../components/PageShell';
import { getLocalizedPath, translations } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import TurnstileWidget from '../components/TurnstileWidget';

export default function ResetPasswordPage({ language }) {
  const copy = translations[language];
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [validToken, setValidToken] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileError, setTurnstileError] = useState(false);
  const [turnstileResetTrigger, setTurnstileResetTrigger] = useState(0);

  // Password requirements validation
  const passwordRequirements = {
    minLength: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    digit: /\d/.test(password),
    symbol: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };

  const isPasswordValid = Object.values(passwordRequirements).every(Boolean);

  function sanitizePassword(value) {
    // Only allow: a-z, A-Z, 0-9, and common special characters
    // Remove spaces, Arabic characters, and other Unicode
    return value.replace(/[^a-zA-Z0-9!@#$%^&*(),.?":{}|<>]/g, '');
  }

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

    if (password.length < 8) {
      setError(copy.passwordTooShort);
      return;
    }

    if (!isPasswordValid) {
      setError(copy.passwordTooShort);
      return;
    }

    if (password !== confirmPassword) {
      setError(copy.passwordMismatch);
      return;
    }

    if (!turnstileToken) {
      setError(copy.captchaVerificationFailed);
      return;
    }

    setSubmitting(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password: password,
    });

    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      // Reset Turnstile to allow new attempt
      setTurnstileToken('');
      setTurnstileResetTrigger(prev => prev + 1);
      return;
    }

    // Password updated successfully
    setSubmitting(false);
    setCompleted(true);
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

  if (completed) {
    return (
      <PageShell language={language}>
        <section className="Hero-card Auth-card Callback-card Callback-card--success">

          <h1>{copy.passwordUpdatedTitle}</h1>
          <p className="Auth-message">
            {copy.passwordUpdated}
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

        <h1>{copy.resetPasswordTitle}</h1>
        <p className="Auth-message">{copy.resetPasswordMessage}</p>

        <form className="Auth-form" onSubmit={handleSubmit}>
          <label className="Auth-field">
            <span>{copy.passwordLabel} <span className="Auth-field-hint">({copy.passwordMinLength})</span></span>
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(sanitizePassword(event.target.value))}
            />
            {password.length > 0 && (
              <div className="Password-requirements">
                <div className={`Password-requirement ${passwordRequirements.minLength ? 'valid' : 'invalid'}`}>
                  <span className="Password-requirement-icon">
                    {passwordRequirements.minLength ? '✓' : '✗'}
                  </span>
                  {copy.passwordRequirementMinLength}
                </div>
                <div className={`Password-requirement ${passwordRequirements.lowercase ? 'valid' : 'invalid'}`}>
                  <span className="Password-requirement-icon">
                    {passwordRequirements.lowercase ? '✓' : '✗'}
                  </span>
                  {copy.passwordRequirementLowercase}
                </div>
                <div className={`Password-requirement ${passwordRequirements.uppercase ? 'valid' : 'invalid'}`}>
                  <span className="Password-requirement-icon">
                    {passwordRequirements.uppercase ? '✓' : '✗'}
                  </span>
                  {copy.passwordRequirementUppercase}
                </div>
                <div className={`Password-requirement ${passwordRequirements.digit ? 'valid' : 'invalid'}`}>
                  <span className="Password-requirement-icon">
                    {passwordRequirements.digit ? '✓' : '✗'}
                  </span>
                  {copy.passwordRequirementDigit}
                </div>
                <div className={`Password-requirement ${passwordRequirements.symbol ? 'valid' : 'invalid'}`}>
                  <span className="Password-requirement-icon">
                    {passwordRequirements.symbol ? '✓' : '✗'}
                  </span>
                  {copy.passwordRequirementSymbol}
                </div>
              </div>
            )}
          </label>

          <label className="Auth-field">
            <span>{copy.confirmPasswordLabel} <span className="Auth-field-hint">({copy.passwordMinLength})</span></span>
            <input
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(sanitizePassword(event.target.value))}
            />
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <p className="Auth-field-error">{copy.passwordMismatch}</p>
            )}
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