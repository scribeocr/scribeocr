import { main } from './main.js';

export const confFunc = async (ocrFile) => {
  await main('conf', { ocrFile });
  process.exitCode = 0;
};

export const checkFunc = async (pdfFile, ocrFile) => {
  await main('check', { pdfFile, ocrFile });
  process.exitCode = 0;
};

export const evalFunc = async (pdfFile, ocrFile) => {
  const { evalMetrics } = await main('eval', { pdfFile, ocrFile });

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

export const overlayFunc = async (pdfFile, ocrFile, outputDir, options) => {
  await main('overlay', {
    pdfFile, ocrFile, outputDir, robustConfMode: options?.robust || false, printConf: options?.conf || false,
  });
  process.exitCode = 0;
};

export const recognizeFunc = async (pdfFile) => {
  const res = await main('recognize', { pdfFile });
  console.log(res.text);
  process.exitCode = 0;
};

export const debugFunc = async (pdfFile, outputDir, options) => {
  await main('debug', {
    pdfFile, outputDir, list: options?.list,
  });
  process.exitCode = 0;
};
