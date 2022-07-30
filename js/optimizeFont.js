export async function initOptimizeFontWorker() {

	return new Promise((resolve, reject) => {
		let obj = {};
		let worker = new Worker('/js/optimizeFontWorker.js');

        worker.promises = {};
        worker.promiseId = 0;
        worker.onmessage = async function (event) {
            worker.promises[event.data.id].resolve(event.data);
        }
        resolve(obj);

		function wrap(func) {
			return function(...args) {
				return new Promise(function (resolve, reject) {
                    let id = worker.promiseId++;
					worker.promises[id] = { resolve: resolve, reject: reject, func: func};
					worker.postMessage([func, args[0], id]);
				});
			}
		}

		obj.createSmallCapsFont = wrap("createSmallCapsFont");
		obj.optimizeFont = wrap("optimizeFont");
	})
};
