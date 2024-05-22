import { quantile } from './miscUtils.js';
import ocr from './objects/ocrObjects.js';
import { pageMetricsArr } from './containers/miscContainer.js';

/**
 * Convert an array of ocrPage objects to plain text, or XML for a Word document.
 *
 * @param {Array<OcrPage>} hocrCurrent -
 * @param {boolean} removeLineBreaks - Remove line breaks within what appears to be the same paragraph.
 *    This allows for reflowing text.
 * @param {boolean} breaksBetweenPages - Add line breaks between pages.
 * @param {boolean} docxMode - Create XML for a word document rather than plain text.
 */
export function renderText(hocrCurrent, removeLineBreaks = false, breaksBetweenPages = false, docxMode = false) {
  let textStr = '';

  const pdfPageMinElem = /** @type {HTMLInputElement} */(document.getElementById('pdfPageMin'));
  const pdfPageMaxElem = /** @type {HTMLInputElement} */(document.getElementById('pdfPageMax'));
  const minValue = parseInt(pdfPageMinElem.value);
  const maxValue = parseInt(pdfPageMaxElem.value);

  let endsEarlyPrev = false;
  let startsLatePrev = false;
  let lastCharEndingPunct = false;

  let newLine = false;

  for (let g = (minValue - 1); g < maxValue; g++) {
    if (!hocrCurrent[g]) continue;

    const pageObj = hocrCurrent[g];

    const lineLeftArr = [];
    const lineRightArr = [];
    const lineWidthArr = [];
    const lineSpaceArr = [];
    /** @type {?number} */
    let lineLeftMedian = null;
    /** @type {?number} */
    let lineRightMedian = null;
    /** @type {?number} */
    let lineWidthMedian = null;
    /** @type {?number} */
    let lineSpaceMedian = null;

    if (removeLineBreaks) {
      const angle = pageMetricsArr[g].angle * -1 ?? 0;

      /** @type {?number} */
      let y2Prev = null;

      for (let h = 0; h < pageObj.lines.length; h++) {
        const lineObj = pageObj.lines[h];
        if (!lineObj) continue;

        const lineBox = lineObj.bbox;

        if (y2Prev !== null) {
          lineSpaceArr.push(lineBox.bottom - y2Prev);
        }

        const sinAngle = Math.sin(angle * (Math.PI / 180));
        const cosAngle = Math.cos(angle * (Math.PI / 180));

        const x1Rot = lineBox.left * cosAngle - sinAngle * lineBox.bottom;
        const x2Rot = lineBox.top * cosAngle - sinAngle * lineBox.bottom;

        lineLeftArr.push(x1Rot);
        lineRightArr.push(x2Rot);

        lineWidthArr.push(lineBox.right - lineBox.left);

        y2Prev = lineBox.bottom;
      }

      lineLeftMedian = quantile(lineLeftArr, 0.5);

      lineRightMedian = quantile(lineRightArr, 0.5);

      lineWidthMedian = quantile(lineWidthArr, 0.5);

      lineSpaceMedian = quantile(lineSpaceArr, 0.5);
    }

    for (let h = 0; h < pageObj.lines.length; h++) {
      // Flag lines that end early (with >=10% of the line empty)
      const endsEarly = lineRightArr[h] < (lineRightMedian - lineWidthMedian * 0.1);
      // Flag lines that start late (with >=20% of the line empty)
      // This is intended to capture floating elements (such as titles and page numbers) and not lines that are indented.
      const startsLate = lineLeftArr[h] > (lineLeftMedian + lineWidthMedian * 0.2);

      // Add spaces or page breaks between lines
      if (h > 0) {
        if (removeLineBreaks) {
          // Add a line break if the previous line ended early
          if (endsEarlyPrev || startsLatePrev) {
            newLine = true;

          // Add a line break if there is blank space added between lines
          } else if (lineSpaceMedian && lineSpaceArr[h - 1] > (2 * lineSpaceMedian)) {
            newLine = true;

          // Add a line break if this line is indented
          // Requires (1) line to start to the right of the median line (by 2.5% of the median width) and
          // (2) line to start to the right of the previous line and the next line.
          } else if (lineLeftMedian && (h + 1) < pageObj.lines.length && lineLeftArr[h] > (lineLeftMedian + lineWidthMedian * 0.025)
            && lineLeftArr[h] > lineLeftArr[h - 1] && lineLeftArr[h] > lineLeftArr[h + 1]) {
            newLine = true;
          }
        } else {
          newLine = true;
        }
      } else if (g > 0) {
        if (removeLineBreaks && !breaksBetweenPages) {
          if (endsEarlyPrev || startsLatePrev || lastCharEndingPunct) {
            newLine = true;
          }
        } else {
          newLine = true;
        }
      }

      endsEarlyPrev = endsEarly;
      startsLatePrev = startsLate;

      const lineObj = pageObj.lines[h];

      const fontStylePrev = '';

      for (let i = 0; i < lineObj.words.length; i++) {
        const wordObj = lineObj.words[i];
        if (!wordObj) continue;

        if (docxMode) {
          let fontStyle = '';
          if (wordObj.style === 'italic') {
            fontStyle = '<w:i/>';
          } else if (wordObj.style === 'small-caps') {
            fontStyle = '<w:smallCaps/>';
          }

          if (newLine || fontStyle !== fontStylePrev || (h === 0 && g === 0 && i === 0)) {
            const styleStr = fontStyle === '' ? '' : `<w:rPr>${fontStyle}</w:rPr>`;

            if (h === 0 && g === 0 && i === 0) {
              textStr = `${textStr}<w:p><w:r>${styleStr}<w:t xml:space="preserve">`;
            } else if (newLine) {
              textStr = `${textStr}</w:t></w:r></w:p><w:p><w:r>${styleStr}<w:t xml:space="preserve">`;
            } else {
              textStr = `${textStr} </w:t></w:r><w:r>${styleStr}<w:t xml:space="preserve">`;
            }
          } else {
            textStr += ' ';
          }
        } else if (newLine) {
          textStr = `${textStr}\n`;
        } else if (h > 0 || g > 0 || i > 0) {
          textStr = `${textStr} `;
        }

        newLine = false;

        // DOCX is an XML format, so any escaped XML characters need to continue being escaped.
        if (docxMode) {
          // TODO: Figure out how to properly export superscripts to Word
          textStr += ocr.escapeXml(wordObj.text);
        } else {
          textStr += wordObj.text;
        }

        // If this is the last word on the page, check if it contains ending punctuation
        if ((h + 1) === pageObj.lines.length && (i + 1) === lineObj.words.length) {
          lastCharEndingPunct = /[?.!]/.test(wordObj.text);
        }
      }
    }
  }

  // Add final closing tags
  if (docxMode && textStr) textStr += '</w:t></w:r></w:p>';

  return textStr;
}
