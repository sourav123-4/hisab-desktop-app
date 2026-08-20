import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('manual hisab entry appears in ledger and dashboard', async ({ page }, testInfo) => {
  const title = `Playwright Grocery ${['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'][testInfo.workerIndex] || 'Omega'}`;
  await page.getByRole('button', { name: /\+ Manual Entry/ }).click();
  await page.locator('#txTitle').fill(title);
  await page.locator('#txAmount').fill('765');
  await page.locator('#txCategory').selectOption('Food');
  await page.locator('#txType').selectOption('expense');
  await page.locator('#txPaymentMethod').selectOption('UPI');
  await page.locator('#txTags').fill('test, grocery');
  await page.locator('#txDate').fill('2026-08-20');
  await page.getByRole('button', { name: /Save Hisab Entry/ }).click();

  await page.locator('.nav-item[data-tab="hisab"]').click();
  await expect(page.locator('#hisabTableBody').getByText(title, { exact: true }).first()).toBeVisible();
  await page.locator('#hisabSearchInput').fill('grocery');
  await expect(page.locator('#hisabTableBody').getByText('#test').first()).toBeVisible();
});

test('planner supports add and edit flows', async ({ page }, testInfo) => {
  const suffix = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'][testInfo.workerIndex] || 'Omega';
  await page.locator('.nav-item[data-tab="planner"]').click();
  await page.locator('#recTitle').fill(`Apartment Rent ${suffix}`);
  await page.locator('#recAmount').fill('18000');
  await page.locator('#recCategory').selectOption('Bills');
  await page.locator('#recFrequency').selectOption('monthly');
  await page.locator('#recDay').fill('5');
  await page.getByRole('button', { name: 'Save Rule' }).click();
  await expect(page.locator('.metric-card').filter({ hasText: `Apartment Rent ${suffix}` }).first()).toBeVisible();
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: 'Edit' }).first().click();
  await page.locator('#recTitle').fill(`Apartment Rent Updated ${suffix}`);
  await page.locator('#recurringForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect(page.locator('.metric-card').filter({ hasText: `Apartment Rent Updated ${suffix}` }).first()).toBeVisible();
  await page.waitForTimeout(250);

  await page.locator('#cardName').fill(`Test Visa ${suffix}`);
  await page.locator('#cardBank').fill('Bank');
  await page.locator('#cardLimit').fill('50000');
  await page.locator('#cardOutstanding').fill('1200');
  await page.locator('#cardForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect(page.locator('.metric-card').filter({ hasText: `Test Visa ${suffix}` }).first()).toBeVisible();
  await page.waitForTimeout(250);

  await page.locator('#goalName').fill(`Emergency Fund UI ${suffix}`);
  await page.locator('#goalTarget').fill('100000');
  await page.locator('#goalCurrent').fill('25000');
  await page.locator('#goalMonthly').fill('5000');
  await page.locator('#goalForm').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect(page.locator('.metric-card').filter({ hasText: `Emergency Fund UI ${suffix}` }).first()).toBeVisible();
});

test('dashboard and planner render on mobile viewport', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile project only');
  await expect(page.locator('#currentTabTitle')).toHaveText('Dashboard');
  await page.locator('.nav-item[data-tab="planner"]').click();
  await expect(page.getByText('Smart Monthly Insights')).toBeVisible();
  await expect(page.locator('#contentContainer')).toBeVisible();
});
