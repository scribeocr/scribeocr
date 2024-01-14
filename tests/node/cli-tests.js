import { expect } from 'chai';
import { confFunc, checkFunc, overlayFunc } from '../../node/cli.js';
import path from 'path';
import { fileURLToPath } from 'url';
globalThis.__dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Check `conf` Node.js command.', () => {
  this.timeout(5000);

  let originalConsoleLog;
  let consoleOutput;

  beforeEach(() => {
    // Store the original console.log
    originalConsoleLog = console.log;

    // Replace console.log with a function to capture output
    consoleOutput = "";
    console.log = (output) => consoleOutput = consoleOutput + output;
  });

  afterEach(() => {
    // Restore the original console.log
    console.log = originalConsoleLog;
  });


  it('Should print confidence of Abbyy .xml file.', async () => {
    // Call the function
    await confFunc(path.join(__dirname, '../assets/scribe_test_pdf1_abbyy.xml'));

    // originalConsoleLog(consoleOutput);

    // Assert that console.log was called with 'blah'
    expect(consoleOutput).to.include('Confidence: 0.93944');
  });
});
