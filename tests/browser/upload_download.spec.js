/* eslint-disable prefer-arrow-callback */
/* eslint-disable func-names */

import path from 'path';
import { fileURLToPath } from 'url';
import { By } from 'selenium-webdriver';
import { createDriver } from '../scripts/helpers.js';

globalThis.__dirname = path.dirname(fileURLToPath(import.meta.url));
const port = 3031;

describe('Generate output files using images and built-in OCR', function () {
  let driver;
  let customActions;
  this.timeout(40000);
  const appURL = process.env.SELENIUM ? `http://172.18.0.2:${port}/` : `http://localhost:${port}/`;

  before(async function () {
    ({ driver, customActions } = await createDriver());
  });

  it('3-page .pdf file', async function () {
    // Navigate to the page
    await driver.get(appURL);

    // Upload the files
    await customActions.uploadFiles([
      'scribe_test_pdf1.pdf',
    ]);

    await customActions.recognize();

    await customActions.downloadAllFormats();
  });

  it('3 .png files', async function () {
    // Navigate to the page
    await driver.get(appURL);

    // Upload the files
    await customActions.uploadFiles([
      'henreys_grave.png',
      'aurelia.png',
      'the_past.png',
    ]);

    await customActions.recognize();

    await customActions.downloadAllFormats();
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

describe('Generate output files using images only', function () {
  let driver;
  let customActions;
  this.timeout(25000);
  const appURL = process.env.SELENIUM ? `http://172.18.0.2:${port}/` : `http://localhost:${port}/`;

  before(async function () {
    ({ driver, customActions } = await createDriver());
  });

  it('3-page .pdf file', async function () {
    // Navigate to the page
    await driver.get(appURL);

    // Upload the files
    await customActions.uploadFiles([
      'scribe_test_pdf1.pdf',
    ]);

    await customActions.downloadAllFormats();
  });

  it('3 .png files', async function () {
    // Navigate to the page
    await driver.get(appURL);

    // Upload the files
    await customActions.uploadFiles([
      'henreys_grave.png',
      'aurelia.png',
      'the_past.png',
    ]);

    await customActions.downloadAllFormats();
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

describe('Generate output files using ABBYY XML only', function () {
  let driver;
  let customActions;
  this.timeout(25000);
  const appURL = process.env.SELENIUM ? `http://172.18.0.2:${port}/` : `http://localhost:${port}/`;

  before(async function () {
    ({ driver, customActions } = await createDriver());
  });

  it('3-page .pdf file', async function () {
    // Navigate to the page
    await driver.get(appURL);

    // Upload the files
    await customActions.uploadFiles([
      'henreys_grave_abbyy.xml',
      'aurelia_abbyy.xml',
      'the_past_abbyy.xml',
    ]);

    await customActions.downloadAllFormats();
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

describe('Generate output files using images and uploaded ABBYY XML', function () {
  let driver;
  let customActions;
  this.timeout(25000);
  const appURL = process.env.SELENIUM ? `http://172.18.0.2:${port}/` : `http://localhost:${port}/`;

  before(async function () {
    ({ driver, customActions } = await createDriver());
  });

  it('3-page .pdf file', async function () {
    // Navigate to the page
    await driver.get(appURL);

    // Upload the files
    await customActions.uploadFiles([
      'scribe_test_pdf1.pdf',
      'henreys_grave_abbyy.xml',
      'aurelia_abbyy.xml',
      'the_past_abbyy.xml',
    ]);

    await customActions.downloadAllFormats();
  });

  it('3 .png files', async function () {
    // Navigate to the page
    await driver.get(appURL);

    // Upload the files
    await customActions.uploadFiles([
      'henreys_grave.png',
      'henreys_grave_abbyy.xml',
      'aurelia.png',
      'aurelia_abbyy.xml',
      'the_past.png',
      'the_past_abbyy.xml',
    ]);

    await customActions.downloadAllFormats();
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

describe('Generate output files using images and uploaded Tesseract XML', function () {
  let driver;
  let customActions;
  this.timeout(25000);
  const appURL = process.env.SELENIUM ? `http://172.18.0.2:${port}/` : `http://localhost:${port}/`;

  before(async function () {
    ({ driver, customActions } = await createDriver());
  });

  it('3-page .pdf file', async function () {
    // Navigate to the page
    await driver.get(appURL);

    // Upload the files
    await customActions.uploadFiles([
      'scribe_test_pdf1.pdf',
      'henreys_grave_tess.xml',
      'aurelia_tess.xml',
      'the_past_tess.xml',
    ]);

    await customActions.downloadAllFormats();
  });

  it('3 .png files', async function () {
    // Navigate to the page
    await driver.get(appURL);

    // Upload the files
    await customActions.uploadFiles([
      'henreys_grave.png',
      'henreys_grave_tess.xml',
      'aurelia.png',
      'aurelia_tess.xml',
      'the_past.png',
      'the_past_tess.xml',
    ]);

    await customActions.downloadAllFormats();
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

describe('Generate output files using PDF and existing text layer', function () {
  let driver;
  let customActions;
  this.timeout(25000);
  const appURL = process.env.SELENIUM ? `http://172.18.0.2:${port}/` : `http://localhost:${port}/`;

  before(async function () {
    ({ driver, customActions } = await createDriver());
  });

  it('3-page .pdf file', async function () {
    // Navigate to the page
    await driver.get(appURL);

    // Click on the 'Download' tab
    await driver.findElement(By.id('nav-about-tab')).click();
    await driver.findElement(By.id('advancedOptionsButton')).click();
    await driver.findElement(By.id('extractTextCheckbox')).click();

    // Upload the files
    await customActions.uploadFiles([
      'scribe_test_pdf1.pdf',
    ]);

    await customActions.downloadAllFormats();
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
