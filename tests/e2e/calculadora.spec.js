import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test("mostra el resultat de l'exemple a la primera visita", async ({ page }) => {
  await expect(page.locator('#example')).toBeVisible();
  // 420 km × 168 Wh/km = 70,56 kWh; 28 kWh fora a 0,45 €; 42,56 kWh a casa a 0,14 €.
  await expect(page.locator('#total')).toHaveText('18,56 €');
  await expect(page.locator('#away-cost')).toHaveText('12,60 €');
  await expect(page.locator('#home-cost')).toHaveText('5,96 €');
});

test('recalcula en afegir una càrrega', async ({ page }) => {
  await page.locator('#clear-example').click();
  await page.locator('#km').fill('100');
  await page.locator('#cons').fill('150');
  await page.locator('#home').fill('0,20');
  await expect(page.locator('#total')).toHaveText('3,00 €');

  await page.locator('#add').click();
  await page.locator('.r-kwh').fill('10');
  await page.locator('.r-price').fill('0,50');
  await expect(page.locator('#total')).toHaveText('6,00 €');
});

test('calcula amb el mètode de la bateria', async ({ page }) => {
  await page.locator('#clear-example').click();
  await page.locator('#method').selectOption('bateria');
  await page.locator('#km').fill('200');
  await page.locator('#soc0').fill('80');
  await page.locator('#soc1').fill('30');
  await page.locator('#cap').fill('60');
  await page.locator('#home').fill('0,10');
  await expect(page.locator('#total')).toHaveText('3,00 €');
});

test('no té errors de consola', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.reload();
  await expect(page.locator('#total')).not.toHaveText('—');
  expect(errors).toEqual([]);
});

test('té metadades de SEO i la pàgina de privacitat', async ({ page }) => {
  await expect(page).toHaveTitle(/Cost de viatge en elèctric/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /cotxe elèctric/);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', 'manifest.webmanifest');
  await page.getByRole('link', { name: 'Privacitat' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacitat');
});

test('mostra el nom i la data del viatge al resultat', async ({ page }) => {
  await expect(page.locator('#r-trip')).toBeHidden();
  await page.locator('#t-name').fill('Riudoms – Ulldemolins');
  await page.locator('#t-date').fill('2026-10-13');
  await expect(page.locator('#r-trip')).toHaveText('Riudoms – Ulldemolins · 13/10/2026');
  await page.locator('#t-name').fill('');
  await expect(page.locator('#r-trip')).toBeHidden();
});
