import { ocr } from './ocrObjects.js';
import { round6 } from "./miscUtils.js";

// export function renderHOCR1(hocrCurrent, fontMetricsObj) {

//   let minValue = parseInt(/** @type {HTMLInputElement} */(document.getElementById('pdfPageMin')).value);
//   let maxValue = parseInt(/** @type {HTMLInputElement} */(document.getElementById('pdfPageMax')).value);

//   const exportParser = new DOMParser();
//   let firstPageStr;
//   // Normally the content from the first page is used, however when the first page is empty or encounters a parsing error another page is used
//   for (let i = (minValue - 1); i < maxValue; i++) {
//     // The exact text of empty pages can be changed depending on the parser, so any data <50 chars long is assumed to be an empty page
//     if (hocrCurrent[i]?.length > 50) {
//       firstPageStr = hocrCurrent[i].replace(/\<html\>/, "<html xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"en\" lang=\"en\">");
//       break;
//     }
//   }

//   // If HTML start/end nodes do not already exist, append them now
//   // This is relevant for OCR data generated within this program,
//   // as well as imported Abbyy data.
//   if (!/[^\>\n]*?(xml|html)/.test(firstPageStr)) {
//     let html_start = String.raw`<?xml version="1.0" encoding="UTF-8"?>
// <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"
//     "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
// <html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
//  <head>
//   <title></title>
//   <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/>
//   <meta name='ocr-system' content='tesseract 5.0.0-beta-20210916-12-g19cc9' />
//   <meta name='ocr-capabilities' content='ocr_page ocr_carea ocr_par ocr_line ocrx_word ocrp_wconf ocrp_lang ocrp_dir ocrp_font ocrp_fsize'/>
//  </head>
//  <body>`

//     let html_end = String.raw` </body>
// </html>`

//     firstPageStr = html_start + firstPageStr + html_end;
//   }

//   let exportXML = exportParser.parseFromString(firstPageStr, "text/xml");

//   // Add font metrics data
//   let fontXML = exportParser.parseFromString("<meta name='font-metrics' content='" + JSON.stringify(fontMetricsObj) + "'></meta>", "text/xml");
//   exportXML.getElementsByTagName("head")[0].appendChild(fontXML.firstChild);

//   // Add layout box data
//   const layoutXML = exportParser.parseFromString("<meta name='layout' content='" + JSON.stringify(globalThis.layout) + "'></meta>", "text/xml");
//   exportXML.getElementsByTagName("head")[0].appendChild(layoutXML.firstChild);

//   // TODO: Consider how empty pages are handled (e.g. what happens when the first page is empty)
//   for (let i = minValue; i < maxValue; i++) {

//     const pageXML = hocrCurrent[i]?.length > 50 ? exportParser.parseFromString(hocrCurrent[i], "text/xml") : exportParser.parseFromString('<div class="ocr_page"></div>', "text/xml");

//     exportXML.body.appendChild(pageXML.getElementsByClassName("ocr_page")[0])

//   }

//   let hocrInt = exportXML.documentElement.outerHTML;
//   hocrInt = hocrInt.replaceAll(/xmlns\=[\'\"]{2}\s?/ig, "");


//   let hocrBlob = new Blob([hocrInt], { type: 'text/plain' });

//   let fileName = /** @type {HTMLInputElement} */(document.getElementById("downloadFileName")).value.replace(/\.\w{1,4}$/, "") + ".hocr";

//   saveAs(hocrBlob, fileName);
// }


/**
 * @param {Array<ocrPage>} ocrData - ...
 */
