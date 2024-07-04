// Code for handling both files and directories uploaded through drag-and-drop interface
// Taken from: https://stackoverflow.com/questions/3590058/does-html5-allow-drag-drop-upload-of-folders-or-a-folder-tree/53058574#53058574

// Drop handler function to get all files

/**
 *
 * @param {DataTransferItemList} dataTransferItemList
 * @returns {Promise<Array<FileSystemFileEntry|File>>}
 */
export async function getAllFileEntries(dataTransferItemList) {
  /** @type {Array<FileSystemFileEntry>} */
  const fileEntries = [];
  // Use BFS to traverse entire directory/file structure
  const queue = [];
  // Unfortunately dataTransferItemList is not iterable i.e. no forEach
  for (let i = 0; i < dataTransferItemList.length; i++) {
    // The list may include non-files, which should be skipped.
    // For example, if dragging an image from a web page in another window,
    // the image is included as a file, but strings are also included.
    if (dataTransferItemList[i].kind !== 'file') continue;
    // Note webkitGetAsEntry a non-standard feature and may change
    // Usage is necessary for handling directories
    /**@type {FileSystemEntry|File} */
    let entry = dataTransferItemList[i].webkitGetAsEntry();
    // Sometimes, webkitGetAsEntry returns null but getAsFile returns a file properly.
    // The reason for this is unknown--it is observed when dragging an image from a web page rather than a file.
    // This is currently unsolved--hopefully it's obvious to users that this interface is meant for dragging files.
    if (!entry) {
      entry = dataTransferItemList[i].getAsFile();
      if (!entry) {
        console.log('Entry skipped as both webkitGetAsEntry and getAsFile returned null');
        continue;
      }
    }
    queue.push(entry);
  }
  let entry = queue.shift();
  while (entry) {
    if (entry instanceof File || entry.isFile) {
      // The types for the FileSystemEntry interface are incorrect, so this requires some coersion.
      fileEntries.push(/** @type {FileSystemFileEntry} */(entry));
    } else if (entry.isDirectory) {
      queue.push(...await readAllDirectoryEntries(/** @type {FileSystemDirectoryEntry} */(entry).createReader()));
    }
    entry = queue.shift();
  }
  return fileEntries;
}

// Get all the entries (files or sub-directories) in a directory
// by calling readEntries until it returns empty array
async function readAllDirectoryEntries(directoryReader) {
  const entries = [];
  let readEntries = await readEntriesPromise(directoryReader);
  while (readEntries.length > 0) {
    entries.push(...readEntries);
    readEntries = await readEntriesPromise(directoryReader);
  }
  return entries;
}

// Wrap readEntries in a promise to make working with readEntries easier
// readEntries will return only some of the entries in a directory
// e.g. Chrome returns at most 100 entries at a time
async function readEntriesPromise(directoryReader) {
  try {
    return await new Promise((resolve, reject) => {
      directoryReader.readEntries(resolve, reject);
    });
  } catch (err) {
    console.log(err);
  }
}
