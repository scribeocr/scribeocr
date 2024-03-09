// Function for converting from bufferArray to hex (string)
// Taken from https://stackoverflow.com/questions/40031688/javascript-arraybuffer-to-hex

/** @type {Array<string>} */
const byteToHex = [];

for (let n = 0; n <= 0xff; ++n) {
  const hexOctet = n.toString(16).padStart(2, '0');
  byteToHex.push(hexOctet);
}

/**
 * Converts an ArrayBuffer to a hexadecimal string.
 *
 * @param {ArrayBuffer} arrayBuffer - The ArrayBuffer to be converted.
 * @returns {string} The hexadecimal representation of the ArrayBuffer.
 */
export function hex(arrayBuffer) {
  const buff = new Uint8Array(arrayBuffer);
  /** @type {Array<string>} */
  const hexOctets = []; // new Array(buff.length) is even faster (preallocates necessary array size), then use hexOctets[i] instead of .push()

  for (let i = 0; i < buff.length; ++i) hexOctets.push(byteToHex[buff[i]]);

  return hexOctets.join('');
}

/**
 * Converts a Opentype.js font object into a string for adding to a PDF.
 *
 * @param {opentype.Font} font - Opentype.js font object
 * @param {number} firstObjIndex - Index for the first PDF object
 *
 * This function does not produce "toUnicode" or "Widths" objects,
 * so any PDF it creates directly will lack usable copy/paste.
 * However, both of these objects will be created from the embedded file
 * when the result is run through mupdf.
 */
export function createFontObjType0(font, firstObjIndex) {
  // Start 1st object: Font Dictionary
  let objOut = `${String(firstObjIndex)} 0 obj\n<</Type/Font/Subtype/Type0`;

  // Add font name
  objOut += `\n/BaseFont/${font.tables.name.postScriptName.en}`;

  objOut += '/Encoding/Identity-H';

  // objOut += `/ToUnicode ${String(firstObjIndex + 1)} 0 R`;

  objOut += `/DescendantFonts[${String(firstObjIndex + 5)} 0 R]`;

  objOut += '>>endobj\n\n';

  // Start 2nd object: ToUnicode CMap
  // objOut += `${String(firstObjIndex + 1)} 0 obj\n`;

  // Add 2 to length to account for \n characters
  // objOut += `<</Length ${toUnicodeStr.length + 2}>>\nstream\n`;

  // objOut += toUnicodeStr;

  // objOut += '\nendstream\nendobj\n\n';

  // Start 3rd object: FontDescriptor
  objOut += `${String(firstObjIndex + 2)} 0 obj\n`;

  objOut += `<</Type/FontDescriptor/FontName/${font.tables.name.postScriptName.en}/FontBBox[-1002 -1048 2928 1808]/ItalicAngle 0/Ascent 1160/Descent -288/StemV 80/Flags 32`;

  objOut += `/FontFile3 ${firstObjIndex + 4} 0 R>>`;

  objOut += '\nendobj\n\n';

  // Start 4th object: widths
  // objOut += `${String(firstObjIndex + 3)} 0 obj\n`;

  // objOut += widthsStr;

  // objOut += '\nendobj\n\n';

  // Start 5th object: Font File
  const fontBuffer = font.toArrayBuffer();
  const fontHexStr = hex(fontBuffer);

  objOut += `${String(firstObjIndex + 4)} 0 obj\n<</Length1 ${String(fontBuffer.byteLength)}/Subtype/OpenType/Length ${String(fontHexStr.length)}/Filter/ASCIIHexDecode>>\nstream\n`;

  objOut += `${fontHexStr}\nendstream\nendobj\n\n`;

  // Start 6th object: Font
  objOut += `${String(firstObjIndex + 5)} 0 obj\n`;

  objOut += '<</Type/Font/Subtype/CIDFontType2/CIDSystemInfo<</Registry(Adobe)/Ordering(Identity)/Supplement 0>>';

  objOut += `/BaseFont/${font.tables.name.postScriptName.en}/FontDescriptor ${String(firstObjIndex + 2)} 0 R`;

  // objOut += `/W ${String(firstObjIndex + 3)} 0 R`;

  objOut += '>>\nendobj\n\n';

  return objOut;
}
