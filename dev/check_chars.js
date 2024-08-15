/* eslint-disable max-len */

// Note: This script currently does not work as intended, because the desired_characters files are not correct and/or up-to-date.
// We should still check that all characters in the languages we claim to support are in the fonts,
// however doing this correctly will likely require extracting character lists from the .traineddata files.

const langsLatin = ['cat', 'nld', 'eng', 'fra', 'deu', 'ita', 'pol', 'por', 'spa', 'swe'];
const langsCyrillic = ['rus', 'ukr'];

export const getChars = async (lang) => {
  const url = `https://raw.githubusercontent.com/tesseract-ocr/langdata/main/${lang}/desired_characters`;
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`Failed to fetch ${url} (${response.status})`);
    return [];
  }
  const text = await response.text();
  return text.split('\n');
};

const charsLatin0Arr = await Promise.all(langsLatin.map((lang) => getChars(lang)));
const charsLatinSet = new Set(charsLatin0Arr.flat());
const charsLatinArr = Array.from(charsLatinSet);

const charsCyrillic0Arr = await Promise.all(langsCyrillic.map((lang) => getChars(lang)));
const charsCyrillicSet = new Set(charsCyrillic0Arr.flat());
const charsCyrillicArr = Array.from(charsCyrillicSet);

// TODO: This should import the current lists directly rather than hardcoding them here.
const charSetLatinBaseArr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ﬁﬀﬂﬃſé.,;:!?()[]{}-–—_\'\\"/\\@*#&$¢£¥¶§©‹›«»®™°•€%^+<=>`~|‘’“”… '.split('');
const charSetLatinExtArr = 'ÀÁÂÄÆÃÅĀĂĄÇĆĈČĎĐÈÉÊËĒĖĘĚĜĞĠĢĤĦÌÍÎÏĪĮİĴĶĹĻĽŁŃŅŇÑÒÓÔÖŒÕØŌŐŔŖŘŚŜŞŠȘŤŢȚÙÚÛÜŪŮŰŲŴÝŶŸŹŻŽàáâäæãåāăąçćĉčďđèéêëēėęěĝğġģĥħìíîïīįıĵķĸĺļľłńņňñòóôöœõøōőŕŗřśŝşšșßťţțùúûüūůűųŵýÿŷźżž¿¡‚„'.split('');
const charSetLatinArr = [...charSetLatinBaseArr, ...charSetLatinExtArr];

const charSetCyrillicOnlyArr = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюяіІ№ЄЇҐєїґ'.split('');
const charSetCyrillicArr = [...charSetCyrillicOnlyArr, ...charSetLatinArr];

console.log('Missing latin characters:', charsLatinArr.filter((char) => !charSetLatinArr.includes(char)));
console.log('Missing cyrillic characters:', charsCyrillicArr.filter((char) => !charSetCyrillicArr.includes(char)));
