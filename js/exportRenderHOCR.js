import { ocr } from './ocrObjects.js';
import { round6 } from "./miscUtils.js";

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