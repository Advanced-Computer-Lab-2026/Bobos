import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { test, expect } from '@playwright/test';

let server, url;
test.beforeAll(async () => {
  const app = express();
  app.use(express.static(fileURLToPath(new URL('../../apps/web/public/portal-studio', import.meta.url))));
  app.get('/fixture', (_req, res) => res.send(`<!doctype html><html data-theme="dark"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/quiet-calendar.css"><body style="background:#151515;color:#efeee9;padding:20px;font:16px Arial">
    <label>Single date<input type="date" required min="2025-03-03" max="2025-03-28" value="2025-03-10"></label>
    <label>Start<input type="date" data-calendar-range="fixture" data-calendar-edge="start" value="2025-03-10" max="2025-03-14"></label>
    <label>End<input type="date" data-calendar-range="fixture" data-calendar-edge="end" value="2025-03-14" min="2025-03-10"></label>
    <label>Start time<input type="datetime-local" data-calendar-range="timed" data-calendar-edge="start" value="2025-03-10T09:00"></label>
    <label>End time<input type="datetime-local" data-calendar-range="timed" data-calendar-edge="end" value="2025-03-14T17:00"></label>
    <button id="after">After dates</button><script src="/quiet-calendar.js"></script><script>window.changes=[];document.addEventListener('change',e=>window.changes.push(e.target.value));</script></body></html>`));
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  url = `http://127.0.0.1:${server.address().port}/fixture`;
});
test.afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); });

test('Calendar: single-date bounds, keyboard selection, Cancel and focus restoration', async ({ page }) => {
  await page.goto(url);
  const field = page.getByLabel('Single date', { exact: true });
  await field.click();
  const picker = page.getByRole('dialog', { name: 'Calendar' });
  await expect(picker.getByRole('heading', { name: 'Calendar', exact: true })).toBeVisible();
  await expect(picker.locator('.quiet-calendar-selection')).toHaveCount(0);
  expect((await picker.boundingBox()).width).toBeLessThanOrEqual(420);
  await expect(picker.getByRole('gridcell', { name: 'Sunday, March 2, 2025', exact: true })).toBeDisabled();
  await expect(picker.getByRole('button', { name: 'Clear', exact: true })).toBeDisabled();
  await picker.getByRole('gridcell', { name: 'Wednesday, March 12, 2025', exact: true }).click();
  await picker.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(field).toHaveValue('2025-03-10');
  await expect(field).toBeFocused();
  await field.press('Alt+ArrowDown');
  await picker.getByRole('gridcell', { name: 'Monday, March 10, 2025', exact: true }).press('ArrowRight');
  await page.keyboard.press('Enter');
  await picker.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(field).toHaveValue('2025-03-11');
  await expect(field).toBeFocused();
  expect(await page.evaluate(() => window.changes)).toEqual(['2025-03-11']);
});

test('Calendar: ranges extend beyond the previous end, commit together and clear', async ({ page }) => {
  await page.goto(url);
  await page.getByLabel('End', { exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Calendar' });
  await picker.getByRole('gridcell', { name: 'Thursday, March 20, 2025', exact: true }).click();
  await picker.getByRole('button', { name: 'Start date', exact: true }).click();
  await picker.getByRole('gridcell', { name: 'Saturday, March 15, 2025', exact: true }).click();
  await expect(page.getByLabel('Start', { exact: true })).toHaveValue('2025-03-10');
  await picker.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByLabel('Start', { exact: true })).toHaveValue('2025-03-15');
  await expect(page.getByLabel('End', { exact: true })).toHaveValue('2025-03-20');
  await page.getByLabel('Start', { exact: true }).click();
  await picker.getByRole('button', { name: 'Clear', exact: true }).click();
  await picker.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByLabel('Start', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('End', { exact: true })).toHaveValue('');
});

test('Calendar: time presets, month navigation, Escape and mobile containment', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url);
  await page.getByLabel('Start time', { exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Calendar' });
  await picker.getByRole('button', { name: 'Next month' }).click();
  await expect(picker.getByRole('heading', { name: 'April 2025' })).toBeVisible();
  await picker.getByRole('button', { name: 'Previous month' }).click();
  await picker.getByRole('button', { name: '00:00 – 12:00', exact: true }).click();
  await picker.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByLabel('Start time', { exact: true })).toHaveValue('2025-03-10T00:00');
  await expect(page.getByLabel('End time', { exact: true })).toHaveValue('2025-03-14T12:00');
  await page.getByLabel('Start time', { exact: true }).click();
  const bounds = await picker.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  await page.keyboard.press('Escape');
  await expect(picker).toHaveCount(0);
});

test('Calendar: heading opens direct month and year selection without applying a date', async ({ page }) => {
  await page.goto(url);
  const start = page.getByLabel('Start', { exact: true });
  await start.click();
  const picker = page.getByRole('dialog', { name: 'Calendar' });
  await picker.getByRole('button', { name: 'Choose month and year' }).click();
  await picker.getByRole('spinbutton', { name: 'Year', exact: true }).fill('2032');
  await picker.getByRole('button', { name: 'Feb', exact: true }).click();
  await expect(picker.getByRole('heading', { name: 'February 2032' })).toBeVisible();
  await expect(picker.getByRole('gridcell', { name: /February 29, 2032/ })).toBeVisible();
  await expect(start).toHaveValue('2025-03-10');
  await picker.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(start).toHaveValue('2025-03-10');
  await page.getByLabel('Single date', { exact: true }).click();
  await picker.getByRole('button', { name: 'Choose month and year' }).click();
  await picker.getByRole('spinbutton', { name: 'Year', exact: true }).fill('2032');
  await expect(picker.getByRole('button', { name: 'Feb', exact: true })).toBeDisabled();
  await expect(picker.getByRole('alert')).toHaveText('Choose a year from 2025 to 2025.');
});
