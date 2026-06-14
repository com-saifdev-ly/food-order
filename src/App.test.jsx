import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App, { getLanguage } from './App';

const confirmAuthSession = vi.fn();
const signInWithPassword = vi.fn();
const signUp = vi.fn();
const signOut = vi.fn();
const getSession = vi.fn();
const onAuthStateChange = vi.fn();

vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args) => signInWithPassword(...args),
      signUp: (...args) => signUp(...args),
      signOut: (...args) => signOut(...args),
      getSession: (...args) => getSession(...args),
      onAuthStateChange: (...args) => onAuthStateChange(...args),
    },
  },
}));

vi.mock('./lib/authCallback', async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...actual,
    confirmAuthSession: (...args) => confirmAuthSession(...args),
  };
});

function mockSignedOutSession() {
  getSession.mockResolvedValue({ data: { session: null }, error: null });
  onAuthStateChange.mockReturnValue({
    data: {
      subscription: {
        unsubscribe: vi.fn(),
      },
    },
  });
}

beforeEach(() => {
  mockSignedOutSession();
});

afterEach(() => {
  window.history.pushState({}, '', '/');
  confirmAuthSession.mockReset();
  signInWithPassword.mockReset();
  signUp.mockReset();
  signOut.mockReset();
  getSession.mockReset();
  onAuthStateChange.mockReset();
});

test('renders the Food Order welcome page', async () => {
  render(<App />);

  expect(screen.getByText(/welcome to food order/i)).toBeDefined();
  expect(screen.getByRole('link', { name: /العربية/i })).toBeDefined();
  await waitFor(() => {
    expect(screen.getByRole('link', { name: /sign in/i })).toBeDefined();
  });
  expect(screen.getByRole('link', { name: /create account/i })).toBeDefined();
  expect(screen.getByRole('button', { name: /download the app/i })).toBeDefined();
  expect(screen.getByRole('button', { name: /windows/i })).toBeDefined();
  expect(screen.getByRole('button', { name: /linux/i })).toBeDefined();
  expect(screen.getByRole('button', { name: /mac/i })).toBeDefined();
  expect(screen.getByRole('button', { name: /ios/i })).toBeDefined();
  expect(screen.getByRole('button', { name: /android/i })).toBeDefined();
});

test('auto-selects Arabic from the browser language list', () => {
  const location = new URL('https://food-order.test/');
  const browserNavigator = { languages: ['ar-LY', 'en-US'], language: 'en-US' };

  expect(getLanguage(location, browserNavigator)).toBe('ar');
});

test('uses the URL language when it is provided', () => {
  const location = new URL('https://food-order.test/?lang=en');
  const browserNavigator = { languages: ['ar-LY'], language: 'ar-LY' };

  expect(getLanguage(location, browserNavigator)).toBe('en');
});

test('renders a successful Supabase email confirmation callback', async () => {
  confirmAuthSession.mockResolvedValue({ status: 'success' });
  window.history.pushState({}, '', '/auth/callback?type=signup&code=confirm-code');

  render(<App />);

  await waitFor(() => {
    expect(screen.getByText(/email confirmed/i)).toBeDefined();
  });

  expect(screen.getByText(/your email address has been verified/i)).toBeDefined();
  expect(document.querySelector('.Status-icon--success')).toBeDefined();
  expect(screen.getByRole('link', { name: /sign in/i })).toBeDefined();
});

test('renders a Supabase email confirmation error', async () => {
  confirmAuthSession.mockResolvedValue({
    status: 'error',
    message: 'Email link expired',
  });
  window.history.pushState({}, '', '/auth/callback#error=access_denied&error_description=Email+link+expired');

  render(<App />);

  await waitFor(() => {
    expect(screen.getByText(/email confirmation failed/i)).toBeDefined();
  });

  expect(screen.getByText(/email link expired/i)).toBeDefined();
  expect(document.querySelector('.Status-icon--error')).toBeDefined();
});

test('renders the Arabic Food Order page', async () => {
  window.history.pushState({}, '', '/?lang=ar');

  render(<App />);

  expect(screen.getByText(/مرحباً بك في Food Order/i)).toBeDefined();
  await waitFor(() => {
    expect(screen.getByRole('link', { name: /تسجيل الدخول/i })).toBeDefined();
  });
  expect(screen.getByRole('button', { name: /تحميل التطبيق/i })).toBeDefined();
  expect(screen.getByRole('button', { name: /أندرويد/i })).toBeDefined();
  expect(document.querySelector('[dir="rtl"]')).toBeDefined();
});

test('renders a successful Arabic Supabase email confirmation callback', async () => {
  confirmAuthSession.mockResolvedValue({ status: 'success' });
  window.history.pushState({}, '', '/auth/callback?lang=ar&type=signup&code=confirm-code');

  render(<App />);

  await waitFor(() => {
    expect(screen.getByText(/تم تأكيد البريد الإلكتروني/i)).toBeDefined();
  });

  expect(screen.getByText(/تم التحقق من بريدك الإلكتروني بنجاح/i)).toBeDefined();
  expect(document.querySelector('.Status-icon--success')).toBeDefined();
});

test('renders the sign in page', () => {
  window.history.pushState({}, '', '/auth/sign-in?lang=en');

  render(<App />);

  expect(screen.getByRole('heading', { name: /sign in to food order/i })).toBeDefined();
  expect(screen.getByRole('link', { name: /create account/i })).toBeDefined();
});

test('renders the sign up page', () => {
  window.history.pushState({}, '', '/auth/sign-up?lang=en');

  render(<App />);

  expect(screen.getByRole('heading', { name: /create your food order account/i })).toBeDefined();
  expect(screen.getByRole('link', { name: /sign in/i })).toBeDefined();
});

test('shows a sign up confirmation message after submitting the form', async () => {
  signUp.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  window.history.pushState({}, '', '/auth/sign-up?lang=en');

  render(<App />);

  await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
  await userEvent.type(screen.getByLabelText(/^password$/i), 'secret123');
  await userEvent.type(screen.getByLabelText(/confirm password/i), 'secret123');
  await userEvent.click(screen.getByRole('button', { name: /create account/i }));

  await waitFor(() => {
    expect(screen.getByText(/check your email/i)).toBeDefined();
  });

  expect(signUp).toHaveBeenCalledWith({
    email: 'user@example.com',
    password: 'secret123',
    options: {
      emailRedirectTo: 'http://localhost:3000/auth/callback?lang=en',
    },
  });
});