export function renderHOCR(ocrData, fontData, layoutData) {
  const minValue = parseInt(/** @type {HTMLInputElement} */(document.getElementById('pdfPageMin')).value) - 1;
  const maxValue = parseInt(/** @type {HTMLInputElement} */(document.getElementById('pdfPageMax')).value);

  const exportParser = new DOMParser();

  let hocrOut = String.raw`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"
    "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
 <head>
  <title></title>
  <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/>
  <meta name='ocr-system' content='tesseract 5.0.0-beta-20210916-12-g19cc9' />
  <meta name='ocr-capabilities' content='ocr_page ocr_carea ocr_par ocr_line ocrx_word ocrp_wconf ocrp_lang ocrp_dir ocrp_font ocrp_fsize'/>
 </head>
 <body>`

 for (let i = minValue; i < maxValue; i++) {
  const pageObj = ocrData[i];
  hocrOut += "<div class='ocr_page' title='bbox 0 0 " + pageObj.dims[1] + " " + pageObj.dims[0] + "'>";
  for (let j = 0; j < pageObj.lines.length; j++) {
    const lineObj = pageObj.lines[j];
    hocrOut += "<span class='ocr_line' title=\"bbox " + lineObj.bbox[0] + " " + lineObj.bbox[1] + " " + lineObj.bbox[2] + " " + lineObj.bbox[3];
    hocrOut += "; baseline " + round6(lineObj.baseline[0]) + " " + Math.round(lineObj.baseline[1]);
    hocrOut +=  "; x_size " + lineObj.letterHeight 
    if (lineObj.ascHeight) hocrOut += "; x_ascenders " + lineObj.ascHeight;
    if (lineObj.descHeight) hocrOut += "; x_descenders " + lineObj.descHeight;
    hocrOut += "\">";
    for (let k = 0; k < lineObj.words.length; k++) {
      const wordObj = lineObj.words[k];
      hocrOut += "<span class='ocrx_word' id='" + wordObj.id + "' title='bbox " + wordObj.bbox[0] + " " + wordObj.bbox[1] + " " + wordObj.bbox[2] + " " + wordObj.bbox[3];
      hocrOut += ";x_wconf " + wordObj.conf; 
      hocrOut += "\'"

      // Add "style" attribute (if applicable)
      if(["italic","small-caps"].includes(wordObj.style) || wordObj.font != "Default") {
        hocrOut = hocrOut + " style='"

        if (wordObj.style == "italic") {
          hocrOut = hocrOut + "font-style:italic" ;
        } else if (wordObj.style == "small-caps") {
          hocrOut = hocrOut + "font-variant:small-caps";
        } 

        if (wordObj.font != "Default") {
          hocrOut = hocrOut + "font-family:" + wordObj.font;
        }

        hocrOut = hocrOut + "'>"
      } else {
        hocrOut = hocrOut + ">"
      }

      // Add word text, along with any formatting that uses nested elements rather than attributes
      if (wordObj.sup) {
        hocrOut = hocrOut + "<sup>" + ocr.escapeXml(wordObj.text) + "</sup>" + "</span>";
      } else if (wordObj.dropcap) {
        hocrOut = hocrOut + "<span class='ocr_dropcap'>" + ocr.escapeXml(wordObj.text) + "</span>" + "</span>";
      } else {
        hocrOut = hocrOut + ocr.escapeXml(wordObj.text) + "</span>";
      }
    }
    hocrOut = hocrOut + "</span>"
  }
  hocrOut += "</div>";
 }

 hocrOut += "</body></html>";

 let exportXML = exportParser.parseFromString(hocrOut, "text/xml");

 // Add font metrics data
 let fontXML = exportParser.parseFromString("<meta name='font-metrics' content='" + JSON.stringify(fontData) + "'></meta>", "text/xml");
 exportXML.getElementsByTagName("head")[0].appendChild(fontXML.firstChild);

 // Add layout box data
 const layoutXML = exportParser.parseFromString("<meta name='layout' content='" + JSON.stringify(layoutData) + "'></meta>", "text/xml");
 exportXML.getElementsByTagName("head")[0].appendChild(layoutXML.firstChild);

 let hocrInt = exportXML.documentElement.outerHTML;
 hocrInt = hocrInt.replaceAll(/xmlns\=[\'\"]{2}\s?/ig, "");

 let hocrBlob = new Blob([hocrInt], { type: 'text/plain' });

 let fileName = /** @type {HTMLInputElement} */(document.getElementById("downloadFileName")).value.replace(/\.\w{1,4}$/, "") + ".hocr";

 saveAs(hocrBlob, fileName);

}