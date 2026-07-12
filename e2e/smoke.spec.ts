import { test, expect } from '@playwright/test';

test.describe('Smoke tests', () => {
  test('health endpoint is reachable', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('status', 'ok');
  });

  test('login page loads', async ({ page }) => {
    await page.goto('/');
    // Should redirect to login or show app
    await expect(page).toHaveURL(/\/(login)?/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[name="username"], input[type="text"]').first()).toBeVisible();
    await page.locator('input[name="username"], input[type="text"]').first().fill('wronguser');
    await page.locator('input[name="password"], input[type="password"]').first().fill('wrongpassword');
    await page.locator('button[type="submit"]').click();
    // Should show some error
    await expect(page.locator('[role="alert"], .text-danger, .error')).toBeVisible({ timeout: 5000 });
  });

  test('parent admin login succeeds', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[name="username"], input[type="text"]').first().fill('parent');
    await page.locator('input[name="password"], input[type="password"]').first().fill('Parent123!');
    await page.locator('button[type="submit"]').click();
    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/(dashboard|$)/, { timeout: 10000 });
  });

  test('calendar page loads for authenticated user', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.locator('input[name="username"], input[type="text"]').first().fill('parent');
    await page.locator('input[name="password"], input[type="password"]').first().fill('Parent123!');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/(dashboard|$)/, { timeout: 10000 });

    // Navigate to calendar
    await page.goto('/calendar');
    await expect(page.locator('[data-testid="calendar"], .calendar, h1')).toBeVisible({ timeout: 5000 });
  });

  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test('PWA manifest is served', async ({ request }) => {
    const response = await request.get('/manifest.json');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('name');
    expect(body).toHaveProperty('short_name');
  });
});
