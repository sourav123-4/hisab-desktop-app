import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function openTab(page: any, tab: string, title: string): Promise<void> {
  await page.locator(`.nav-item[data-tab="${tab}"]`).dispatchEvent('click');
  await expect(page.locator('#currentTabTitle')).toHaveText(title);
}

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
  await expect(page.locator('#txModal')).not.toHaveClass(/active/);

  await openTab(page, 'hisab', 'Daily Hisab');
  await expect(page.locator('#hisabTableBody').getByText(title, { exact: true }).first()).toBeVisible();
  await page.locator('#hisabSearchInput').fill('grocery');
  await expect(page.locator('#hisabTableBody').getByText('#test').first()).toBeVisible();
});

test('planner supports add and edit flows', async ({ page }, testInfo) => {
  const suffix = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'][testInfo.workerIndex] || 'Omega';
  await openTab(page, 'planner', 'Planner & Goals');
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

test('voice modal exposes recording without provider key errors', async ({ page }) => {
  await page.locator('#aiVoiceBtn').click();
  await expect(page.locator('#voiceModal')).toHaveClass(/active/);
  await expect(page.locator('#toggleRecordBtn')).toBeVisible();
  await expect(page.locator('#voiceSettingsBtn')).toBeVisible();
  await expect(page.locator('#voiceModal')).not.toContainText(/GROQ_API_KEY|VITE_GROQ|API_KEY is missing|api key missing/i);

  await page.locator('#voiceTranscriptInput').fill('350 petrol, 500 groceries via UPI');
  await expect(page.locator('#voicePreviewItems')).toContainText('Found 2 Hisab Entries');
});

test('settings shows managed Groq voice key as ready', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).electronAPI = {
      getVoiceTranscriptionStatus: async () => ({ configured: true, source: 'managed' })
    };
  });

  await page.reload();
  await page.locator('#themeToggleBtn').dispatchEvent('click');
  await expect(page.locator('#voiceKeyStatusText')).toContainText('managed Groq key');
});

test('voice recording sends audio for transcription and fills parsed transcript', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__transcribeCalls = [];
    (window as any).electronAPI = {
      getVoiceTranscriptionStatus: async () => ({ configured: true }),
      transcribeAudio: async (arrayBuffer: ArrayBuffer, mimeType: string) => {
        (window as any).__transcribeCalls.push({ bytes: arrayBuffer.byteLength, mimeType });
        return { success: true, text: '350 petrol, 500 groceries via UPI' };
      }
    };

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => ({
          getTracks: () => [{ stop: () => {} }]
        })
      }
    });

    class MockMediaRecorder {
      static isTypeSupported() {
        return true;
      }

      public state = 'inactive';
      public mimeType: string;
      public ondataavailable?: (event: { data: Blob }) => void;
      public onstop?: () => void;

      constructor(stream: MediaStream, options?: MediaRecorderOptions) {
        this.mimeType = options?.mimeType || 'audio/webm';
      }

      start() {
        this.state = 'recording';
      }

      stop() {
        this.state = 'inactive';
        const payload = new Uint8Array(3000).fill(7);
        this.ondataavailable?.({ data: new Blob([payload], { type: this.mimeType }) });
        setTimeout(() => this.onstop?.(), 0);
      }
    }

    class MockAudioContext {
      createMediaStreamSource() {
        return { connect: () => {} };
      }

      createAnalyser() {
        return {
          fftSize: 64,
          frequencyBinCount: 32,
          getByteFrequencyData: (arr: Uint8Array) => arr.fill(1)
        };
      }

      close() {
        return Promise.resolve();
      }
    }

    (window as any).MediaRecorder = MockMediaRecorder;
    (window as any).AudioContext = MockAudioContext;
  });

  await page.reload();
  await page.locator('#aiVoiceBtn').click();
  await page.locator('#toggleRecordBtn').click();
  await expect(page.locator('#toggleRecordBtn')).toContainText('Stop & Transcribe');
  await page.locator('#toggleRecordBtn').click();

  await expect(page.locator('#voiceTranscriptInput')).toHaveValue('350 petrol, 500 groceries via UPI');
  await expect(page.locator('#voicePreviewItems')).toContainText('Found 2 Hisab Entries');

  const calls = await page.evaluate(() => (window as any).__transcribeCalls);
  expect(calls).toHaveLength(1);
  expect(calls[0].bytes).toBeGreaterThan(1200);
  expect(calls[0].mimeType).toContain('audio/');
});

test('dashboard and planner render on mobile viewport', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile project only');
  await expect(page.locator('#currentTabTitle')).toHaveText('Dashboard');
  await openTab(page, 'planner', 'Planner & Goals');
  await expect(page.getByText('Smart Monthly Insights')).toBeVisible();
  await expect(page.locator('#contentContainer')).toBeVisible();
});
