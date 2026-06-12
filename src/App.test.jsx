import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the Food Order welcome page', () => {
  render(<App />);

  expect(screen.getByText(/welcome to food order/i)).toBeDefined();
  expect(screen.getByRole('button', { name: /download the app/i })).toBeDefined();
  expect(screen.getByRole('button', { name: /windows/i })).toBeDefined();
  expect(screen.getByRole('button', { name: /linux/i })).toBeDefined();
  expect(screen.getByRole('button', { name: /mac/i })).toBeDefined();
  expect(screen.getByRole('button', { name: /ios/i })).toBeDefined();
  expect(screen.getByRole('button', { name: /android/i })).toBeDefined();
});
