import fs from 'node:fs';
import path from 'node:path';

/** @param {string} directory @returns {Map<string, Buffer>} */
export function readReleaseFiles(directory) {
  const files = new Map();
  function visit(relative) {
    for (const entry of fs.readdirSync(path.join(directory, relative), { withFileTypes: true })) {
      const name = path.posix.join(relative, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Symlink is not a release file: ${name}`);
      if (entry.isDirectory()) visit(name);
      else if (entry.isFile()) files.set(name, fs.readFileSync(path.join(directory, name)));
    }
  }
  visit('');
  return files;
}
