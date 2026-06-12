import { afterEach, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

afterEach(() => {
  window.history.pushState({}, '', '/');
});

test('renders the Food Order welcome page', () => {
  render(<App />);

  expect(screen.getByText(/welcome to food order/i)).toBeDefined();
  expect(screen.getByRole('link', { name: /العربية/i })).toBeDefined();
  expect(screen.getByRole('button', { name: /download the app/i })).toBeDefined();
  expect(screen.getByRole('button', { name: /windows/i })).toBeDefined();
  expect(screen.getByRole('button', { name: /linux/i })).toBeDefined();
  expect(screen.getByRole('button', { name: /mac/i })).toBeDefined();
  expect(screen.getByRole('button', { name: /ios/i })).toBeDefined();
  expect(screen.getByRole('button', { name: /android/i })).toBeDefined();
});

test('renders a successful Supabase email confirmation callback', () => {
  window.history.pushState({}, '', '/auth/callback?type=signup&code=confirm-code');

  render(<App />);

  expect(screen.getByText(/email confirmed/i)).toBeDefined();
  expect(screen.getByText(/your email address has been verified/i)).toBeDefined();
  expect(document.querySelector('.Status-icon--success')).toBeDefined();
  expect(screen.getByRole('link', { name: /back to food order/i })).toBeDefined();
});

test('renders a Supabase email confirmation error', () => {
  window.history.pushState({}, '', '/auth/callback#error=access_denied&error_description=Email+link+expired');

  render(<App />);

  expect(screen.getByText(/email confirmation failed/i)).toBeDefined();
  expect(screen.getByText(/email link expired/i)).toBeDefined();
  expect(document.querySelector('.Status-icon--error')).toBeDefined();
});

test('renders the Arabic Food Order page', () => {
  window.history.pushState({}, '', '/?lang=ar');

  render(<App />);

  expect(screen.getByText(/مرحباً بك في Food Order/i)).toBeDefined();
  expect(screen.getByRole('button', { name: /تحميل التطبيق/i })).toBeDefined();
  expect(screen.getByRole('button', { name: /أندرويد/i })).toBeDefined();
  expect(document.querySelector('[dir="rtl"]')).toBeDefined();
});

test('renders a successful Arabic Supabase email confirmation callback', () => {
  window.history.pushState({}, '', '/auth/callback?lang=ar&type=signup&code=confirm-code');

  render(<App />);

  expect(screen.getByText(/تم تأكيد البريد الإلكتروني/i)).toBeDefined();
  expect(screen.getByText(/تم التحقق من بريدك الإلكتروني بنجاح/i)).toBeDefined();
  expect(document.querySelector('.Status-icon--success')).toBeDefined();
});
