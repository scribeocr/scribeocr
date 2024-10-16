/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */

import { assert } from 'chai';
import path from 'path';
import { By, until } from 'selenium-webdriver';
import { fileURLToPath } from 'url';
import { createDriver } from '../scripts/helpers.js';

globalThis.__dirname = path.dirname(fileURLToPath(import.meta.url));
const port = 3031;

describe('Use delete and recognize word buttons', function () {
  let driver;
  let customActions;
  this.timeout(60000);
  const appURL = process.env.SELENIUM ? `http://172.18.0.2:${port}/` : `http://localhost:${port}/`;

  before(async function () {
    ({ driver, customActions } = await createDriver());
  });

  it('\'Recognize All\' recognizes basic image correctly', async function () {
    // Navigate to the page
    await driver.get(appURL);

    // Upload the files
    await customActions.uploadFiles([
      'simple.png',
    ]);

    await customActions.recognize();

    const text = await driver.executeScript('return df.scribe.exportData("text")');

    assert.strictEqual(text, 'Tesseract');
  });

  it('\'Delete Word\' deletes word', async function () {
    await driver.findElement(By.id('nav-edit-tab')).click();

    await customActions.selectAllCanvas();

    const deleteWordElem = await driver.findElement(By.id('deleteWord'));
    await deleteWordElem.click();

    const text = await driver.executeScript('return df.scribe.exportData("text")');

    assert.strictEqual(text, '');
  });

  it('\'Recognize Word\' recognizes word', async function () {
    const recognizeWordElem = await driver.findElement(By.id('recognizeWord'));
    await recognizeWordElem.click();

    await customActions.selectAllCanvas();

    // TODO: Make this dynamic
    await driver.sleep(5000);

    const text = await driver.executeScript('return df.scribe.exportData("text")');

    assert.strictEqual(text, 'Tesseract');
  });

  it('\'Recognize Area\' recognizes area', async function () {
    await customActions.selectAllCanvas();
    const deleteWordElem = await driver.findElement(By.id('deleteWord'));
    await driver.wait(until.elementIsEnabled(deleteWordElem), 10000);
    await deleteWordElem.click();

    const recognizeWordDropdownElem = await driver.findElement(By.id('recognizeWordDropdown'));
    await recognizeWordDropdownElem.click();

    const recognizeAreaElem = await driver.findElement(By.id('recognizeArea'));
    await recognizeAreaElem.click();

    await customActions.selectAllCanvas();

    // TODO: Make this dynamic
    await driver.sleep(5000);

    const text = await driver.executeScript('return df.scribe.exportData("text")');

    assert.strictEqual(text, 'Tesseract');
  });

  afterEach(async function () {
    if (this.currentTest.state === 'failed') {
      const fs = await import('fs');
      const screenshotsDir = path.join(__dirname, 'screenshots');
      if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });
      const screenshotPath = path.join(screenshotsDir, `${this.currentTest.title}.png`);
      const image = await driver.takeScreenshot();
      fs.writeFileSync(screenshotPath, image, 'base64');
      console.log(`Screenshot saved to ${screenshotPath}`);
    }
  });

  after(async () => {
    await driver.quit();
  });
});
