
import { renderPageQueue, displayPage } from "../main.js";
import { getRandomAlphanum } from "./miscUtils.js";

var parser = new DOMParser();

export async function initConvertPageWorker() {

	return new Promise((resolve, reject) => {
		let obj = {};
		const url = new URL('./convertPageWorker.js', import.meta.url);
		let worker = globalThis.document ? new Worker(url) : new Worker(url, { type: 'module' });

        worker.promises = {};
        worker.promiseId = 0;
        worker.onmessage = async function (event) {
			const n = event.data[1];
			const argsObj = event.data[2];
		  
			// Detect if the new data needs to be combined with existing data.
			// This occurs when using "recognize area" mode on a page with existing OCR data. 
			if(argsObj["mode"] == "area") {
			  const lines = currentPage.xmlDoc?.getElementsByClassName("ocr_line");
			  if(lines && lines.length > 0) {
				combineData(event.data[0][0]);
				renderPageQueue(currentPage.n, 'screen', false);
				worker.promises[event.data[event.data.length - 1]].resolve(event.data);
				return;
			  }
			}
		  
			const oemCurrent = !argsObj["engine"] || argsObj["mode"] != "full" || argsObj["engine"] == document.getElementById("displayLabelText")?.innerHTML ? true : false;
		  
			// If an OEM engine is specified, save to the appropriate object within ocrAll,
			// and only set to hocrCurrent if appropriate.  This prevents "Recognize All" from
			// overwriting the wrong output if a user switches hocrCurrent to another OCR engine
			// while the recognition job is running.
			if (argsObj["engine"] && argsObj["mode"] == "full") {
			  globalThis.ocrAll[argsObj["engine"]][n]["hocr"] = event.data[0][0] || "<div class='ocr_page'></div>";
			  if (oemCurrent) {
				globalThis.hocrCurrent[n] = event.data[0][0] || "<div class='ocr_page'></div>";
			  }
			} else {
			  globalThis.hocrCurrent[n] = event.data[0][0] || "<div class='ocr_page'></div>";
			}
		  
			// When using the "Recognize Area" feature the XML dimensions will be smaller than the page dimensions
			if (argsObj["mode"] == "area") {
			  globalThis.pageMetricsObj["dimsAll"][n] = [currentPage.backgroundImage.height, currentPage.backgroundImage.width];
			  globalThis.hocrCurrent[n] = globalThis.hocrCurrent[n].replace(/bbox( \d+)+/, "bbox 0 0 " + currentPage.backgroundImage.width + " " + currentPage.backgroundImage.height);
			} else {
			  globalThis.pageMetricsObj["dimsAll"][n] = event.data[0][1];
			}
		  
			inputDataModes.xmlMode[n] = true;
		  
			globalThis.pageMetricsObj["angleAll"][n] = event.data[0][2];
			globalThis.pageMetricsObj["leftAll"][n] = event.data[0][3];
			globalThis.pageMetricsObj["angleAdjAll"][n] = event.data[0][4];

			// Layout boxes are only overwritten if none exist yet for the page
			if (Object.keys(globalThis.layout[n].boxes).length == 0) globalThis.layout[n].boxes = event.data[0][6];
		  
			if(argsObj["saveMetrics"] ?? true){
			  fontMetricObjsMessage[n] = event.data[0][5];
			}
		  
			// If this is the page the user has open, render it to the canvas
			if (n == currentPage.n && oemCurrent) {
				displayPage(currentPage.n);
			}
		  
            worker.promises[event.data[event.data.length - 1]].resolve(event.data);
        }
        resolve(obj);

		function wrap(func) {
			return function(...args) {
				const msgArgs = args[0];
				if(msgArgs.length == 3) msgArgs.push({});

				return new Promise(function (resolve, reject) {
                    let id = worker.promiseId++;
					worker.promises[id] = { resolve: resolve, reject: reject, func: func};
					worker.postMessage([func, msgArgs, id]);
				});
			}
		}

		obj.convertPage = wrap("convertPage");
		obj.convertPageAbbyy = wrap("convertPageAbbyy");
		obj.convertPageStext = wrap("convertPageStext");
	})
};


