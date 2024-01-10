// This spec tests the case where ONLY image data is provided, with no OCR data from either recognition or upload.
// While this is a fringe case, it should not result in an error being thrown. 

import { test as baseTest, expect } from '@playwright/test';
import fs from 'fs';
import path from "path";
import { fileURLToPath } from 'url';
globalThis.__dirname = path.dirname(fileURLToPath(import.meta.url));

// Create a custom fixture
const test = baseTest.extend({
  waitImport: async ({ page }, use) => {
    // Custom function to wait for import to finish
    async function waitImport() {
      await page.waitForSelector('#import-progress-collapse .progress-bar');
      const maxValue = await page.getAttribute('#import-progress-collapse .progress-bar', 'aria-valuemax');
      await expect(page.locator('#import-progress-collapse .progress-bar')).toHaveAttribute('aria-valuenow', maxValue);
    }

    // Use the custom fixture in your tests
    await use(waitImport);
  },

  waitRecognizeAll: async ({ page }, use) => {
    // Custom function to wait for import to finish
    async function waitRecognizeAll() {
      await page.waitForSelector('#recognize-recognize-progress-collapse .progress-bar');
      const maxValue = await page.getAttribute('#recognize-recognize-progress-collapse .progress-bar', 'aria-valuemax');
      await expect(page.locator('#recognize-recognize-progress-collapse .progress-bar')).toHaveAttribute('aria-valuenow', maxValue, { timeout: 60000 });
    }

    // Use the custom fixture in your tests
    await use(waitRecognizeAll);
  },

  async downloadAllFormats({ page }, use) {
    async function downloadAllFormats(basename, content = true) {
      // Function to download a specific format
      async function downloadFormat(downloadButtonSelector, formatOptionSelector, extension) {
        await page.click(downloadButtonSelector);
        await page.click(formatOptionSelector);
        await page.click('#download');
        
        // Wait for and verify the download
        const [download] = await Promise.all([
          page.waitForEvent('download'), // Wait for the download event
          page.click('#download') // Trigger the download
        ]);

        // Files created generally are required to be at least 200 bytes.
        // In theory we should actually validate the content of downloads, but this would be much more complicated to implement.
        // The exception is .txt files for tests with no OCR data--the expected size in this case is 0.
        const minSize = !content && extension == ".txt" ? -1 : 200;

        expect(download.suggestedFilename()).toBe(basename + extension);
        expect((await fs.promises.stat(await download.path())).size).toBeGreaterThan(minSize);

      }

      await downloadFormat('#downloadFormat', '#formatLabelOptionText', '.txt');
      await downloadFormat('#downloadFormat', '#formatLabelOptionHOCR', '.hocr');
      await downloadFormat('#downloadFormat', '#formatLabelOptionDocx', '.docx');
      await downloadFormat('#downloadFormat', '#formatLabelOptionPDF', '.pdf');
    }

    await use(downloadAllFormats);
  }
});


test.describe('Produces output files from uploaded ABBYY OCR data (but no images)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.appReady = true);

  });

  test('1 ABBYY .xml file', async ({ page, waitImport, downloadAllFormats }) => {
    await page.setInputFiles('#openFileInput', path.join(__dirname, 'assets/aurelia_abbyy.xml')); // Update the file path
    await waitImport();

    await page.click('#nav-download-tab');
    await page.waitForTimeout(250);

    await downloadAllFormats('aurelia_abbyy');
  });

  test('3 ABBYY .xml files', async ({ page, waitImport, downloadAllFormats }) => {
    await page.setInputFiles('#openFileInput', [
      path.join(__dirname, 'assets/henreys_grave_abbyy.xml'),
      path.join(__dirname, 'assets/aurelia_abbyy.xml'),
      path.join(__dirname, 'assets/the_past_abbyy.xml'),
    ]); // Update the file paths
    await waitImport();

    await page.click('#nav-download-tab');
    await page.click('#downloadFormat');
    await page.click('#formatLabelOptionText');
    await page.click('#download');
    await downloadAllFormats('henreys_grave_abbyy');
  });
});


test.describe('Produces output files from image upload no OCR data upload for', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.appReady = true);

  });

  test('.pdf file', async ({ page, waitImport, downloadAllFormats }) => {
    await page.setInputFiles('#openFileInput', path.join(__dirname, 'assets/aurelia.pdf')); // Update the file path
    await waitImport();

    await page.click('#nav-download-tab');
    await page.waitForTimeout(250);

    await downloadAllFormats('aurelia', false);
  });

  test('.png file', async ({ page, waitImport, downloadAllFormats }) => {
    await page.setInputFiles('#openFileInput', path.join(__dirname, 'assets/aurelia.png')); // Update the file path
    await waitImport();

    await page.click('#nav-download-tab');

    await downloadAllFormats('aurelia', false);
  });

  test('3 .png files', async ({ page, waitImport, downloadAllFormats }) => {
    await page.setInputFiles('#openFileInput', [
      path.join(__dirname, 'assets/henreys_grave.png'),
      path.join(__dirname, 'assets/aurelia.png'),
      path.join(__dirname, 'assets/the_past.png'),
    ]); // Update the file paths
    await waitImport();

    await page.click('#nav-download-tab');
    await page.click('#downloadFormat');
    await page.click('#formatLabelOptionText');
    await page.click('#download');
    await downloadAllFormats('henreys_grave', false);
  });
});

