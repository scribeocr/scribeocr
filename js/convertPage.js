
import { renderPageQueue, displayPage } from "../main.js";
import { getRandomAlphanum } from "./miscUtils.js";
import { combineData } from "./compareHOCR.js";

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

			const pageObj = event.data[0][0];
		  
			// Detect if the new data needs to be combined with existing data.
			// This occurs when using "recognize area" mode on a page with existing OCR data. 
			if(argsObj["mode"] == "area") {
			  const lines = globalThis.hocrCurrent[n].lines;
			  if(lines && lines.length > 0) {
				combineData(pageObj, globalThis.hocrCurrent[currentPage.n]);
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
			  globalThis.ocrAll[argsObj["engine"]][n]["hocr"] = pageObj || null;
			  if (oemCurrent) {
				globalThis.hocrCurrent[n] = pageObj || null;
			  }
			} else {
			  globalThis.hocrCurrent[n] = pageObj || null;
			}
		  
			// When using the "Recognize Area" feature the XML dimensions will be smaller than the page dimensions
			if (argsObj["mode"] == "area") {
			  globalThis.pageMetricsObj["dimsAll"][n] = [currentPage.backgroundImage.height, currentPage.backgroundImage.width];
			  globalThis.hocrCurrent[n] = globalThis.hocrCurrent[n].replace(/bbox( \d+)+/, "bbox 0 0 " + currentPage.backgroundImage.width + " " + currentPage.backgroundImage.height);
			} else {
			  globalThis.pageMetricsObj["dimsAll"][n] = pageObj.dims;
			}
		  
			inputDataModes.xmlMode[n] = true;

			globalThis.pageMetricsObj["angleAll"][n] = pageObj.angle;
			globalThis.pageMetricsObj["leftAll"][n] = pageObj.left;
			globalThis.pageMetricsObj["angleAdjAll"][n] = pageObj.angleAdj;

			// Layout boxes are only overwritten if none exist yet for the page
			if (Object.keys(globalThis.layout[n].boxes).length == 0) globalThis.layout[n].boxes = event.data[0][2];
		  
			if(argsObj["saveMetrics"] ?? true){
			  globalThis.fontMetricObjsMessage[n] = event.data[0][1];
			  globalThis.convertPageWarn[n] = event.data[0][3];
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
