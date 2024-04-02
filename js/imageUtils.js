const browserMode = typeof process === 'undefined';
/**
 * Handles various image formats, always returns a ImageBitmap.
 *
 * @param {string|ImageBitmap|Promise<string>|Promise<ImageBitmap>} img
 * @returns {Promise<ImageBitmap>}
 */
export async function getImageBitmap(img) {
  img = await img;
  if (img === undefined) throw new Error('Input is undefined');
  if (img === null) throw new Error('Input is null');

  if (typeof img === 'string') {
    if (browserMode) {
      const imgBlob = imageStrToBlob(img);
      const imgBit = await createImageBitmap(imgBlob);
      return imgBit;
    }
    const { loadImage } = await import('canvas');
    const imgBit = await loadImage(img);
    return imgBit;
  }

  // In Node.js the input is assumed to be already compatible with the `canvas.drawImage` method.
  // Additionally, `ImageBitmap` does not exist within the Node canvas package.
  // Second condition exists for type detection purposes.
  if (!browserMode && (typeof img !== 'string') && (typeof img !== 'number')) return img;

  return img;
}

/**
 * Loads an image from a given URL and sets it to a specified HTML element.
 *
 * @param {string|Blob|ArrayBuffer} src - Image source.  Accepts ArrayBuffer, Blob, or URL.
 * @param {HTMLImageElement} elem - The image element where the loaded image will be set.
 * @returns {Promise<HTMLImageElement>} A promise that resolves with the image element when the image is loaded successfully.
 */
export async function loadImageElem(src, elem) {
  return new Promise((resolve, reject) => {
    let urlLoad;
    if (src instanceof Blob) {
      urlLoad = URL.createObjectURL(src);
    } else if (src instanceof ArrayBuffer) {
      const blob = new Blob([src]);
      urlLoad = URL.createObjectURL(blob);
    } else {
      urlLoad = src;
    }
    // const urlLoad = url instanceof Blob ? URL.createObjectURL(url) : url;
    elem.onload = () => resolve(elem);
    elem.onerror = reject;
    elem.src = urlLoad;
  });
}

export function imageStrToBlob(imgStr) {
  const imgData = new Uint8Array(atob(imgStr.split(',')[1])
    .split('')
    .map((c) => c.charCodeAt(0)));

  const imgBlob = new Blob([imgData], { type: 'application/octet-stream' });

  return imgBlob;
}

/**
 * Converts a base64 encoded string to an array of bytes.
 *
 * @param {string} base64 - The base64 encoded string of the PNG image.
 * @returns {Uint8Array} The byte array representation of the image data.
 */
export function base64ToBytes(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
  * Extracts the width and height from the IHDR chunk of a PNG image encoded in base64.
  *
  * This function decodes the base64 to bytes and parses the IHDR chunk to extract the image dimensions.
  * It assumes the base64 string is a valid PNG image and directly starts parsing the binary data.
  * Note: This is a basic implementation without extensive error handling or validation.
  *
  * @param {string} base64 - The base64 encoded string of the PNG image.
  * @returns {dims} An object containing the width and height of the image.
  */
export function getPngDimensions(base64) {
  // The number 96 is chosen to line up leanly with byte boundaries (97 would result in an error)
  // but is otherwise arbitrary, while being large enough to contain the IHDR chunk.
  const bytes = base64ToBytes(base64.slice(0, 150).split(',')[1].slice(0, 96));
  // The width and height are located at specific positions in the IHDR chunk
  const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
  const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
  return { width, height };
}

/**
 * Gets the dimensions of a base64 encoded JPEG image.
 * @param {string} base64 - The base64 encoded JPEG image.
 * @returns {dims} The dimensions of the image.
 */
export function getJpegDimensions(base64) {
  const bytes = base64ToBytes(base64.split(',')[1]);
  let i = 0;

  // Skip the initial marker if it exists.
  if (bytes[i] === 0xFF && bytes[i + 1] === 0xD8) {
    i += 2;
  }

  while (i < bytes.length) {
    // Look for the 0xFF marker that might indicate the start of an SOF segment
    if (bytes[i] === 0xFF) {
      // Check for SOF0 marker (0xFFC0). Other SOF markers (e.g., SOF2: 0xFFC2) could be handled similarly
      if (bytes[i + 1] === 0xC0) {
        // The height and width are stored after the marker and segment length
        const height = (bytes[i + 5] << 8) | bytes[i + 6];
        const width = (bytes[i + 7] << 8) | bytes[i + 8];
        return { width, height };
      }
      // Skip to the next marker if not an SOF marker
      const segmentLength = (bytes[i + 2] << 8) | bytes[i + 3];
      i += segmentLength + 2;
      continue;
    }
    i++;
  }
  throw new Error('Could not find dimensions in the JPEG image.');
}
