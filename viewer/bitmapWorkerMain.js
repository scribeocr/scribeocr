/**
 * Initializes a general worker and returns an object with methods controlled by the worker.
 * @returns {Promise} A promise that resolves to an object with control methods.
 */
export async function initBitmapWorker() {
  // This method of creating workers works natively in the browser, Node.js, and Webpack 5.
  // Do not change without confirming compatibility with all three.
  const obj = {};
  let worker;
  if (typeof process === 'undefined') {
    worker = new Worker(new URL('./bitmapWorker.js', import.meta.url), { type: 'module' });
  } else {
    const WorkerNode = (await import('worker_threads')).Worker;
    worker = new WorkerNode(new URL('./bitmapWorker.js', import.meta.url));
  }

  return new Promise((resolve, reject) => {
    const errorHandler = (err) => {
      console.error(err);
    };

    if (typeof process === 'undefined') {
      // @ts-ignore
      worker.onerror = errorHandler;
    } else {
      // @ts-ignore
      worker.on('error', errorHandler);
    }

    const workerPromises = {};
    let promiseId = 0;

    const ready = new Promise((innerResolve, innerReject) => {
      workerPromises['0'] = { resolve: innerResolve, reject: innerReject, func: 'ready' };
    });

    const messageHandler = async (data) => {
      if (workerPromises[data.id]) {
        if (data.status === 'reject') {
          console.log(data.data);
          workerPromises[data.id].reject(data.data);
        } else {
          workerPromises[data.id].resolve(data.data);
        }
      }
    };

    if (typeof process === 'undefined') {
      // @ts-ignore
      worker.onmessage = (event) => messageHandler(event.data);
    } else {
      // @ts-ignore
      worker.on('message', messageHandler);
    }

    /**
       * Wraps a function to be called via worker messages.
       * @param {string} func The function name to call.
       * @returns {Function} A function that returns a promise resolving to the worker's response.
       */
    function wrap(func) {
      return function (...args) {
        return new Promise((innerResolve, innerReject) => {
          const id = promiseId++;
          workerPromises[id] = { resolve: innerResolve, reject: innerReject, func };
          worker.postMessage([func, args[0], id]);
        });
      };
    }

    obj.getImageBitmap = wrap('getImageBitmap');

    obj.terminate = () => worker.terminate();

    ready.then(() => resolve(obj));
  });
}
