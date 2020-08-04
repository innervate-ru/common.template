import {promisify} from 'util'
import path from 'path'
import fs from 'fs'
import configAPI from 'config'
import oncePerServices from '../../../common/services/oncePerServices'
import nanoid from 'nanoid'
import moment from 'moment'
import {tempFolderName, currentFolderName} from './_tempFolderName'
import {ensureDir, removeFile, removeDirWithNameLessThen} from '../utils'

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

export const name = require('../../../common/services/serviceName').default(__filename);

const schema = require('./index.schema');

export default oncePerServices(function (services) {

  const {
    bus,
  } = services;

  class FilesTemp {

    constructor(settings) {
      schema.ctor_settings(this, settings);
      this._path = path.resolve(process.cwd(), settings.path);
      this._keepInMin = settings.keepInMin;
      this._newSubdirInMin = settings.newSubdirInMin;
      this._settings = settings;
   }

    async _serviceInit() {
      bus.info({
        type: 'service.settings',
        service: this._service.name,
        settings: this._settings,
      });
    }

    /**
     * Если нет директории из конфигурации, то пытаемся её создать.
     */
    async _servicePrestart() {
      await ensureDir(this._path);
    }

    /**
     * Проверяет наличие пути на запись.
     */
    async _serviceCheck() {
      const testFile = path.join(this._path, `_checkAccess.${nanoid()}`);
      await writeFile(testFile, "");
      await unlink(testFile);
    }

    async newFile(args) {
      schema.newFile_args(args);
      const {context} = args;

      const folder = path.join(this._path, currentFolderName(this._newSubdirInMin));

      await ensureDir(folder);

      const filePath = path.join(folder, nanoid());

      return {
        path: filePath,
        context,
        ct: Date.now(),
      };
    }

    async fileCompleted(args) {
      schema.fileCompleted_args(args);
      const {file: {path, ct}} = args;
      const time = Date.now() - ct;
      // TODO: Report info to log

    }

    async removeFile(args) {
      schema.removeFile_args(args);
      const {file: {path}} = args;
      await removeFile(path);
    }

    async cleanup(args) {
      schema.cleanup_args(args);
      await removeDirWithNameLessThen(this._path, tempFolderName(moment.utc().add(-this._keepInMin, 'minutes'), this._newSubdirInMin));
    }
  }

  return new (require('../../../common/services').Service(services)(FilesTemp, {contextRequired: true}))(name, {
    ...configAPI.get('files.temp'),
  });
});
