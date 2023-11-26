
export async function initGeneralWorker() {

	return new Promise((resolve, reject) => {
		let obj = {};

		const url = new URL('./worker/generalWorker.js', import.meta.url);
		let worker = new Worker(url, { type: 'module' });

		worker.onerror = (err) => {
			console.error(err);
		};
		worker.promises = {};
		worker.promiseId = 0;
		worker.onmessage = async function (event) {
			worker.promises[event.data.id].resolve(event.data);
		}
		resolve(obj);

		function wrap(func) {
			return function (...args) {
				return new Promise(function (resolve, reject) {
					let id = worker.promiseId++;
					worker.promises[id] = { resolve: resolve, reject: reject, func: func };
					worker.postMessage([func, args[0], id]);
				});
			}
		}

		obj.convertPageHocr = wrap("convertPageHocr");
		obj.convertPageAbbyy = wrap("convertPageAbbyy");
		obj.convertPageStext = wrap("convertPageStext");

        obj.optimizeFont = wrap("optimizeFont");

        obj.loadFontContainerAllWorker = wrap("loadFontContainerAllWorker");

        obj.evalFontPage = wrap("evalFontPage");
		obj.evalPage = wrap("evalPage");
        obj.evalWords = wrap("evalWords");
		obj.compareHOCR = wrap("compareHOCR");

		obj.reinitialize = wrap("reinitialize");
        obj.recognize = wrap("recognize");
		obj.recognizeAndConvert = wrap("recognizeAndConvert");

		obj.setGlobalSettings = wrap("setGlobalSettings");

	})
};