function combineData(hocrString){

	const lines = currentPage.xmlDoc?.getElementsByClassName("ocr_line");
  
	const lineRegex = new RegExp(/<span class\=[\"\']ocr_line[\s\S]+?(?:\<\/span\>\s*){2}/, "ig");
	const hocrLinesArr = hocrString.match(lineRegex);
  
	if (!hocrLinesArr) return;
  
	  // Otherwise, integrate the new data into the existing data
	  for (let i = 0; i < hocrLinesArr.length; i++) {
		const lineNewStr = hocrLinesArr[i];
		const titleStrLine = lineNewStr.match(/title\=[\'\"]([^\'\"]+)/)?.[1];
		const lineNew = parser.parseFromString(lineNewStr, "text/xml").firstChild;
		if (![...titleStrLine.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0]) {
		  return;
		}
		const lineBoxNew = [...titleStrLine.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0]?.slice(1, 5).map(function (x) { return parseInt(x); });
	
		// For whatever reason Tesseract sometimes returns junk data with negative coordinates.
		// In such cases, the above regex will fail to match anything.
		if (!lineBoxNew) return;
	
		const sinAngle = Math.sin(globalThis.pageMetricsObj["angleAll"][currentPage.n] * (Math.PI / 180));
	
		// Identify the OCR line a bounding box is in (or closest line if no match exists)
		let lineI = -1;
		let match = false;
		let newLastLine = false;
		let lineBottomHOCR, line, lineMargin;
		do {
		  lineI = lineI + 1;
		  line = lines[lineI];
		  const titleStrLine = line.getAttribute('title');
		  const lineBox = [...titleStrLine.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });
		  let baseline = titleStrLine.match(/baseline(\s+[\d\.\-]+)(\s+[\d\.\-]+)/);
	
		  let boxOffsetY = 0;
		  let lineBoxAdj = lineBox.slice();
		  if (baseline != null) {
			baseline = baseline.slice(1, 5).map(function (x) { return parseFloat(x); });
	
			// Adjust box such that top/bottom approximate those coordinates at the leftmost point.
			if (baseline[0] < 0) {
			  lineBoxAdj[1] = lineBoxAdj[1] - (lineBoxAdj[2] - lineBoxAdj[0]) * baseline[0];
			} else {
			  lineBoxAdj[3] = lineBoxAdj[3] - (lineBoxAdj[2] - lineBoxAdj[0]) * baseline[0];
			}
			//boxOffsetY = (lineBoxNew[0] + (lineBoxNew[2] - lineBoxNew[0]) / 2 - lineBoxAdj[0]) * baseline[0];
			boxOffsetY = (lineBoxNew[0] + (lineBoxNew[2] - lineBoxNew[0]) / 2 - lineBoxAdj[0]) * sinAngle;
		  } else {
			baseline = [0, 0];
		  }
	
		  // Calculate size of margin to apply when detecting overlap (~30% of total height applied to each side)
		  // This prevents a very small overlap from causing a word to be placed on an existing line
		  const lineHeight = lineBoxAdj[3] - lineBoxAdj[1];
		  lineMargin = Math.round(lineHeight * 0.30);
	
		  let lineTopHOCR = lineBoxAdj[1] + boxOffsetY;
		  lineBottomHOCR = lineBoxAdj[3] + boxOffsetY;
	
		  if ((lineTopHOCR + lineMargin) < lineBoxNew[3] && (lineBottomHOCR - lineMargin) >= lineBoxNew[1]) match = true;
		  if ((lineBottomHOCR - lineMargin) < lineBoxNew[1] && lineI + 1 == lines.length) newLastLine = true;
	
		} while ((lineBottomHOCR - lineMargin) < lineBoxNew[1] && lineI + 1 < lines.length);
	
		let words = line.getElementsByClassName("ocrx_word");
		let wordsNew = lineNew.getElementsByClassName("ocrx_word");
	
		if (match) {
		  // Inserting wordNew seems to remove it from the wordsNew array
		  const wordsNewLen = wordsNew.length;
		  for (let i = 0; i < wordsNewLen; i++) {
			let wordNew = wordsNew[0];
  
			let wordNewtitleStr = wordNew.getAttribute('title') ?? "";
			const wordBoxNew = [...wordNewtitleStr.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });
  
			// Identify closest word on existing line
			let word, wordBox;
			let j = 0;
			do {
			  word = words[j];
			  if (!word.childNodes[0]?.textContent.trim()) continue;
			  let titleStr = word.getAttribute('title') ?? "";
			  wordBox = [...titleStr.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });
			  j = j + 1;
			} while (wordBox[2] < wordBoxNew[0] && j < words.length);
	
			// Replace id (which is likely duplicative) with unique id
			let wordChosenID = word.getAttribute('id');
			let wordIDNew = wordChosenID + getRandomAlphanum(3);
			wordNew.setAttribute("id", wordIDNew)
	
			// Add to page XML
			// Note: Words will appear correctly on the canvas (and in the pdf) regardless of whether they are in the right order.
			// However, it is still important to get the order correct (this makes evaluation easier, improves copy/paste functionality in some pdf readers, etc.)
			if (wordBoxNew[0] > wordBox[0]) {
			  word.insertAdjacentElement("afterend", wordNew);
			} else {
			  word.insertAdjacentElement("beforebegin", wordNew);
			}
		  }
		} else {
		  // Replace id (which is likely duplicative) with unique id
		  let lineChosenID = lineNew.getAttribute('id');
		  let lineIDNew = lineChosenID + getRandomAlphanum(3);
		  lineNew.setAttribute("id", lineIDNew);
	
		  for (let i = 0; i < wordsNew.length; i++) {
			let wordNew = wordsNew[i];
	
			// Replace id (which is likely duplicative) with unique id
			let wordChosenID = wordNew.getAttribute('id');
			let wordIDNew = wordChosenID + getRandomAlphanum(3);
			wordNew.setAttribute("id", wordIDNew)
		  }
	
		  if (newLastLine) {
			line.insertAdjacentElement("afterend", lineNew);
		  } else {
			line.insertAdjacentElement("beforebegin", lineNew);
		  }
		}
	  }
	
	  if(currentPage.xmlDoc?.documentElement?.getElementsByTagName("parsererror")?.length == 0) {
		globalThis.hocrCurrent[currentPage.n] = currentPage.xmlDoc?.documentElement.outerHTML;
	  }
	  
  }
  
  