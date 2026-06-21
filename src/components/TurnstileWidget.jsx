import { useRef, useEffect } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';

export default function TurnstileWidget({ onVerify, onExpire, onError, language, resetTrigger }) {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  const turnstileRef = useRef(null);

  if (!siteKey) {
    console.error('VITE_TURNSTILE_SITE_KEY is not set');
    return null;
  }

  // Map language codes to Turnstile language codes
  const turnstileLanguage = language === 'ar' ? 'ar' : 'en';

  // Reset Turnstile when resetTrigger changes
  useEffect(() => {
    if (resetTrigger && turnstileRef.current) {
      turnstileRef.current.reset();
    }
  }, [resetTrigger]);

  return (
    <div className="Turnstile-widget">
      <Turnstile
        ref={turnstileRef}
        siteKey={siteKey}
        options={{
          language: turnstileLanguage,
        }}
        onSuccess={(token) => onVerify?.(token)}
        onExpire={() => onExpire?.()}
        onError={() => onError?.()}
      />
    </div>
  );
}
