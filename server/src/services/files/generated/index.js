import {promisify} from 'util'
import path from 'path'
import fs from 'fs'
import configAPI from 'config'
import oncePerServices from '../../../common/services/oncePerServices'
import missingService from '../../../common/services/missingService'
import nanoid from 'nanoid'
import {ensureDir, getFileSize, removeFile} from '../utils'
import {folderName} from './_folderName'
import mimeTypes from 'mime-types'

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

export const name = require('../../../common/services/serviceName').default(__filename);

const schema = require('./index.schema');

export default oncePerServices(function (services) {

  const {
    bus,
    postgres = missingService('postgres'),
  } = services;

  class FilesGenerated {

    constructor(settings) {
      schema.ctor_settings(this, settings);
      this._path = path.resolve(process.cwd(), settings.path);
      this._cleanupInMin = settings.cleanupInMin;
      this._maxTimeToCompleteInMin = settings.maxTimeToCompleteInMin;
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
      let {context, filename, mimeType, username, email, client} = args;

      if (!mimeType) {
        mimeType = mimeTypes.lookup(filename);
        if (mimeType === false) {
          throw new Error(`Cannot determine mime-type for '${filename}'.  Explicit parameter mimeType is required`);
        }
      }

      const fileid = nanoid();

      const relativePath = folderName(this._newSubdirInMin);

      const filePath = path.join(relativePath, `${fileid}${path.extname(filename)}`);

      const absolutePath = path.join(this._path, filePath);

      // console.info(`absolutePath`, absolutePath, this._path, filePath);

      await ensureDir(path.join(this._path, relativePath));

      await postgres.exec({
        context,
        statement: `insert into file_generated (id, path, filename, mime_type, username, email, client) values ($1, $2, $3, $4, $5, $6, $7);`,
        params: [fileid, filePath, filename, mimeType, username, email, client]
      });

      const ev = {
        context,
        type: 'file.new',
        service: this._service.name,
        fileid,
        filename,
        mimeType,
      };
      if (username) ev.username = username;
      if (email) ev.email = email;
      if (client) ev.client = client;
      bus.event(ev);

      return {
        fileid,
        path: absolutePath,
        filename,
        ct: Date.now(),
      };
    }

    /**
     * В параметр file предеается объект полученный из newFile(...).  Результат - объект описывающий файл для длительного
     * хранения, который может быть использован в removeFile и после токенезации использовать для HTTP GET /api/download.
     */

    async fileCompleted(args) {
      schema.fileCompleted_args(args);
      const {context, file: {fileid, path, ct, options}} = args;

      const size = options && options.filePaths ? await getFileSize(options.filePaths) : await getFileSize(path);

      const duration = Date.now() - ct;

      const r = await postgres.exec({
        context,
        statement: `update file_generated set completed = now(), completed_context = $2, size = $3, generated_in = $4, options = $5 where id = $1 returning path, filename, mime_type, username, email, client;`,
        params: [fileid, context, size, duration, options],
      });

      if (r.rowCount === 0) {
        throw new Error(`File with id ${fileid} is missing in DB`);
      }

      const row = r.rows[0];

      const ev = {
        context,
        type: 'file.completed',
        service: this._service.name,
        fileid,
        filename: row.filename,
        mimeType: row.mime_type,
        size,
        duration,
        options,
      };
      if (row.username) ev.username = row.username;
      if (row.client) ev.client = row.client;
      bus.event(ev);

      const res = {
        src: 'LK', // система из которой можно забрать файл по fileid. LK - Хранилище личного кабинета
        fileid,
        path: row.path,
        folder: this._path,
        filename: row.filename,
      };

      // console.info(`res`, res);

      if (row.username) res.username = row.username;
      if (row.client) res.client = row.client;
      return res;
    }

    async removeFile(args) {
      schema.removeFile_args(args);
      const {context, file: { fileid }} = args;

      const {path: filePath, options} = await this.getFileInfo({ context, fileid });

      if (options && options.filePaths) {
        await removeFile(options.filePaths);
      } else {
        await removeFile(filePath);
      }

      const r = await postgres.exec({
        context,
        statement: `update file_generated set removed = now(), removed_context = $2 where id = $1 returning filename, mime_type, username, client, options;`,
        params: [fileid, context],
      });

      const row = r.rows[0];

      const ev = {
        context,
        type: 'file.removed',
        service: this._service.name,
        fileid,
        filename: row.filename,
        mimeType: row.mime_type,
        options,
      };
      if (row.username) ev.username = row.username;
      if (row.client) ev.client = row.client;
      bus.event(ev);
    }

    async getFileInfo(args) {
      schema.getFilePath_args(args);
      const {context, fileid} = args;

      const r = await postgres.exec({
        context,
        statement: `select filename, path, size, mime_type, generated_in, options from file_generated where id = $1;`,
        params: [fileid],
      });

      if (r.rowCount === 0) {
        throw new Error(`File with id ${fileid} is missing`);
      }

      const row = r.rows[0];
      return {
        fileid,
        filename: row.filename,
        path: path.join(this._path, row.path),
        size: row.size,
        mimeType: row.mime_type,
        generatedIn: row.generated_in,
        options: row.options,
      };
    }

    async cleanup(args) {
      schema.cleanup_args(args);
      const {context} = args;

      const r = await postgres.exec({
        context,
        statement: `select id, path, options from file_generated where completed is null and created < now() - (${this._maxTimeToCompleteInMin} * interval '1 min');`,
      });

      for (const {id: fileid, path, options} of r.rows) {
        if (options && options.filePaths) {
          await removeFile(options.filePaths);
        } else {
          await removeFile(path);
        }

        await postgres.exec({
          context,
          statement: `delete from file_generated where id = $1;`,
          params: [fileid],
        });
      }

      const ev = {
        context,
        type: 'file.cleanup',
        service: this._service.name,
        count: r.rowCount,
      };
      bus.event(ev);
    }

  }

  return new (require('../../../common/services').Service(services)(FilesGenerated, {contextRequired: true}))(name, {
    ...configAPI.get('files.generated'),
    dependsOn: [postgres],
  });
});
