
import { checkMultiFontMode } from "./fontStatistics.js";
import { fontFiles, relToAbsPath, loadFontFamily, loadFont, loadFontBrowser } from "./fontUtils.js";

export async function initOptimizeFontWorker() {

	return new Promise((resolve, reject) => {
		let obj = {};

		const url = new URL('./worker/optimizeFontWorker.js', import.meta.url);
		let worker = globalThis.document ? new Worker(url) : new Worker(url, { type: 'module' });
		
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

		obj.createSmallCapsFont = wrap("createSmallCapsFont");
		obj.optimizeFont = wrap("optimizeFont");
	})
};

// TODO: Rework storage of optimized vs. non-optimized fonts to be more organized
// var fontDataOptimized, fontDataOptimizedItalic, fontDataOptimizedSmallCaps;

var fontDataOptimized = {};

export async function optimizeFont2(fontFamily) {

	const fontMetricI = globalSettings.multiFontMode ? globalThis.fontMetricsObj[fontFamily] : globalThis.fontMetricsObj["Default"];
	if (!fontMetricI) return;

	if (!fontDataOptimized[fontFamily]) fontDataOptimized[fontFamily] = {};

	// fontFamily is assumed to be either "SerifDefault" or "SansDefault"
	// fontFamilySrc indicates which font to use as a starting point for optimization.
	let fontFamilySrc = fontFamily;
	if (fontFamily == "SerifDefault") {
		fontFamilySrc = globalThis.globalSettings.defaultFontSerif;
	} else if (fontFamily == "SansDefault") {
		fontFamilySrc = globalThis.globalSettings.defaultFontSans;
	}

	await Promise.allSettled(["normal", "italic", "small-caps"].map(async (style) => {
		// Optimize font if there are metrics to do so
		if (fontMetricI[style]) {

			let fontSrc;
			if (style == "small-caps") {
				// fontSrc = globalThis.fontObjRaw[fontFamily]["small-caps"];
				fontSrc = relToAbsPath("../fonts/" + fontFiles[fontFamilySrc + "-small-caps"]);
			} else if (style == "italic") {
				fontSrc = relToAbsPath("../fonts/" + fontFiles[fontFamilySrc + "-italic"]);
			} else {
				fontSrc = relToAbsPath("../fonts/" + fontFiles[fontFamilySrc]);
			}

			const fontOptObj = await globalThis.optimizeFontScheduler.addJob("optimizeFont", { fontData: fontSrc, fontMetrics: fontMetricI[style], style: style });

			fontDataOptimized[fontFamily][style] = fontOptObj.fontData;

			globalThis.fontObj[fontFamily][style] = loadFont(fontFamily, fontDataOptimized[fontFamily][style], true).then((x) => {
				// Re-apply kerningPairs object so when toArrayBuffer is called on this font later (when making a pdf) kerning data will be included
				x.kerningPairs = fontOptObj.kerningPairs;
				return (x);
			}, (x) => console.log(x));

			if (globalThis.document) return loadFontBrowser(fontFamily, style, fontDataOptimized[fontFamily][style], true);
			return globalThis.fontObj[fontFamily][style];
		}

	}));

}

export async function optimizeFont3(value) {
	// When we have metrics for individual fonts families, those are used to optimize the appropriate fonts.
	// Otherwise, the "default" metric is applied to whatever font the user has selected as the default font. 
	const metricsFontFamilies = Object.keys(globalThis.fontMetricsObj);

	globalSettings.multiFontMode = checkMultiFontMode(globalThis.fontMetricsObj);

	const optFontFamilies = globalSettings.multiFontMode ? metricsFontFamilies.filter((x) => !["Default", "message"].includes(x)) : [globalSettings.defaultFont];

	if (value) {
		await Promise.allSettled(optFontFamilies.map(async (family) => { return optimizeFont2(family) }));
	} else {
		await Promise.allSettled(optFontFamilies.map(async (family) => { return loadFontFamily(family) }));
	}
}
