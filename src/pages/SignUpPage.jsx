import { useState } from 'react';
import PageShell from '../components/PageShell';
import { getLocalizedPath, translations } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import TurnstileWidget from '../components/TurnstileWidget';

export default function SignUpPage({ language }) {
  const copy = translations[language];
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountType, setAccountType] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileError, setTurnstileError] = useState(false);
  const [turnstileResetTrigger, setTurnstileResetTrigger] = useState(0);
  const [accountTypeHover, setAccountTypeHover] = useState(false);

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

  function getValidationError() {
    if (fullName.length < 3) return copy.fullNameInvalid;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return copy.emailInvalid;
    if (password.length < 8) return copy.passwordTooShort;
    if (!isPasswordValid) return copy.passwordTooShort;
    if (password !== confirmPassword) return copy.passwordMismatch;
    if (!accountType) return copy.accountTypeRequired;
    if (!turnstileToken) return copy.captchaVerificationFailed;
    return '';
  }

  function getAuthErrorMessage(error) {
    const message = error.message?.toLowerCase() || '';

    if (message.includes('user already registered')) {
      return copy.emailAlreadyRegistered;
    }
    if (message.includes('weak password')) {
      return copy.weakPassword;
    }
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

    const validationError = getValidationError();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: accountType,
        },
        captchaToken: turnstileToken,
        emailRedirectTo: `${window.location.origin}/auth/callback?lang=${language}`,
      },
    });

    // Check if this is an existing user (Supabase returns success but session is null)
    // This is a security feature to prevent email enumeration
    // Existing users will have recovery_sent_at from a previous time
    const isExistingUser = data && data.user &&
                          data.session === null &&
                          data.user.confirmation_sent_at &&
                          data.user.recovery_sent_at; // Has previous recovery activity

    if (isExistingUser) {
      // Redirect to sign-in page with email
      window.location.href = getLocalizedPath(`/auth/sign-in?email=${encodeURIComponent(email)}&existing=true`, language);
      return;
    }

    if (signUpError) {
      // Check if error is about existing email
      const errorLower = signUpError.message?.toLowerCase() || '';
      const isExistingEmail = errorLower.includes('already registered') ||
                            errorLower.includes('user already registered') ||
                            errorLower.includes('already been registered') ||
                            errorLower.includes('duplicate');

      // If email already exists, redirect to sign-in page
      if (isExistingEmail) {
        window.location.href = getLocalizedPath(`/auth/sign-in?email=${encodeURIComponent(email)}&existing=true`, language);
        return;
      }

      const errorMessage = getAuthErrorMessage(signUpError);
      setError(errorMessage);
      setSubmitting(false);
      // Reset Turnstile to allow new attempt
      setTurnstileToken('');
      setTurnstileResetTrigger(prev => prev + 1);
      return;
    }

    setCompleted(true);
    setSubmitting(false);
  }

  if (completed) {
    return (
      <PageShell language={language}>
        <section className="Hero-card Auth-card Callback-card Callback-card--success">

          <h1>{copy.signUpSuccessTitle}</h1>
          <p className="Auth-message">{copy.signUpSuccessMessage}</p>

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

        <h1>{copy.signUpTitle}</h1>
        <p className="Auth-message">{copy.signUpMessage}</p>

        <form className="Auth-form" onSubmit={handleSubmit}>
          <label className="Auth-field">
            <span>{copy.fullNameLabel} <span className="Auth-field-hint">({copy.fullNameMinLength})</span></span>
            <input
              type="text"
              name="fullName"
              autoComplete="name"
              required
              minLength={3}
              maxLength={32}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              style={{ color: fullName.length > 0 && fullName.length < 3 ? 'var(--error-color)' : 'inherit' }}
            />
          </label>

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
            <span>{copy.accountTypeLabel}</span>
            <div className="Account-type-selector">
              <label className="Account-type-option">
                <input
                  type="radio"
                  name="accountType"
                  value="customer"
                  checked={accountType === 'customer'}
                  onChange={(event) => setAccountType(event.target.value)}
                />
                <span>{copy.customer}</span>
              </label>
              <label className="Account-type-option">
                <input
                  type="radio"
                  name="accountType"
                  value="delivery"
                  checked={accountType === 'delivery'}
                  onChange={(event) => setAccountType(event.target.value)}
                />
                <span>{copy.delivery}</span>
              </label>
            </div>
            <p className="Account-type-description">
              {copy.customer}: {copy.customerDescription}<br />
              {copy.delivery}: {copy.deliveryDescription}
            </p>
            <p className="Account-type-warning">⚠ {copy.accountTypeWarning}</p>
          </div>

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
              disabled={submitting || getValidationError()}
              onMouseEnter={() => {
                if (!accountType) setAccountTypeHover(true);
              }}
              onMouseLeave={() => setAccountTypeHover(false)}
            >
              {submitting ? copy.signingUp : copy.submitSignUp}
            </button>
            {accountTypeHover && !accountType && (
              <div className="Account-type-hover-warning">{copy.accountTypeHoverWarning}</div>
            )}
          </div>
        </form>

        <p className="Auth-switch">
          {copy.hasAccount}{' '}
          <a href={getLocalizedPath('/auth/sign-in', language)}>{copy.signIn}</a>
        </p>
      </section>
    </PageShell>
  );
}