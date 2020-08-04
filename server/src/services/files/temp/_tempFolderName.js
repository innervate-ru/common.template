/**
 * Имя фолдера для временного хранения файлов определяется временем когда создается файлы.  При этом
 * имена директорий меняются раз в несколько минут, что позволяет, оперативно удалять не удаленные временные
 * файлы - просто удаляя директории с именем меньше имени директории в которой файлы достигшие максимального времени
 * хранения.
 */

import moment from 'moment'

export function currentFolderName(stepInMinutes) {
  return tempFolderName(moment().utc(), stepInMinutes);
}

export function tempFolderName(moment, stepInMinutes) {
  moment.minute(Math.floor(moment.minute() / stepInMinutes) * stepInMinutes);
  return moment.format('YYYYMMDDHHmm');
}
