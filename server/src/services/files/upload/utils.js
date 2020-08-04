import configApi from "config";
import moment from 'moment';
import { missingArgument } from '../../../common/utils/arguments';


const {path: uploadPath} = configApi.get('files.upload');

/**
 * Функция которая возвращает имя папки для создания файла
 * @param {Number} step - шаг ( в минутах )
 * @returns {string}
 */
export function folderName(step = missingArgument('step')) {
	const m = moment();
	m.minute(Math.floor(m.minute() / step) * step);
	return m.format(`YYYY/MM/DD/HHmm`);
}

/**
 * Возвращает относительный путь к файлу
 * @param path
 * @returns {*}
 */
export function getRelativePath(path = missingArgument("path")) {
  return path.replace(uploadPath, "");
}