test.describe('Produces output files from image upload and ABBYY OCR data upload for', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.appReady = true);

  });

  test('.pdf file', async ({ page, waitImport, downloadAllFormats }) => {
    await page.setInputFiles('#openFileInput', [
      path.join(__dirname, 'assets/aurelia.pdf'),
      path.join(__dirname, 'assets/aurelia_abbyy.xml')
    ]); // Update the file path
    await waitImport();

    await page.click('#nav-download-tab');
    await page.waitForTimeout(250);

    await downloadAllFormats('aurelia');
  });

  test('.png file', async ({ page, waitImport, downloadAllFormats }) => {
    await page.setInputFiles('#openFileInput', [
      path.join(__dirname, 'assets/aurelia.png'),
      path.join(__dirname, 'assets/aurelia_abbyy.xml')
    ]); // Update the file path
    await waitImport();

    await page.click('#nav-download-tab');

    await downloadAllFormats('aurelia');
  });

  test('3 .png files', async ({ page, waitImport, downloadAllFormats }) => {
    await page.setInputFiles('#openFileInput', [
      path.join(__dirname, 'assets/henreys_grave.png'),
      path.join(__dirname, 'assets/aurelia.png'),
      path.join(__dirname, 'assets/the_past.png'),
      path.join(__dirname, 'assets/henreys_grave_abbyy.xml'),
      path.join(__dirname, 'assets/aurelia_abbyy.xml'),
      path.join(__dirname, 'assets/the_past_abbyy.xml'),
    ]); // Update the file paths
    await waitImport();

    await page.click('#nav-download-tab');
    await page.click('#downloadFormat');
    await page.click('#formatLabelOptionText');
    await page.click('#download');
    await downloadAllFormats('henreys_grave');
  });
});

test.describe('Produces output files from image upload and Tesseract OCR data upload for', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.appReady = true);

  });

  test('.pdf file', async ({ page, waitImport, downloadAllFormats }) => {
    await page.setInputFiles('#openFileInput', [
      path.join(__dirname, 'assets/aurelia.pdf'),
      path.join(__dirname, 'assets/aurelia_tess.xml')
    ]); // Update the file path
    await waitImport();

    await page.click('#nav-download-tab');
    await page.waitForTimeout(250);

    await downloadAllFormats('aurelia');
  });

  test('.png file', async ({ page, waitImport, downloadAllFormats }) => {
    await page.setInputFiles('#openFileInput', [
      path.join(__dirname, 'assets/aurelia.png'),
      path.join(__dirname, 'assets/aurelia_tess.xml')
    ]); // Update the file path
    await waitImport();

    await page.click('#nav-download-tab');

    await downloadAllFormats('aurelia');
  });

  test('3 .png files', async ({ page, waitImport, downloadAllFormats }) => {
    await page.setInputFiles('#openFileInput', [
      path.join(__dirname, 'assets/henreys_grave.png'),
      path.join(__dirname, 'assets/aurelia.png'),
      path.join(__dirname, 'assets/the_past.png'),
      path.join(__dirname, 'assets/henreys_grave_tess.xml'),
      path.join(__dirname, 'assets/aurelia_tess.xml'),
      path.join(__dirname, 'assets/the_past_tess.xml'),
    ]); // Update the file paths
    await waitImport();

    await page.click('#nav-download-tab');
    await page.click('#downloadFormat');
    await page.click('#formatLabelOptionText');
    await page.click('#download');
    await downloadAllFormats('henreys_grave');
  });
});


test.describe('Produces output files from image upload and recognized OCR data for', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.appReady = true);

  });

  test('.pdf file', async ({ page, waitImport, downloadAllFormats, waitRecognizeAll }) => {
    await page.setInputFiles('#openFileInput', path.join(__dirname, 'assets/aurelia.pdf')); // Update the file path
    await waitImport();

    // Click the 'Recognize' tab and wait for recognition
    await page.click('#nav-recognize-tab');
    await page.click('#recognizeAll');
    await waitRecognizeAll();

    await page.click('#nav-download-tab');
    await page.waitForTimeout(250);

    await downloadAllFormats('aurelia');
  });

  test('.png file', async ({ page, waitImport, downloadAllFormats, waitRecognizeAll }) => {
    await page.setInputFiles('#openFileInput', path.join(__dirname, 'assets/aurelia.png')); // Update the file path
    await waitImport();

    // Click the 'Recognize' tab and wait for recognition
    await page.click('#nav-recognize-tab');
    await page.click('#recognizeAll');
    await waitRecognizeAll();
  

    await page.click('#nav-download-tab');

    await downloadAllFormats('aurelia');
  });

  test('3 .png files', async ({ page, waitImport, downloadAllFormats, waitRecognizeAll }) => {
    await page.setInputFiles('#openFileInput', [
      path.join(__dirname, 'assets/henreys_grave.png'),
      path.join(__dirname, 'assets/aurelia.png'),
      path.join(__dirname, 'assets/the_past.png'),
    ]); // Update the file paths
    await waitImport();

    // Click the 'Recognize' tab and wait for recognition
    await page.click('#nav-recognize-tab');
    await page.click('#recognizeAll');
    await waitRecognizeAll();


    await page.click('#nav-download-tab');
    await page.click('#downloadFormat');
    await page.click('#formatLabelOptionText');
    await page.click('#download');
    await downloadAllFormats('henreys_grave');
  });
});
