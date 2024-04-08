import { Command } from 'commander';

import {
  confCLI, checkCLI, evalInternalCLI, overlayCLI, recognizeCLI, debugCLI,
} from './cli.js';

const program = new Command();

program
  .command('conf')
  .argument('<ocr_file>', 'Input OCR file.  Accepts .hocr and Abbyy .xml (with character-level data enabled).')
  .description('Calculate confidence metric for OCR data using existing confidence info in the provided data.')
  .action(confCLI);

program
  .command('check')
  .argument('<pdf_file>', 'Input PDF file.')
  .argument('<ocr_file>', 'Input OCR file.  Accepts .hocr and Abbyy .xml (with character-level data enabled).')
  .description('Calculate confidence metric for OCR data by running Tesseract OCR and comparing results.')
  .action(checkCLI);

program
  .command('eval')
  .argument('<pdf_file>', 'Input PDF file.')
  .argument('<ocr_file>', 'Input OCR file.  Accepts .hocr and Abbyy .xml (with character-level data enabled).')
  .description('Evaluate internal OCR engine by recognizing document (provided PDF file), and comparing to ground truth (provided OCR file).')
  .action(evalInternalCLI);

program
  .command('overlay')
  .argument('<pdf_file>', 'Input PDF file.')
  .argument('<ocr_file>', 'Input OCR file.  Accepts .hocr and Abbyy .xml (with character-level data enabled).')
  .argument('[output_dir]', 'Directory for output file(s).', '.')
  .option('-c, --conf', 'Print average confidence metric for document.')
  .option('-r, --robust', 'Generate confidence metrics by running Tesseract OCR and comparing, rather than using confidence info in provided data.')
  .description('Print OCR text visibly over provided PDF file and save result as PDF.')
  .action(overlayCLI);

program
  .command('recognize')
  .argument('<pdf_file>', 'Input PDF file.')
  .description('Calculate confidence metric for OCR data using existing confidence info in the provided data.')
  .action(recognizeCLI);

program
  .command('debug')
  .argument('<pdf_file>', 'Input PDF file.')
  .argument('[output_dir]', 'Directory for output file(s).', '.')
  .option('--list <items>', 'Comma separated list of visualizations to include.', (value) => value.split(','))
  .description('Generate and write Tesseract debugging images.')
  .action(debugCLI);

program.parse(process.argv);
