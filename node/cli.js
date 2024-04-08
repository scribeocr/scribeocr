import {
  conf, check, evalInternal, overlay, recognize, debug,
} from './main.js';

export const confCLI = async (ocrFile) => {
  await conf(ocrFile);
  process.exitCode = 0;
};

export const checkCLI = async (pdfFile, ocrFile) => {
  await check(pdfFile, ocrFile);
  process.exitCode = 0;
};

export const evalInternalCLI = async (pdfFile, ocrFile) => {
  const { evalMetrics } = await evalInternal(pdfFile, ocrFile);

  const ignoreExtra = true;
  let metricWER;
  if (ignoreExtra) {
    metricWER = Math.round(((evalMetrics.incorrect + evalMetrics.missed) / evalMetrics.total) * 100) / 100;
  } else {
    metricWER = Math.round(((evalMetrics.incorrect + evalMetrics.missed + evalMetrics.extra)
      / evalMetrics.total) * 100) / 100;
  }
  console.log(`Word Error Rate: ${metricWER}`);
  process.exitCode = 0;
};

export const overlayCLI = async (pdfFile, ocrFile, outputDir, options) => {
  await overlay(pdfFile, ocrFile, outputDir, options);
  process.exitCode = 0;
};

export const recognizeCLI = async (pdfFile) => {
  const res = await recognize(pdfFile);
  console.log(res.text);
  process.exitCode = 0;
};

export const debugCLI = async (pdfFile, outputDir, options) => {
  await debug(pdfFile, outputDir, options);
  process.exitCode = 0;
};
