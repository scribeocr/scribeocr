import ocr from './objects/ocrObjects.js';
import { round6 } from './miscUtils.js';

/**
 *
 * @param {Array<OcrPage>} ocrData
 * @param {*} fontMetrics
 * @param {*} layoutData
 * @param {number} minValue
 * @param {number} maxValue
 */
export function renderHOCR(ocrData, fontMetrics, layoutData, minValue, maxValue) {
  let hocrOut = String.raw`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"
    "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
 <head>
  <title></title>`;

  // Add font metrics data
  hocrOut += `<meta name='font-metrics' content='${JSON.stringify(fontMetrics)}'></meta>`;

  // Add layout box data
  hocrOut += `<meta name='layout' content='${JSON.stringify(layoutData)}'></meta>`;

  hocrOut += `<meta http-equiv="Content-Type" content="text/html;charset=utf-8"/>
  <meta name='ocr-system' content='tesseract 5.0.0-beta-20210916-12-g19cc9' />
  <meta name='ocr-capabilities' content='ocr_page ocr_carea ocr_par ocr_line ocrx_word ocrp_wconf ocrp_lang ocrp_dir ocrp_font ocrp_fsize'/>
 </head>
 <body>`;

  for (let i = minValue; i <= maxValue; i++) {
    const pageObj = ocrData[i];

    // Handle case where ocrPage object does not exist.
    if (!pageObj) {
      hocrOut += `<div class='ocr_page' title='bbox 0 0 ${pageMetricsArr[i].dims.width} ${pageMetricsArr[i].dims.height}'>`;
      hocrOut += '</div>';
      continue;
    }

    hocrOut += `<div class='ocr_page' title='bbox 0 0 ${pageObj.dims.width} ${pageObj.dims.height}'>`;
    for (const lineObj of pageObj.lines) {
      hocrOut += `<span class='ocr_line' title="bbox ${lineObj.bbox.left} ${lineObj.bbox.top} ${lineObj.bbox.right} ${lineObj.bbox.bottom}`;
      hocrOut += `; baseline ${round6(lineObj.baseline[0])} ${Math.round(lineObj.baseline[1])}`;
      hocrOut += `; x_size ${lineObj.ascHeight}`;
      if (lineObj.xHeight) hocrOut += `; x_ascenders ${lineObj.ascHeight - lineObj.xHeight}`;
      hocrOut += '">';
      for (const wordObj of lineObj.words) {
        hocrOut += `<span class='ocrx_word' id='${wordObj.id}' title='bbox ${wordObj.bbox.left} ${wordObj.bbox.top} ${wordObj.bbox.right} ${wordObj.bbox.bottom}`;
        hocrOut += `;x_wconf ${wordObj.conf}`;

        if (wordObj.font && wordObj.font !== 'Default') {
          hocrOut += `;x_font ${wordObj.font}`;
        }

        hocrOut += "'";

        // TODO: Why are we representing font family and style using the `style` HTML element here?
        // This is not how Tesseract does things, and our own parsing script does not appear to be written to re-import it properly.
        // Add "style" attribute (if applicable)
        if (['italic', 'small-caps'].includes(wordObj.style) || (wordObj.font && wordObj.font !== 'Default')) {
          hocrOut = `${hocrOut} style='`;

          if (wordObj.style === 'italic') {
            hocrOut = `${hocrOut}font-style:italic;`;
          } else if (wordObj.style === 'small-caps') {
            hocrOut = `${hocrOut}font-variant:small-caps;`;
          }

          if (wordObj.font && wordObj.font !== 'Default') {
            hocrOut = `${hocrOut}font-family:${wordObj.font}`;
          }

          hocrOut = `${hocrOut}'>`;
        } else {
          hocrOut = `${hocrOut}>`;
        }

        // Add word text, along with any formatting that uses nested elements rather than attributes
        if (wordObj.sup) {
          hocrOut = `${hocrOut}<sup>${ocr.escapeXml(wordObj.text)}</sup></span>`;
        } else if (wordObj.dropcap) {
          hocrOut = `${hocrOut}<span class='ocr_dropcap'>${ocr.escapeXml(wordObj.text)}</span></span>`;
        } else {
          hocrOut = `${hocrOut + ocr.escapeXml(wordObj.text)}</span>`;
        }
      }
      hocrOut = `${hocrOut}</span>`;
    }
    hocrOut += '</div>';
  }

  hocrOut += '</body></html>';

  return hocrOut;
}
