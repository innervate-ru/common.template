/**
 * Имя фолдера для постоянного хранения файлов.
 */

import moment from 'moment'

const folderMask = `YYYY/MM/DD/HHmm`;

export function folderName(stepInMinutes) {
  const m = moment();
  m.minute(Math.floor(m.minute() / stepInMinutes) * stepInMinutes);
  return m.format(folderMask);
}
