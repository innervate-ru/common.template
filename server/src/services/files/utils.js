import {promisify} from 'util'
import fs from 'fs'
import path from 'path'
import makeDir from 'make-dir'
import moment from 'moment'

const readdir = promisify(fs.readdir);
const lstat = promisify(fs.lstat);
const unlink = promisify(fs.unlink);
const exists = promisify(fs.exists);
const rmdir = promisify(require('rmdir'));

export const ensureDir = makeDir;
export const removeDir = rmdir;

export async function removeFile(filePath) {
  const paths = Array.isArray(filePath) ? filePath : [filePath];

  try {
    for (let _path of paths) {
      await unlink(path.resolve(process.cwd(), _path));
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err; // если файл уже удален - не проблема
  }
}

export async function removeDirWithNameLessThen(dirPath, subdirName) {
  if (await exists(dirPath)) {
    const dirList = await readdir(dirPath);
    await Promise.all(dirList.filter((v) => v < subdirName).map(v => rmdir(path.join(dirPath, v))));
  }
}

export async function getFileSize(filePath) {
  const paths = Array.isArray(filePath) ? filePath : [filePath];
  let size = 0;

  for (let path of paths) {
    const r = await lstat(path);

    size += r.size;
  }

  return size;
}


const folderMask = `YYYY/MM/DD/HHmm`;

/**
 * Имя фолдера для постоянного хранения файлов.
 */
export function folderName(stepInMinutes) {
  const m = moment();
  m.minute(Math.floor(m.minute() / stepInMinutes) * stepInMinutes);
  return m.format(folderMask);
}
