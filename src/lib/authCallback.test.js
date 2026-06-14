import { expect, test } from 'vitest';
import {
  confirmAuthSession,
  getAuthCallbackDisplayState,
  readAuthParams,
} from './authCallback';

test('merges hash auth params into query params', () => {
  const location = new URL('https://food-order.test/auth/callback#error=access_denied&error_description=Email+link+expired');

  expect(readAuthParams(location).get('error')).toBe('access_denied');
  expect(readAuthParams(location).get('error_description')).toBe('Email link expired');
});

test('returns an error when Supabase sends an auth error in the URL', async () => {
  const location = new URL('https://food-order.test/auth/callback#error=access_denied&error_description=Email+link+expired');
  const supabase = {
    auth: {
      exchangeCodeForSession: async () => ({ error: null }),
      verifyOtp: async () => ({ error: null }),
      setSession: async () => ({ error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
    },
  };

  await expect(confirmAuthSession(supabase, location)).resolves.toEqual({
    status: 'error',
    message: 'Email link expired',
  });
});

test('maps a successful confirmation to localized copy', () => {
  const translations = {
    en: {
      successTitle: 'Email confirmed',
      successMessage: 'Verified.',
      errorTitle: 'Email confirmation failed',
      pendingTitle: 'Checking confirmation link',
      pendingMessage: 'Pending.',
    },
  };

  expect(getAuthCallbackDisplayState({ status: 'success' }, 'en', translations)).toEqual({
    status: 'success',
    title: 'Email confirmed',
    message: 'Verified.',
  });
});
