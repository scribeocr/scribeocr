import { inputData } from '../containers/app.js';
import { pageMetricsArr } from '../containers/dataContainer.js';
import { getParText } from '../objects/ocrObjects.js';
import { assignParagraphs } from '../utils/ocrUtils.js';

/**
 * Exports paragraphs as string with a JSON object on each line.
 *
 * @param {Array<OcrPage>} ocrCurrent -
 * @param {number} minpage - The first page to include in the document.
 * @param {number} maxpage - The last page to include in the document.
 */
export function renderParJSON(ocrCurrent, minpage = 0, maxpage = -1) {
  let jsonStr = '';

  if (maxpage === -1) maxpage = ocrCurrent.length - 1;

  let locN = 1;

  for (let g = (minpage - 1); g <= maxpage; g++) {
    if (!ocrCurrent[g] || ocrCurrent[g].lines.length === 0) continue;

    const pageObj = ocrCurrent[g];

    const angle = pageMetricsArr[g].angle || 0;
    assignParagraphs(pageObj, angle);

    for (let h = 0; h < pageObj.pars.length; h++) {
      const par = pageObj.pars[h];
      const parExpObj = {
        filename: inputData.inputFileNames[0],
        loc: locN,
        content: getParText(par),
        metadata: {
          type: 'UncategorizedText',
          page: g,
          coords: [Math.round(par.bbox.left), Math.round(par.bbox.top), Math.round(par.bbox.right), Math.round(par.bbox.bottom)],
        },
      };
      if (locN > 1) jsonStr += '\n';
      jsonStr += JSON.stringify(parExpObj);
      locN++;
    }
  }

  return jsonStr;
}
