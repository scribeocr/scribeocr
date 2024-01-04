const { Command } = require("commander");

import { confFunc, checkFunc, overlayFunc } from "./cli.js";

const program = new Command();

program
  .command('conf')
  .argument('<ocr_file>', 'Input OCR file.  Accepts .hocr and Abbyy .xml (with character-level data enabled).')
  .description("Calculate confidence metric for OCR data using existing confidence info in the provided data.")
  .action(confFunc);

program
  .command('check')
  .argument('<pdf_file>', 'Input PDF file.')
  .argument('<ocr_file>', 'Input OCR file.  Accepts .hocr and Abbyy .xml (with character-level data enabled).')
  .description("Calculate confidence metric for OCR data by running Tesseract OCR and comparing results.")
  .action(checkFunc);

program
  .command('overlay')
  .argument('<pdf_file>', 'Input PDF file.')
  .argument('<ocr_file>', 'Input OCR file.  Accepts .hocr and Abbyy .xml (with character-level data enabled).')
  .argument('[output_dir]', 'Directory for output file(s).', '.')
  .option("-c, --conf", "Print average confidence metric for document.")
  .option("-r, --robust", "Generate confidence metrics by running Tesseract OCR and comparing, rather than using confidence info in provided data.")
  .description("Print OCR text visibly over provided PDF file and save result as PDF.")
  .action(overlayFunc);

program.parse(process.argv)
