import { quantile } from "./miscUtils.js";

export function renderText(hocrCurrent, removeLineBreaks = false, breaksBetweenPages = false, docxMode = false) {

  let textStr = "";
  const exportParser = new DOMParser();

  const pdfPageMinElem = /** @type {HTMLInputElement} */(document.getElementById('pdfPageMin'));
  const pdfPageMaxElem = /** @type {HTMLInputElement} */(document.getElementById('pdfPageMax'));
  let minValue = parseInt(pdfPageMinElem.value);
  let maxValue = parseInt(pdfPageMaxElem.value);

  let endsEarlyPrev = false;
  let startsLatePrev = false;
  let lastCharEndingPunct = false;

  let newLine = false;

  for (let g = (minValue - 1); g < maxValue; g++) {

    // The exact text of empty pages can be changed depending on the parser, so any data <50 chars long is assumed to be an empty page
    if (!hocrCurrent[g] || hocrCurrent[g]?.length < 50) continue;
    const pageXML = exportParser.parseFromString(hocrCurrent[g], "text/xml");
    const lines = pageXML.getElementsByClassName("ocr_line");

    const lineLeftArr = [];
    const lineRightArr = [];
    const lineWidthArr = [];
    const lineSpaceArr = [];
    let lineLeftMedian = null;
    let lineRightMedian = null;
    let lineWidthMedian = null;
    let lineSpaceMedian = null;

    if (removeLineBreaks) {

      const angle = globalThis.pageMetricsObj["angleAll"][g] * -1 ?? 0;

      let y2Prev = null;

      for (let h = 0; h < lines.length; h++) {
        const line = lines[h];

        const titleStrLine = line.getAttribute('title');

        const lineBox = [...titleStrLine.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });

        if (h > 0) {
          lineSpaceArr.push(lineBox[3] - y2Prev);
        }

        const sinAngle = Math.sin(angle * (Math.PI / 180));
        const cosAngle = Math.cos(angle * (Math.PI / 180));
  
        const x1Rot = lineBox[0] * cosAngle - sinAngle * lineBox[3];
        const x2Rot = lineBox[2] * cosAngle - sinAngle * lineBox[3];
  
        lineLeftArr.push(x1Rot);
        lineRightArr.push(x2Rot);
        
        lineWidthArr.push(lineBox[2] - lineBox[0]);

        y2Prev = lineBox[3];

      }

      lineLeftMedian = quantile(lineLeftArr, 0.5);

      lineRightMedian = quantile(lineRightArr, 0.5);

      lineWidthMedian = quantile(lineWidthArr, 0.5);

      lineSpaceMedian = quantile(lineSpaceArr, 0.5);

    }

    for (let h = 0; h < lines.length; h++) {

      // Flag lines that end early (with >=10% of the line empty)
      const endsEarly = lineRightArr[h] < (lineRightMedian - lineWidthMedian * 0.1);
      // Flag lines that start late (with >=20% of the line empty)
      // This is intended to capture floating elements (such as titles and page numbers) and not lines that are indented. 
      const startsLate = lineLeftArr[h] > (lineLeftMedian + lineWidthMedian * 0.2)

      // Add spaces or page breaks between lines
      if (h > 0) {
        if (removeLineBreaks) {
          // Add a line break if the previous line ended early
          if (endsEarlyPrev || startsLatePrev) {
            newLine = true;
          
          // Add a line break if there is blank space added between lines
          } else if (lineSpaceMedian && lineSpaceArr[h-1] > (2 * lineSpaceMedian)) {
            newLine = true;

          // Add a line break if this line is indented
          // Requires (1) line to start to the right of the median line (by 2.5% of the median width) and
          // (2) line to start to the right of the previous line and the next line. 
          } else if (lineLeftMedian && (h + 1) < lines.length && lineLeftArr[h] > (lineLeftMedian + lineWidthMedian * 0.025) && lineLeftArr[h] > lineLeftArr[h-1] && lineLeftArr[h] > lineLeftArr[h+1]) {
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

      const line = lines[h];
      const words = line.getElementsByClassName("ocrx_word");

      let fontStylePrev = "";

      for (let i = 0; i < words.length; i++) {
        const word = words[i];

        if (docxMode) {
          let styleStr = word.getAttribute('style') ?? "";

          let fontStyle;
          if (/italic/i.test(styleStr)) {
            fontStyle = "<w:i/>";
          } else if (/small\-caps/i.test(styleStr)) {
            fontStyle = "<w:smallCaps/>";
          } else {
            fontStyle = "";
          }

          if (newLine || fontStyle != fontStylePrev || (h == 0 && g == 0 && i == 0)) {
            const styleStr = fontStyle == "" ? "" : "<w:rPr>" + fontStyle + "</w:rPr>";

            if (h == 0 && g == 0 && i == 0) {
              textStr = textStr + "<w:p><w:r>" + styleStr + "<w:t>";
            } else if (newLine) {
              textStr = textStr + "</w:t></w:r></w:p><w:p><w:r>" + styleStr + "<w:t xml:space=\"preserve\">";
            } else {
              textStr = textStr + " </w:t></w:r><w:r>" + styleStr + "<w:t xml:space=\"preserve\">";
            }
          } else {
            textStr = textStr + " ";
          }
  
        } else {
          if (newLine) {
            textStr = textStr + "\n";
          } else if (h > 0 || g > 0 || i > 0) {
            textStr = textStr + " ";
          }
        }

        newLine = false;

        textStr = textStr + word.textContent;

  

        // If this is the last word on the page, check if it contains ending punctuation
        if ((h+1) == lines.length && (i+1) == words.length) {
          lastCharEndingPunct = /[?.!]/.test(word.textContent);
        }

      }
    }
  }

  return textStr;

  // const textBlob = new Blob([textStr], { type: 'text/plain' });
  // const downloadFileNameElem = /** @type {HTMLInputElement} */(document.getElementById('downloadFileName'));
  // let fileName = downloadFileNameElem.value.replace(/\.\w{1,4}$/, "") + ".txt";

  // saveAs(textBlob, fileName);

}