// Function for converting from bufferArray to hex (string)
// Taken from https://stackoverflow.com/questions/40031688/javascript-arraybuffer-to-hex

import { win1252Chars } from '../fonts/encoding.js';
import { determineSansSerif } from './miscUtils.js';

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
 * Generates the flags value for a PDF font descriptor.
 *
 * @param {boolean} serif - Whether the font has serifs.
 * @param {boolean} italic - Whether the font is italicized.
 * @param {boolean} smallcap - Whether the font uses small caps.
 * @param {boolean} symbolic - Whether the font contains glyphs outside the Adobe standard Latin character set.
 * @returns {number} The flags value as an unsigned 32-bit integer.
 */
const generateFontFlags = (serif, italic, smallcap, symbolic) => { /* eslint-disable no-bitwise */
  let flags = 0;

  // Set bits based on the input flags:
  if (serif) flags |= (1 << 1); // Set bit 2 for serif
  if (italic) flags |= (1 << 6); // Set bit 7 for italic
  if (smallcap) flags |= (1 << 17); // Set bit 18 for smallcap
  if (symbolic) {
    flags |= (1 << 2); // Set bit 3 for symbolic
  } else {
    flags |= (1 << 5); // Set bit 6 for nonsymbolic
  }

  return flags;
};

/**
 *
 * @param {opentype.Font} font - Opentype.js font object
 * @param {number} objIndex - Index for font descriptor PDF object
 * @param {?number} embeddedObjIndex - Index for embedded font file PDF object.
 *  If not provided, the font will not be embedded in the PDF.
 * @returns {string} The font descriptor object string.
 */
function createFontDescriptor(font, objIndex, style = 'normal', embeddedObjIndex = null) {
  let objOut = `${String(objIndex)} 0 obj\n<</Type/FontDescriptor`;

  const namesTable = font.names.windows || font.names;

  objOut += `/FontName/${namesTable.postScriptName.en}`;

  const headTable = font.tables.head;
  if (headTable) {
    objOut += `/FontBBox[${[font.tables.head.xMin, font.tables.head.yMin, font.tables.head.xMax, font.tables.head.yMax].join(' ')}]`;
  } else {
    // Not all fonts have a head table, so we set the FontBBox to 0, which per the PDF specification appears to be acceptable.
    // "If all four elements of the rectangle are zero, no assumptions are made based
    // on the font bounding box. If any element is nonzero, it is essential that the
    // font bounding box be accurate. If any glyph’s marks fall outside this bounding
    // box, incorrect behavior may result."
    objOut += '/FontBBox[0, 0, 0, 0]';
  }

  const postTable = font.tables.post;

  if (postTable) {
    objOut += `/ItalicAngle ${String(postTable.italicAngle)}`;
  } else {
    // This is only correct for non-italic fonts. Unclear if this matters or not.
    objOut += '/ItalicAngle 0';
  }

  objOut += `/Ascent ${String(font.ascender)}`;

  objOut += `/Descent ${String(font.descender)}`;

  // StemV is a required field, however it is not already in the opentype font, and does not appear to matter.
  // Therefore, we set to 0.08 * em to mimic the behavior of other programs.
  // https://www.verypdf.com/document/pdf-format-reference/pg_0457.htm
  // https://stackoverflow.com/questions/35485179/stemv-value-of-the-truetype-font
  objOut += `/StemV ${String(Math.round(0.08 * font.unitsPerEm))}`;

  const serif = determineSansSerif(namesTable.postScriptName.en) !== 'SansDefault';

  // Symbolic is always set to false, even if the font contains glyphs outside the Adobe standard Latin character set.
  // This is because symbolic fonts are only used when embedded, and this does not appear to matter for embedded fonts.
  objOut += `/Flags ${String(generateFontFlags(serif, style === 'italic', style === 'small-caps', false))}`;

  if (embeddedObjIndex === null || embeddedObjIndex === undefined) {
    objOut += '>>\nendobj\n\n';
    return objOut;
  }

  objOut += `/FontFile3 ${String(embeddedObjIndex)} 0 R`;

  objOut += '>>\nendobj\n\n';

  return objOut;
}

/**
 * Converts a Opentype.js font object into a string for adding to a PDF.
 * The font is represented as a simple "Type 1" font.
 *
 * @param {opentype.Font} font - Opentype.js font object
 * @param {number} firstObjIndex - Index for the first PDF object
 * @param {boolean} [isStandardFont=false] - Whether the font is a standard font.
 *  Standard fonts are not embedded in the PDF.
 * @returns {string} The font object string.
 */
