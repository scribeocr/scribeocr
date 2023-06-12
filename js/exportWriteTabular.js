import {
    BlobWriter,
    TextReader,
    ZipWriter,
  } from "../lib/zip.js/index.js";

import {  xlsxStrings, sheetStart, sheetEnd } from "./xlsxFiles.js";

import { calcOverlap } from "./compareHOCR.js";

const parser = new DOMParser();

export function createCells(hocrStrA, layoutObj, extraCols = [], startRow = 0, xlsxMode = true, htmlMode = false) {

  if (!layoutObj?.boxes || Object.keys(layoutObj?.boxes).length == 0) return {content: "", rows: 0};

  const hocrA = parser.parseFromString(hocrStrA, "text/xml");
  const hocrALines = hocrA.getElementsByClassName("ocr_line");

  const priorityArr = Array(hocrALines.length);
  const lineBoxArr = Array(hocrALines.length);

  // Unlike when exporting to text, anything not in a rectangle is excluded (priority 11) by default
  priorityArr.fill(11);

  for (let i = 0; i < hocrALines.length; i++) {
    const hocrALine = hocrALines[i];
    const titleStrLineA = hocrALine.getAttribute('title');
    const lineBoxA = [...titleStrLineA.matchAll(/bbox(?:es)?(\s+[\d\-]+)(\s+[\d\-]+)?(\s+[\d\-]+)?(\s+[\d\-]+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });
    lineBoxArr[i] = lineBoxA;

    const lineBoxALeft = [lineBoxA[0], lineBoxA[1], lineBoxA[0] + 1, lineBoxA[3]];

    for (const [id, obj] of Object.entries(layoutObj.boxes)) {
       
      const overlap = obj.inclusionRule == "left" ? calcOverlap(lineBoxALeft, obj["coords"]) : calcOverlap(lineBoxA, obj["coords"]);
      if (overlap > 0.5) {
        if (obj["type"] == "order") {
          priorityArr[i] = obj["priority"];
        } else if (obj["type"] == "exclude") {
          // Priority "11" is used to remove lines
          priorityArr[i] = 11;
        }
      } 
    }
  }

  // Split lines into separate arrays for each column
  let lastCol = -1;
  const colArrHocr = [];
  const colArrBox = [];
  for (let i = 0; i <= 10; i++) {
    for (let j = 0; j < priorityArr.length; j++) {
      if (priorityArr[j] == i) {
        if (i != lastCol) {
          colArrHocr.push([]);
          colArrBox.push([]);
          lastCol = i;
        }
        colArrHocr[colArrHocr.length-1].push(hocrALines[j].cloneNode(true));
        colArrBox[colArrBox.length-1].push(lineBoxArr[j]);
      }
    }
  }

  // Create rows
  let rowIndex = 0;
  // let lastBottom = 0;
  const indexArr = Array(colArrBox.length);
  indexArr.fill(0);
  const lengthArr = colArrBox.map(x => x.length);

  const dataObj = {};

  // To split lines into cells, the highest line on the page (that has not already been assigned to a cell) is idenified,
  // and establishes a the vertical bounds of a new row. 
  // Next, the first unassigned line in each column is checked for whether it belongs in the new row.
  // If this is true, additional lines from each column can also be inserted into the same row. 
  // This is necessary as a "line" in HOCR does not necessarily correspond to a visual line--
  // multiple HOCR "lines" may have the same visual baseline so belong in the same cell. 
  while (!indexArr.every((x, index) => x == lengthArr[index])) {
    
    const compArrBox = indexArr.map((x, index) => colArrBox[index][x]);
    compArrBox.sort((a, b) => a[3] - b[3])
    const rowBox = [0, 0, 5000, compArrBox[0][3]];

    for (let i = 0; i < indexArr.length; i++) {
      for (let j = indexArr[i]; j < colArrBox[i].length; j++) {
        const overlap = calcOverlap(colArrBox[i][j], rowBox);
        if (overlap > 0.5) {
          if (!dataObj[String(rowIndex) + "," + String(i)]) dataObj[String(rowIndex) + "," + String(i)] = [];
          dataObj[String(rowIndex) + "," + String(i)].push(colArrHocr[i][j]);
          indexArr[i]++;
        } else {
          break;
        }
      }
    }
    rowIndex++;
  }

  const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"]

  let textStr = "";
  for (let i = 0; i < rowIndex; i++) {
    if (xlsxMode) {
      textStr += "<row r=\"" + String(startRow+i+1) + "\">";
    } else if (htmlMode) {
      textStr += "<tr>"
    }

    for (let j = 0; j < extraCols.length; j++) {
      // Escape special characters for XML
      const colTxt = extraCols[j].replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&apos;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      if (xlsxMode) {
        textStr += "<c r=\"" + letters[j] + String(startRow+i+1) + "\" t=\"inlineStr\"><is><r><t xml:space=\"preserve\">" + colTxt + "</t></r></is></c>";
      } else if (htmlMode) {
        textStr += "<td>" + colTxt + "</td>"
      }
    }

    for (let j = 0; j < colArrBox.length; j++) {
      const lines = dataObj[String(i) + "," + String(j)];

      // In xlsx, empty cells are omitted entirely.  For other formats they are included.
      if (!lines || lines.length == 0) {
        if (htmlMode) {
          textStr += "<td/>"
        }
        continue;
      }

      if (xlsxMode) {
        textStr += "<c r=\"" + letters[j+extraCols.length] + String(startRow+i+1) + "\" t=\"inlineStr\"><is>";
      } else if (htmlMode) {
        textStr += "<td>";
      }
      
      for (let k = 0; k < lines.length; k++) {
        const line = lines[k];

        const words = line.getElementsByClassName("ocrx_word");

        let fontStylePrev = "";
  
        for (let l = 0; l < words.length; l++) {
          const word = words[l];
  
          if (xlsxMode) {
            let styleStr = word.getAttribute('style') ?? "";
  
            let fontStyle;
            if (/italic/i.test(styleStr)) {
              fontStyle = "<i/>";
            } else if (/small\-caps/i.test(styleStr)) {
              fontStyle = "<smallCaps/>";
            } else {
              fontStyle = "";
            }
  
            if (fontStyle != fontStylePrev || k == 0 || l == 0) {
              const styleStr = fontStyle == "" ? "" : "<rPr>" + fontStyle + "</rPr>";
  
              if (k == 0 && l == 0) {
                textStr = textStr + "<r>" + styleStr + "<t xml:space=\"preserve\">";
              } else if (l == 0) {
                textStr = textStr + "</t></r><r>" + styleStr + "<t xml:space=\"preserve\">";
              } else {
                textStr = textStr + " </t></r><r>" + styleStr + "<t xml:space=\"preserve\">";
              }
            } else {
              textStr = textStr + " ";
            }
          } else {
            textStr = textStr + " ";
          }
    
          // DOCX is an XML format, so any escaped XML characters need to continue being escaped.
          if (xlsxMode) {
            // TODO: For now we just delete superscript tags.
            // Eventually this should be added to Word exports properly. 
            textStr = textStr + word.innerHTML.replace(/\s*\<sup\>/i, "").replace(/\<\/sup\>\s*/i, "");
          } else {
            textStr = textStr + word.textContent;
          }
        }
      }

      if (xlsxMode) {
        textStr += "</t></r></is></c>";
      } else if (htmlMode) {
        textStr += "</td>";
      }

    }

    if (xlsxMode) {
      textStr += "</row>";
    } else if (htmlMode) {
      textStr += "</tr>";
    }
  }

  return {content: textStr, rows: rowIndex}

}


export async function writeXlsx(hocrCurrent) {

  const addFilenameMode = document.getElementById("xlsxFilenameColumn").checked;
  const addPageNumberColumnMode = document.getElementById("xlsxPageNumberColumn").checked;

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
    if (addPageNumberColumnMode) extraCols.push(String(i+1));
  
    const cellsObj = createCells(hocrCurrent[i], globalThis.layout[i], extraCols, rowCount);
    rowCount += cellsObj.rows;
    sheetContent += cellsObj.content;
  }
  sheetContent += sheetEnd;

  const textReader = new TextReader(sheetContent);
  await zipWriter.add("xl/worksheets/sheet1.xml", textReader);


  for (let i=0; i<xlsxStrings.length; i++) {
    const textReader = new TextReader(xlsxStrings[i]["content"]);
    await zipWriter.add(xlsxStrings[i]["path"], textReader);
  }

  await zipWriter.close();
  
  const zipFileBlob = await zipFileWriter.getData();
  

  const downloadFileNameElem = /** @type {HTMLInputElement} */(document.getElementById('downloadFileName'));
  let fileName = downloadFileNameElem.value.replace(/\.\w{1,4}$/, "") + ".xlsx";

  saveAs(zipFileBlob, fileName);

}