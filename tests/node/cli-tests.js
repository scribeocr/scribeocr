import { assert, expect } from 'chai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getRandomAlphanum } from '../../js/utils/miscUtils.js';
import { checkCLI, confCLI, overlayCLI } from '../../node/cli.js';

globalThis.__dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Check Node.js commands.', () => {
  let originalConsoleLog;
  let consoleOutput;

  // The temp directory used for testing must be different than the temp directory using in the application code,
  // as the latter is deleted at the end of the function.
  let tmpUniqueDir;
  const tmpUnique = {
    get: async () => {
      const { tmpdir } = await import('os');
      const { mkdirSync } = await import('fs');

      if (!tmpUniqueDir) {
        tmpUniqueDir = `${tmpdir()}/${getRandomAlphanum(8)}`;
        mkdirSync(tmpUniqueDir);
      }
      return tmpUniqueDir;
    },
    delete: async () => {
      if (tmpUniqueDir) {
        const { rmSync } = await import('fs');
        rmSync(tmpUniqueDir, { recursive: true, force: true });
      }
    },
  };

  beforeEach(() => {
    // Store the original console.log
    originalConsoleLog = console.log;

    // Replace console.log with a function to capture output
    consoleOutput = '';
    console.log = (output) => {
      consoleOutput += output;
      // originalConsoleLog(output);
    };
  });

  afterEach(() => {
    // Restore the original console.log
    console.log = originalConsoleLog;
  });

  it('Should print confidence of Abbyy .xml file.', async () => {
    // Call the function
    await confCLI(path.join(__dirname, '../assets/scribe_test_pdf1_abbyy.xml'));

    // originalConsoleLog(consoleOutput);

    // Assert that console.log was called with 'blah'
    expect(consoleOutput).to.include('Confidence: 0.939');
  }).timeout(10000);

  it('Should check contents of Abbyy .xml file.', async () => {
    // Call the function
    await checkCLI(path.join(__dirname, '../assets/scribe_test_pdf1.pdf'), path.join(__dirname, '../assets/scribe_test_pdf1_abbyy.xml'));

    // originalConsoleLog(consoleOutput);

    // Assert that console.log was called with 'blah'
    expect(consoleOutput).to.include('Confidence: 0.929');
  }).timeout(30000);

  it('Overlay .pdf and Abbyy .xml file.', async () => {
    const tmpDir = await tmpUnique.get();

    // Call the function
    await overlayCLI(path.join(__dirname, '../assets/scribe_test_pdf1.pdf'), path.join(__dirname, '../assets/scribe_test_pdf1_abbyy.xml'), tmpDir, { vis: true });

    const outputPath = `${tmpDir}/scribe_test_pdf1_vis.pdf`;

    assert.isOk(fs.existsSync(outputPath));
  }).timeout(20000);

  it('Overlay .pdf and Abbyy .xml file and print confidence.', async () => {
    const tmpDir = await tmpUnique.get();

    // Call the function
    await overlayCLI(path.join(__dirname, '../assets/scribe_test_pdf1.pdf'), path.join(__dirname, '../assets/scribe_test_pdf1_abbyy.xml'), tmpDir, { conf: true, vis: true });

    expect(consoleOutput).to.include('Confidence: 0.939');

    const outputPath = `${tmpDir}/scribe_test_pdf1_vis.pdf`;

    assert.isOk(fs.existsSync(outputPath));
  }).timeout(20000);

  // TODO: The files should be deleted between tests;
  it('Overlay .pdf and Abbyy .xml file, validating OCR results.', async () => {
    const tmpDir = await tmpUnique.get();

    // Call the function
    await overlayCLI(path.join(__dirname, '../assets/scribe_test_pdf1.pdf'), path.join(__dirname, '../assets/scribe_test_pdf1_abbyy.xml'), tmpDir, { robust: true, vis: true });

    const outputPath = `${tmpDir}/scribe_test_pdf1_vis.pdf`;

    assert.isOk(fs.existsSync(outputPath));
  }).timeout(30000);

  it('Overlay .pdf and Abbyy .xml file, validating OCR results and printing confidence.', async () => {
    const tmpDir = await tmpUnique.get();

    // Call the function
    await overlayCLI(path.join(__dirname, '../assets/scribe_test_pdf1.pdf'), path.join(__dirname, '../assets/scribe_test_pdf1_abbyy.xml'), tmpDir, { robust: true, conf: true, vis: true });

    if (!/0.929/.test(consoleOutput)) originalConsoleLog(consoleOutput);

    expect(consoleOutput).to.include('Confidence: 0.929');

    const outputPath = `${tmpDir}/scribe_test_pdf1_vis.pdf`;

    assert.isOk(fs.existsSync(outputPath));
  }).timeout(30000);

  after(async () => {
    await tmpUnique.delete();
  });
}).timeout(120000);
