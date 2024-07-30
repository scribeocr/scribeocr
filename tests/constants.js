export const port = 3031;
export const portKarma = 9876;
export const BASE_URL_KARMA = `http://localhost:${portKarma}/base`;

let basepath = BASE_URL_KARMA;
if (typeof process !== 'undefined') {
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  basepath = `${__dirname}/..`;
}

export const BASE_PATH_KARMA = basepath;
export const ASSETS_PATH_KARMA = `${BASE_PATH_KARMA}/tests/assets`;
