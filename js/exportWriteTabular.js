import {
  BlobWriter,
  TextReader,
  ZipWriter,
} from '../lib/zip.js/index.js';

import { xlsxStrings, sheetStart, sheetEnd } from './xlsxFiles.js';

import { calcOverlap } from './modifyOCR.js';

import ocr from './objects/ocrObjects.js';

import { saveAs } from './miscUtils.js';

/**
 * @param {OcrPage} pageObj
 */
export function createCells(pageObj, layoutObj, extraCols = [], startRow = 0, xlsxMode = true, htmlMode = false) {
  if (!layoutObj?.boxes || Object.keys(layoutObj?.boxes).length === 0) return { content: '', rows: 0 };

  const tableIndexes = [...new Set(Object.values(layoutObj.boxes).map((x) => x.table))];

  if (tableIndexes.length === 0) return { content: '', rows: 0 };

  let textStr = '';
  let rowIndex = startRow;
  let rowCount = 0;
  for (const i of tableIndexes) {
    // Filter layout boxes to specific table
    const boxesArg = Object.values(layoutObj.boxes).filter((x) => x.type === 'dataColumn' && x.table === i);
    const cellsSingle = createCellsSingle(pageObj, boxesArg, extraCols, rowIndex, xlsxMode, htmlMode);
    textStr += cellsSingle.content;
    rowIndex += cellsSingle.rows;
    rowCount += cellsSingle.rows;
  }

  return { content: textStr, rows: rowCount };
}

// TODO: This currently creates junk rows with only punctuation, as those bounding boxes are so small they often do not overlap with other lines.
/**
 * Convert a single table into HTML or Excel XML rows
 * @param {OcrPage} pageObj
 */
function createCellsSingle(pageObj, boxes, extraCols = [], startRow = 0, xlsxMode = true, htmlMode = false, previewMode = true) {
  const wordArr = [];
  const boxArr = [];
  const wordPriorityArr = [];

  // Sort boxes by left bound.
  const boxesArr = Object.values(boxes).sort((a, b) => a.coords[0] - b.coords[0]);

  // Unlike when exporting to text, anything not in a rectangle is excluded by default
  // priorityArr.fill(boxesArr.length+1);

  for (let i = 0; i < pageObj.lines.length; i++) {
    const lineObj = ocr.cloneLine(pageObj.lines[i]);
    ocr.rotateLine(lineObj, pageObj.angle * -1, pageObj.dims);

    // First, check for overlap with line-level boxes.
    const lineBoxALeft = [lineObj.bbox[0], lineObj.bbox[1], lineObj.bbox[0] + 1, lineObj.bbox[3]];

    let boxFound = false;
    // It is possible for a single line to match the inclusion criteria for multiple boxes.
    // Only the first (leftmost) match is used.
    for (let j = 0; j < boxesArr.length; j++) {
      const obj = boxesArr[j];

      if (obj.inclusionLevel !== 'line') continue;

      const overlap = obj.inclusionRule === 'left' ? calcOverlap(lineBoxALeft, obj.coords) : calcOverlap(lineObj.bbox, obj.coords);
      if (overlap > 0.5) {
        for (let k = 0; k < lineObj.words.length; k++) {
          const wordObj = lineObj.words[k];
          wordArr.push(wordObj);
          boxArr.push(lineObj.bbox);
          wordPriorityArr.push(j);
        }
        boxFound = true;
        break;
      }
    }

    if (boxFound) continue;

    // Second, check for overlap on the word-level boxes.
    for (let k = 0; k < lineObj.words.length; k++) {
      const wordObj = lineObj.words[k];

      for (let j = 0; j < boxesArr.length; j++) {
        const obj = boxesArr[j];

        if (obj.inclusionLevel !== 'word') continue;

        const wordBoxALeft = [wordObj.bbox[0], wordObj.bbox[1], wordObj.bbox[0] + 1, wordObj.bbox[3]];

        const overlap = obj.inclusionRule === 'left' ? calcOverlap(wordBoxALeft, obj.coords) : calcOverlap(wordObj.bbox, obj.coords);

        if (overlap > 0.5) {
          wordArr.push(wordObj);
          boxArr.push(wordObj.bbox);
          wordPriorityArr.push(j);
          break;
        }
      }
    }
  }

  // Split lines into separate arrays for each column
  let lastCol = -1;
  const colArr = [];
  for (let i = 0; i <= boxesArr.length; i++) {
    for (let j = 0; j < wordPriorityArr.length; j++) {
      if (wordPriorityArr[j] === i) {
        if (i !== lastCol) {
          colArr.push([]);
          lastCol = i;
        }
        colArr[colArr.length - 1].push({ word: wordArr[j], box: boxArr[j] });
      }
    }
  }

  // For each array, sort all words by lower bound.
  // The following steps assume that the words are ordered.
  for (let i = 0; i < colArr.length; i++) {
    colArr[i].sort((a, b) => a.box[3] - b.box[3]);
  }

  // Create rows
  let rowIndex = 0;
  // let lastBottom = 0;
  const indexArr = Array(colArr.length);
  indexArr.fill(0);
  const lengthArr = colArr.map((x) => x.length);

  const dataObj = {};

  // To split lines into cells, the highest line on the page (that has not already been assigned to a cell) is idenified,
  // and establishes a the vertical bounds of a new row.
  // Next, the first unassigned line in each column is checked for whether it belongs in the new row.
  // If this is true, additional lines from each column can also be inserted into the same row.
  // This is necessary as a "line" in HOCR does not necessarily correspond to a visual line--
  // multiple HOCR "lines" may have the same visual baseline so belong in the same cell.
  while (!indexArr.every((x, index) => x == lengthArr[index])) {
    // Identify highest unassigned word
    const compArrBox = indexArr.map((x, index) => colArr[index][x]);
    compArrBox.sort((a, b) => a.box[3] - b.box[3]);
    const rowBox = [0, 0, 5000, compArrBox[0].box[3]];

    for (let i = 0; i < indexArr.length; i++) {
      for (let j = indexArr[i]; j < colArr[i].length; j++) {
        const overlap = calcOverlap(colArr[i][j].box, rowBox);
        if (overlap > 0.5) {
          if (!dataObj[`${String(rowIndex)},${String(i)}`]) dataObj[`${String(rowIndex)},${String(i)}`] = [];
          dataObj[`${String(rowIndex)},${String(i)}`].push(colArr[i][j].word);
          indexArr[i]++;
        } else {
          break;
        }
      }
    }
    rowIndex++;
  }

  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

  let textStr = '';
  for (let i = 0; i < rowIndex; i++) {
    if (xlsxMode) {
      textStr += `<row r="${String(startRow + i + 1)}">`;
    } else if (htmlMode) {
      textStr += '<tr>';
    }

    for (let j = 0; j < extraCols.length; j++) {
      // Escape special characters for XML
      let colTxt = ocr.escapeXml(extraCols[j]);
      if (xlsxMode) {
        textStr += `<c r="${letters[j]}${String(startRow + i + 1)}" t="inlineStr"><is><r><t xml:space="preserve">${colTxt}</t></r></is></c>`;
      } else if (htmlMode) {
        // When generating an HTML preview, file names are abbreviated for readability
        if (previewMode && colTxt.length > 13) {
          colTxt = `${colTxt.slice(0, 20)}...`;
        }
        textStr += `<td>${colTxt}</td>`;
      }
    }

    for (let j = 0; j < colArr.length; j++) {
      const words = dataObj[`${String(i)},${String(j)}`];

      // In xlsx, empty cells are omitted entirely.  For other formats they are included.
      if (!words || words.length === 0) {
        if (htmlMode) {
          textStr += '<td/>';
        }
        continue;
      }

      // Sort left to right so words are printed in the correct order
      words.sort((a, b) => a.bbox[0] - b.bbox[0]);

      if (xlsxMode) {
        textStr += `<c r="${letters[j + extraCols.length]}${String(startRow + i + 1)}" t="inlineStr"><is>`;
      } else if (htmlMode) {
        textStr += '<td>';
      }

      for (let k = 0; k < words.length; k++) {
        const wordObj = words[k];

        const fontStylePrev = '';

        if (xlsxMode) {
          let fontStyle;
          if (wordObj.style === 'italic') {
            fontStyle = '<i/>';
          } else if (wordObj.style === 'small-caps') {
            fontStyle = '<smallCaps/>';
          } else {
            fontStyle = '';
          }

          if (fontStyle !== fontStylePrev || k === 0) {
            const styleStr = fontStyle === '' ? '' : `<rPr>${fontStyle}</rPr>`;

            if (k === 0) {
              textStr = `${textStr}<r>${styleStr}<t xml:space="preserve">`;
            } else {
              textStr = `${textStr} </t></r><r>${styleStr}<t xml:space="preserve">`;
            }
          } else {
            textStr += ' ';
          }
        } else {
          textStr += ' ';
        }

        // DOCX is an XML format, so any escaped XML characters need to continue being escaped.
        if (xlsxMode) {
          // TODO: For now we just delete superscript tags.
          // Eventually this should be added to Word exports properly.
          textStr += ocr.escapeXml(wordObj.text);
        } else {
          textStr += wordObj.text;
        }
      }

      if (xlsxMode) {
        textStr += '</t></r></is></c>';
      } else if (htmlMode) {
        textStr += '</td>';
      }
    }

    if (xlsxMode) {
      textStr += '</row>';
    } else if (htmlMode) {
      textStr += '</tr>';
    }
  }

  return { content: textStr, rows: rowIndex };
}

