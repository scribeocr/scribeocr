// This file writes a CSV file containing OCR words listed in a tabular format.
// This is useful for debugging purposes, as the usual JSON format is difficult to review.
// This output is different from the standard tabular output formats,
// which are used to export tables from the input document, rather than list out all words.

import ocr from '../objects/ocrObjects.js';

/**
 * Escapes special characters in CSV fields.
 * @param {string|number|boolean|object} field - The field to escape.
 */
const escapeCSVField = (field) => {
  if (typeof field === 'object') {
    // return JSON.stringify(field).replace(/"/g, '""');
    return `"${JSON.stringify(field).replace(/"/g, '""')}"`;
  }
  if (typeof field === 'string') {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
};

/**
     * Converts an array of objects with atomic properties (string, number, boolean) to a CSV string.
     * @param {Array<Object>} data - The array of data objects.
     * @returns {string} - The CSV string.
     */
export const convertToCSV = (data) => {
  if (data.length === 0) {
    return '';
  }

  const headers = Object.keys(data[0]);
  const rows = data.map((item) => headers.map((header) => escapeCSVField(item[header])).join(','));

  return [headers.join(','), ...rows].join('\n');
};

/**
 *
 * @param {Array<OcrPage>} pages
 * @returns
 */
export const writeDebugCsv = (pages) => {
  let csvStr = '';

  for (let i = 0; i < pages.length; i++) {
    const words = ocr.getPageWords(pages[i]).map((word) => {
      word = structuredClone(word);
      // @ts-ignore
      delete word.line;
      return word;
    });

    let csvStrI = convertToCSV(words);

    // Remove header row if this is not the first page.
    // The leading newline character is not removed, as it is needed to separate the pages.
    if (i > 0) {
      const firstNewlineIndex = csvStrI.indexOf('\n');
      if (firstNewlineIndex !== -1) csvStrI = csvStrI.slice(firstNewlineIndex);
    }

    csvStr += csvStrI;
  }

  return csvStr;
};
