export function readAuthParams(location) {
  const params = new URLSearchParams(location.search);
  const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
  const hashParams = new URLSearchParams(hash);

  hashParams.forEach((value, key) => {
    if (!params.has(key)) {
      params.set(key, value);
    }
  });

  return params;
}

export async function confirmAuthSession(supabase, location) {
  const params = readAuthParams(location);
  const error = params.get('error_description') || params.get('error');

  if (error) {
    return {
      status: 'error',
      message: error.replace(/\+/g, ' '),
    };
  }

  const code = params.get('code');
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      return {
        status: 'error',
        message: exchangeError.message,
      };
    }

    return { status: 'success' };
  }

  const tokenHash = params.get('token_hash');
  const type = params.get('type');
  if (tokenHash && type) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (verifyError) {
      return {
        status: 'error',
        message: verifyError.message,
      };
    }

    return { status: 'success' };
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (sessionError) {
      return {
        status: 'error',
        message: sessionError.message,
      };
    }

    return { status: 'success' };
  }

  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    return {
      status: 'error',
      message: sessionError.message,
    };
  }

  if (data.session) {
    return { status: 'success' };
  }

  return { status: 'pending' };
}

export function getAuthCallbackState(location = window.location, language = 'en', translations) {
  const copy = translations[language] || translations.en;
  const params = readAuthParams(location);
  const error = params.get('error_description') || params.get('error');
  const type = params.get('type');
  const hasConfirmation = Boolean(
    params.get('code') ||
    params.get('access_token') ||
    params.get('token_hash') ||
    type === 'signup' ||
    type === 'email_change',
  );

  if (error) {
    return {
      status: 'error',
      title: copy.errorTitle,
      message: error.replace(/\+/g, ' '),
    };
  }

  if (hasConfirmation) {
    return {
      status: 'pending',
      title: copy.pendingTitle,
      message: copy.pendingMessage,
    };
  }

  return {
    status: 'pending',
    title: copy.pendingTitle,
    message: copy.pendingMessage,
  };
}

export function getAuthCallbackDisplayState(confirmationResult, language = 'en', translations) {
  const copy = translations[language] || translations.en;

  if (confirmationResult.status === 'success') {
    return {
      status: 'success',
      title: copy.successTitle,
      message: copy.successMessage,
    };
  }

  if (confirmationResult.status === 'error') {
    return {
      status: 'error',
      title: copy.errorTitle,
      message: confirmationResult.message,
    };
  }

  return {
    status: 'pending',
    title: copy.pendingTitle,
    message: copy.pendingMessage,
  };
}