export function createEmbeddedFontType1(font, firstObjIndex, style = 'normal', isStandardFont = false) {
  // Start 1st object: Font Dictionary
  let objOut = `${String(firstObjIndex)} 0 obj\n<</Type/Font/Subtype/Type1`;

  // Add font name
  objOut += `\n/BaseFont/${font.tables.name.postScriptName.en}`;

  objOut += '/Encoding/WinAnsiEncoding';

  // const cmapIndices = Object.keys(font.tables.cmap.glyphIndexMap).map((x) => parseInt(x));

  objOut += '/Widths[';
  for (let i = 0; i < win1252Chars.length; i++) {
    const advanceNorm = Math.round(font.charToGlyph(win1252Chars[i]).advanceWidth * (1000 / font.unitsPerEm));
    objOut += `${String(advanceNorm)} `;
  }
  objOut += ']/FirstChar 32/LastChar 255';

  objOut += `/FontDescriptor ${String(firstObjIndex + 1)} 0 R>>\nendobj\n\n`;

  // Start 2nd object: Font Descriptor
  objOut += createFontDescriptor(font, firstObjIndex + 1, style, isStandardFont ? null : firstObjIndex + 2);

  // objOut += `${String(firstObjIndex + 1)} 0 obj\n<</Type/FontDescriptor`;

  // objOut += `/FontName/${font.tables.name.postScriptName.en}`;

  // objOut += `/FontBBox[${[font.tables.head.xMin, font.tables.head.yMin, font.tables.head.xMax, font.tables.head.yMax].join(' ')}]`;

  // objOut += `/ItalicAngle ${String(font.tables.post.italicAngle)}`;

  // objOut += `/Ascent ${String(font.ascender)}`;

  // objOut += `/Descent ${String(font.descender)}`;

  // // StemV is a required field, however it is not already in the opentype font, and does not appear to matter.
  // // Therefore, we set to 0.08 * em to mimic the behavior of other programs.
  // // https://www.verypdf.com/document/pdf-format-reference/pg_0457.htm
  // // https://stackoverflow.com/questions/35485179/stemv-value-of-the-truetype-font
  // objOut += `/StemV ${String(Math.round(0.08 * font.unitsPerEm))}`;

  // objOut += `/Flags ${String(font.tables.head.flags)}`;

  // if (isStandardFont) {
  //   objOut += '>>\nendobj\n\n';
  //   return objOut;
  // }

  // objOut += `/FontFile3 ${String(firstObjIndex + 2)} 0 R`;

  // objOut += '>>\nendobj\n\n';

  // Start 3rd object: Font File
  const fontBuffer = font.toArrayBuffer();
  const fontHexStr = hex(fontBuffer);

  objOut += `${String(firstObjIndex + 2)} 0 obj\n<</Length1 ${String(fontBuffer.byteLength)}/Subtype/OpenType/Length ${String(fontHexStr.length)}/Filter/ASCIIHexDecode>>\nstream\n`;

  objOut += `${fontHexStr}\nendstream\nendobj\n\n`;

  return objOut;
}

/**
 * Converts a Opentype.js font object into a string for adding to a PDF.
 * The font is represented as a composite "Type 0" font.
 *
 * @param {opentype.Font} font - Opentype.js font object
 * @param {number} firstObjIndex - Index for the first PDF object
 *
 * This function does not produce "toUnicode" or "Widths" objects,
 * so any PDF it creates directly will lack usable copy/paste.
 * However, both of these objects will be created from the embedded file
 * when the result is run through mupdf.
 */
export function createEmbeddedFontType0(font, firstObjIndex, style = 'normal') {
  // Start 1st object: Font Dictionary
  let objOut = `${String(firstObjIndex)} 0 obj\n<</Type/Font/Subtype/Type0`;

  // The relevant table is sometimes but not always in a property named `windows`.
  const namesTable = font.names.windows || font.names;

  // Add font name
  objOut += `/BaseFont/${namesTable.postScriptName.en}`;

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
  objOut += createFontDescriptor(font, firstObjIndex + 2, style, firstObjIndex + 4);

  // objOut += `${String(firstObjIndex + 2)} 0 obj\n`;

  // objOut += `<</Type/FontDescriptor/FontName/${namesTable.postScriptName.en}/FontBBox[-1002 -1048 2928 1808]/ItalicAngle 0/`;

  // objOut += `Ascent ${String(font.ascender)}/Descent -288/StemV 80/Flags 32`;

  // objOut += `/FontFile3 ${firstObjIndex + 4} 0 R>>`;

  // objOut += '\nendobj\n\n';

  // Start 4th object: widths
  objOut += `${String(firstObjIndex + 3)} 0 obj\n`;

  // There are 2 ways to represent the widths of the glyphs in a CIDFontType2.
  // (1) [first glyph index] [array of widths]
  // (2) [first glyph index] [last glyph index] [single width for all glyphs in range]
  // The smallest way to represent widths is to use both methods,
  // with the second method used for ranges of glyphs with the same width.
  // However, only the first method is used here, as mupdf rewrites the widths object.
  // The widths object needs to be present and accurate, as otherwise the glyphs will not be displayed correctly,
  // however it is not important that the widths be efficiently represented at this point.
  objOut += '[ 0 [';
  for (let i = 0; i < font.glyphs.length; i++) {
    const advanceNorm = Math.round(font.glyphs.glyphs[String(i)].advanceWidth * (1000 / font.unitsPerEm));
    objOut += `${String(advanceNorm)} `;
  }
  objOut += '] ]';

  objOut += '\nendobj\n\n';

  // Start 5th object: Font File
  const fontBuffer = font.toArrayBuffer();
  const fontHexStr = hex(fontBuffer);

  objOut += `${String(firstObjIndex + 4)} 0 obj\n<</Length1 ${String(fontBuffer.byteLength)}/Subtype/OpenType/Length ${String(fontHexStr.length)}/Filter/ASCIIHexDecode>>\nstream\n`;

  objOut += `${fontHexStr}\nendstream\nendobj\n\n`;

  // Start 6th object: Font
  objOut += `${String(firstObjIndex + 5)} 0 obj\n`;

  objOut += '<</Type/Font/Subtype/CIDFontType2/CIDSystemInfo<</Registry(Adobe)/Ordering(Identity)/Supplement 0>>';

  objOut += `/BaseFont/${namesTable.postScriptName.en}/FontDescriptor ${String(firstObjIndex + 2)} 0 R`;

  objOut += `/W ${String(firstObjIndex + 3)} 0 R`;

  objOut += '>>\nendobj\n\n';

  return objOut;
}
