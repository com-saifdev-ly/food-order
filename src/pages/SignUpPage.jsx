import { useState } from 'react';
import PageShell from '../components/PageShell';
import { getLocalizedPath, translations } from '../lib/i18n';
import { supabase } from '../lib/supabase';

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

  function getValidationError() {
    if (fullName.length < 3) return copy.fullNameInvalid;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return copy.emailInvalid;
    if (password.length < 6) return copy.passwordTooShort;
    if (password !== confirmPassword) return copy.passwordMismatch;
    if (!accountType) return copy.accountTypeRequired;
    return '';
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

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: accountType,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?lang=${language}`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setSubmitting(false);
      return;
    }

    setCompleted(true);
    setSubmitting(false);
  }

  if (completed) {
    return (
      <PageShell language={language}>
        <section className="Hero-card Auth-card Callback-card Callback-card--success">
          <p className="Eyebrow">{copy.accountEyebrow}</p>
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
        <p className="Eyebrow">{copy.accountEyebrow}</p>
        <h1>{copy.signUpTitle}</h1>
        <p className="Auth-message">{copy.signUpMessage}</p>

        <form className="Auth-form" onSubmit={handleSubmit}>
          <label className="Auth-field">
            <span>{copy.fullNameLabel}</span>
            <input
              type="text"
              name="fullName"
              autoComplete="name"
              required
              minLength={3}
              maxLength={32}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              style={{ color: fullName.length > 0 && fullName.length < 3 ? '#fca5a5' : 'inherit' }}
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

          {error ? <p className="Auth-error" role="alert">{error}</p> : null}

          <div className="Action-row">
            <button 
              type="submit" 
              className="Primary-btn" 
              disabled={submitting || getValidationError()}
            >
              {submitting ? copy.signingUp : copy.submitSignUp}
            </button>
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