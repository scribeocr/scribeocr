const parentPort = typeof process === 'undefined' ? globalThis : (await import('worker_threads')).parentPort;
if (!parentPort) throw new Error('This file must be run in a worker');

function imageStrToBlob(imgStr) {
  const imgData = new Uint8Array(atob(imgStr.split(',')[1])
    .split('')
    .map((c) => c.charCodeAt(0)));

  const imgBlob = new Blob([imgData], { type: 'application/octet-stream' });

  return imgBlob;
}

/**
 * Handles various image formats, always returns a ImageBitmap.
 *
 * @param {string|ImageBitmap|Promise<string>|Promise<ImageBitmap>} img
 * @returns {Promise<ImageBitmap>}
 */
export async function getImageBitmap(img) {
  const imgBlob = imageStrToBlob(img[0]);
  const imgBit = await createImageBitmap(imgBlob);
  return imgBit;
}

const handleMessage = async (data) => {
  const func = data[0];
  const args = data[1];
  const id = data[2];

  ({
    // Convert page functions
    getImageBitmap,
  })[func](args)
    .then((x) => parentPort.postMessage({ data: x, id, status: 'resolve' }, [x]))
    .catch((err) => parentPort.postMessage({ data: err, id, status: 'reject' }));
};

if (typeof process === 'undefined') {
  onmessage = (event) => handleMessage(event.data);
} else {
  parentPort.on('message', handleMessage);
}

parentPort.postMessage({ data: 'ready', id: 0, status: 'resolve' });
