import fs from 'fs';
import path from 'path';

/**
 * Class representing a simplified version of the File interface for Node.js.
 */
class FileNode {
  /**
     * Creates an instance of the File class.
     * @param {string} filePath - The path to the file.
     */
  constructor(filePath) {
    this.filePath = filePath;
    this.name = path.basename(filePath);
    this.fileData = fs.readFileSync(filePath);
  }

  /**
     * Returns an ArrayBuffer with the file's contents.
     * @returns {Promise<ArrayBuffer>} A promise that resolves with the file's contents as an ArrayBuffer.
     */
  async arrayBuffer() {
    return this.fileData.buffer.slice(this.fileData.byteOffset, this.fileData.byteOffset + this.fileData.byteLength);
  }
}

export const wrapFilesNode = (files) => files.map((file) => (new FileNode(file)));
