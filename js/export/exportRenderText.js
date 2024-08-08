import { pageMetricsArr } from '../containers/dataContainer.js';
import ocr from '../objects/ocrObjects.js';
import { assignParagraphs } from '../utils/reflowPars.js';

/**
 * Convert an array of ocrPage objects to plain text, or XML for a Word document.
 *
 * @param {Array<OcrPage>} ocrCurrent -
 * @param {number} minpage - The first page to include in the document.
 * @param {number} maxpage - The last page to include in the document.
 * @param {boolean} reflowText - Remove line breaks within what appears to be the same paragraph.
 * @param {boolean} docxMode - Create XML for a word document rather than plain text.
 */
export function renderText(ocrCurrent, minpage = 0, maxpage = -1, reflowText = false, docxMode = false) {
  let textStr = '';

  if (maxpage === -1) maxpage = ocrCurrent.length - 1;

  let newLine = false;

  for (let g = minpage; g <= maxpage; g++) {
    if (!ocrCurrent[g] || ocrCurrent[g].lines.length === 0) continue;

    const pageObj = ocrCurrent[g];

    if (reflowText) {
      const angle = pageMetricsArr[g].angle || 0;
      assignParagraphs(pageObj, angle);
    }

    let parCurrent = pageObj.lines[0].par;

    let fontStylePrev = '';
    let supPrev = false;

    for (let h = 0; h < pageObj.lines.length; h++) {
      const lineObj = pageObj.lines[h];

      if (reflowText) {
        if (g > 0 && h === 0 || lineObj.par !== parCurrent) newLine = true;
        parCurrent = lineObj.par;
      } else {
        newLine = true;
      }

      for (let i = 0; i < lineObj.words.length; i++) {
        const wordObj = lineObj.words[i];
        if (!wordObj) continue;

        if (docxMode) {
          let fontStyle = '';
          if (wordObj.style === 'italic') {
            fontStyle += '<w:i/>';
          } else if (wordObj.style === 'bold') {
            fontStyle += '<w:b/>';
          }

          if (wordObj.smallCaps) {
            fontStyle += '<w:smallCaps/>';
          }

          if (wordObj.sup) {
            fontStyle += '<w:vertAlign w:val="superscript"/>';
          }

          if (newLine || fontStyle !== fontStylePrev || (h === 0 && g === 0 && i === 0)) {
            const styleStr = fontStyle === '' ? '' : `<w:rPr>${fontStyle}</w:rPr>`;

            if (h === 0 && g === 0 && i === 0) {
              textStr = `${textStr}<w:p><w:r>${styleStr}<w:t xml:space="preserve">`;
            } else if (newLine) {
              textStr = `${textStr}</w:t></w:r></w:p><w:p><w:r>${styleStr}<w:t xml:space="preserve">`;
            // If the previous word was a superscript, the space is added switching back to normal text.
            } else if (supPrev) {
              textStr = `${textStr}</w:t></w:r><w:r>${styleStr}<w:t xml:space="preserve"> `;
            // If this word is a superscript, no space is added between words.
            } else if (wordObj.sup && i > 0) {
              textStr = `${textStr}</w:t></w:r><w:r>${styleStr}<w:t xml:space="preserve">`;
            } else {
              textStr = `${textStr} </w:t></w:r><w:r>${styleStr}<w:t xml:space="preserve">`;
            }
          } else {
            textStr += ' ';
          }

          fontStylePrev = fontStyle;
          supPrev = wordObj.sup;
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
      }
    }
  }

  // Add final closing tags
  if (docxMode && textStr) textStr += '</w:t></w:r></w:p>';

  return textStr;
}
