import {promisify} from 'util'
import path from 'path';
import fs from 'fs'
import configApi from 'config';
import mimeTypes from 'mime-types';
import nanoid from 'nanoid'

import {missingService, oncePerServices, serviceName} from '../../../common/services';
import {removeFile, folderName, ensureDir} from '../utils';

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

export const name = serviceName(__filename);

const schema = require('./index.schema');

export default oncePerServices(function(services) {

  const { bus = missingService('bus'), postgres = missingService('postgres') } = services;

  class FilesUploaded {
    constructor(settings) {
      schema.ctor_settings(this, settings);
      this._path = path.resolve(process.cwd(), settings.path);
      this._newSubdirInMin = settings.newSubdirInMin;
      this._cleanupInMin = settings.cleanupInMin;
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

    /**
     * Первая фаза загрузки файла
     * @param {Object} args - объект аргументов
     * @property {String} context - контекст
     * @property {String} filename - имя файла
     * @property {String} username - имя пользователя
     * @property {String} email - эл.почта
     * @property {String} mimeType - тип данных
     * @property {String} size - размер файла
     *
     * @returns {Promise<{path: *, timeTaken: number, filename: *, fileId: *}>}
     */
    async uploadFile(args) {
      schema.uploadFile_args(args);
      let { mimeType } = args;
      const { context, filename, username, email, size, fileId, fullPath, ...options } = args;

      try {
        if (!mimeType) {
          mimeType = mimeTypes.lookup(filename);
          if (mimeType === false)
            throw new Error(
              `Cannot determine mime-type for '${filename}'.  Explicit parameter mimeType is required`
            );
        }
        const filePath = path.relative(this._path, fullPath);
        await postgres.exec({
          statement: `insert into file_upload (id, path, filename, mime_type, username, email, options) values ($1, $2, $3, $4, $5, $6, $7);`,
          params: [ fileId, filePath, filename, mimeType, username, email, options ],
          context
        });

        const busEvent = {
          type: 'file.uploaded',
          service: this._service.name,
          username: username || null,
          email: email || null,
          fileId,
          filename,
          mimeType,
          context
        };
        bus.event(busEvent);

        return {
          path: fullPath,
          timeTaken: Date.now(),
          fileId,
          filename,
          size
        };
      } catch (error) {
        if (error && !error.context) error.context = context;
        console.error(error);
        throw error;
      }
    }

    /**
     * Вторая фаза, после которой файл считается загруженным
     * @param {Object} args - Объект с аргументами
     * @property {String} context - контескст
     * @property {Object} file - объект файла с первой фазы
     *
     * @returns {Promise<{path: *, filename: *, folder: *, src: string, email: (*|null), username: (*|null)}>}
     */
    async fileCompleted(args) {
      schema.fileCompleted_args(args);
      const { context, file: { fileId, timeTaken, size } } = args;
      try {
        const duration = Date.now() - timeTaken;
        const { rows: [ updatedFile ] } = await postgres.exec({
          statement: `
          update file_upload set completed = now(), completed_context = $2, size = $3, uploaded_in = $4
          where id = $1
          returning *;
        `,
          params: [ fileId, context, size, duration ],
          context
        });

        if (!updatedFile) throw new Error(`File with id ${fileId} is missing in DB`);

        const username = updatedFile && updatedFile.username,
          email = updatedFile && updatedFile.email;

        const busEvent = {
          type: 'file.uploadCompleted',
          service: this._service.name,
          filename: updatedFile && updatedFile.filename,
          mimeType: updatedFile && updatedFile.mime_type,
          username,
          email,
          fileId,
          size,
          duration
        };
        bus.event(busEvent);
        return {
          src: 'LK_upload',
          path: updatedFile && updatedFile.path,
          filename: updatedFile && updatedFile.filename,
          folder: this._path,
          fileId,
          username,
          email
        };
      } catch (error) {
        if (error && !error.context) error.context = context;
        this._service._reportError(error);
        throw error;
      }
    }

    /**
     * Функция для удаления файла
     * @param {Object} args - объект с аргументами
     * @property {Object} file - объект файла
     * @property {String} context - контекст
     *
     * @returns {Promise<void>}
     */
    async deleteFile(args) {
      schema.deleteFile_args(args);
      const { context, file: { fileId } } = args;
      try {
        const { path: filePath } = await this.getFile({ context, fileId });

        await removeFile(filePath);

        const { rows: [ deletedFile ] } = await postgres.exec({
          statement: `
          update file_upload set removed = now(), removed_context = $2
          where id = $1
          returning *
        `,
          params: [ fileId, context ],
          context
        });

        const busEvent = {
          type: 'file.deleted',
          service: this._service.name,
          filename: deletedFile && deletedFile.filename,
          mimeType: deletedFile && deletedFile.mimeType,
          username: deletedFile && deletedFile.username,
          email: deletedFile && deletedFile.email,
          fileId,
          context
        };
        bus.event(busEvent);
      } catch (error) {
        if (error && !error.context) error.context = context;
        this._service._reportError(error);
        throw error;
      }
    }

    /**
     * Функция для получения информации о файле
     * @param {Object} args - Объект с аргументами
     * @property {String} context - контекст
     * @property {String} fileId - айди файла в постгресе
     *
     * @returns {Promise<{path: *, filename: *, size: *, mimeType: *, fileId: *}>}
     */
    async getFile(args) {
      schema.getFile_args(args);
      const { context, fileId } = args;
      console.log('GEt file fileID', fileId);
      try {
        const { rows: [ pgFile ] } = await postgres.exec({
          statement: `
          select filename, path, size, mime_type from file_upload
          where id = $1
          limit 1;
        `,
          params: [ fileId ],
          context
        });
        if (!pgFile) throw new Error(`File with id ${fileId} is missing`);
        return {
          filename: pgFile && pgFile.filename,
          path: path.join(this._path, pgFile && pgFile.path),
          size: pgFile && pgFile.size,
          mimeType: pgFile && pgFile.mimeType,
          fileId
        };
      } catch (error) {
        if (error && !error.context) error.context = context;
        this._service._reportError(error);
        throw error;
      }
    }

    async cleanup(args) {
      schema.cleanup_args(args);
      const {context} = args;

      const {rows: files, rowCount: filesCount} = await postgres.exec({
        context,
        statement: `
          select id, path from file_upload where completed is null and created < now() - ($1::integer * interval '1 min');
        `,
        params: [10]
      });

      for (const {id: fileId, path} of files) {
        await removeFile(path);
        await postgres.exec({
          context,
          statement: `
            delete from file_upload where id = $1;
          `,
          params: [fileId]
        });
      }

      const busEvent = {
        context,
        type: "file.uploadCleanup",
        service: this._service.name,
        count: filesCount
      };
      bus.event(busEvent);
    };
  }

  return new (require('../../../common/services').Service(services)(FilesUploaded, { contextRequired: true }))(name, {
    ...configApi.get('files.upload'),
    dependsOn: [ postgres ]
  });
});
