import { test, expect } from '@playwright/test';

const ADMIN_USER = 'admin';
const ADMIN_PASS = 'Admin123!';

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
    // Wait for error — could be toast, alert role, or any visible error text
    await expect(
      page.locator('[role="alert"], [class*="toast"], [class*="error"], [class*="danger"]').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('admin login succeeds', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[name="username"], input[type="text"]').first().fill(ADMIN_USER);
    await page.locator('input[name="password"], input[type="password"]').first().fill(ADMIN_PASS);
    await page.locator('button[type="submit"]').click();
    // Should redirect to dashboard (or /)
    await expect(page).toHaveURL(/\/(dashboard|$)/, { timeout: 15000 });
  });

  test('calendar page loads for authenticated user', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[name="username"], input[type="text"]').first().fill(ADMIN_USER);
    await page.locator('input[name="password"], input[type="password"]').first().fill(ADMIN_PASS);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/(dashboard|$)/, { timeout: 15000 });

    await page.goto('/calendar');
    // Calendar page should have some visible content
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('main, [role="main"], h1, h2').first()).toBeVisible({ timeout: 8000 });
  });

  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
  });

  test('PWA manifest is served', async ({ request }) => {
    const response = await request.get('/manifest.json');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('name');
    expect(body).toHaveProperty('short_name');
  });
});