export async function writeXlsx(hocrCurrent) {
  const addFilenameMode = document.getElementById('xlsxFilenameColumn').checked;
  const addPageNumberColumnMode = document.getElementById('xlsxPageNumberColumn').checked;

  const zipFileWriter = new BlobWriter();
  const zipWriter = new ZipWriter(zipFileWriter);

  let sheetContent = sheetStart;
  let rowCount = 0;
  for (let i = 0; i < hocrCurrent.length; i++) {
    const extraCols = [];
    if (addFilenameMode) {
      if (inputDataModes.pdfMode) {
        extraCols.push(globalThis.inputFileNames[0]);
      } else {
        extraCols.push(globalThis.inputFileNames[i]);
      }
    }
    if (addPageNumberColumnMode) extraCols.push(String(i + 1));

    const cellsObj = createCells(hocrCurrent[i], globalThis.layout[i], extraCols, rowCount);
    rowCount += cellsObj.rows;
    sheetContent += cellsObj.content;
  }
  sheetContent += sheetEnd;

  const textReader = new TextReader(sheetContent);
  await zipWriter.add('xl/worksheets/sheet1.xml', textReader);

  for (let i = 0; i < xlsxStrings.length; i++) {
    const textReader = new TextReader(xlsxStrings[i].content);
    await zipWriter.add(xlsxStrings[i].path, textReader);
  }

  await zipWriter.close();

  const zipFileBlob = await zipFileWriter.getData();

  const downloadFileNameElem = /** @type {HTMLInputElement} */(document.getElementById('downloadFileName'));
  const fileName = `${downloadFileNameElem.value.replace(/\.\w{1,4}$/, '')}.xlsx`;

  saveAs(zipFileBlob, fileName);
}
