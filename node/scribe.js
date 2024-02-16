import {
  confFunc, checkFunc, overlayFunc, evalFunc, recognizeFunc,
} from './cli.js';

const { Command } = require('commander');

const program = new Command();

program
  .command('conf')
  .argument('<ocr_file>', 'Input OCR file.  Accepts .hocr and Abbyy .xml (with character-level data enabled).')
  .description('Calculate confidence metric for OCR data using existing confidence info in the provided data.')
  .action(confFunc);

program
  .command('check')
  .argument('<pdf_file>', 'Input PDF file.')
  .argument('<ocr_file>', 'Input OCR file.  Accepts .hocr and Abbyy .xml (with character-level data enabled).')
  .description('Calculate confidence metric for OCR data by running Tesseract OCR and comparing results.')
  .action(checkFunc);

program
  .command('eval')
  .argument('<pdf_file>', 'Input PDF file.')
  .argument('<ocr_file>', 'Input OCR file.  Accepts .hocr and Abbyy .xml (with character-level data enabled).')
  .description('Evaluate internal OCR engine by recognizing document (provided PDF file), and comparing to ground truth (provided OCR file).')
  .action(evalFunc);

program
  .command('overlay')
  .argument('<pdf_file>', 'Input PDF file.')
  .argument('<ocr_file>', 'Input OCR file.  Accepts .hocr and Abbyy .xml (with character-level data enabled).')
  .argument('[output_dir]', 'Directory for output file(s).', '.')
  .option('-c, --conf', 'Print average confidence metric for document.')
  .option('-r, --robust', 'Generate confidence metrics by running Tesseract OCR and comparing, rather than using confidence info in provided data.')
  .description('Print OCR text visibly over provided PDF file and save result as PDF.')
  .action(overlayFunc);

program
  .command('recognize')
  .argument('<ocr_file>', 'Input OCR file.  Accepts .hocr and Abbyy .xml (with character-level data enabled).')
  .description('Calculate confidence metric for OCR data using existing confidence info in the provided data.')
  .action(recognizeFunc);

program.parse(process.argv);
