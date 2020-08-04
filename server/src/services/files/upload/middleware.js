import path from 'path'
import configApi from 'config'
import { missingArgument } from '../../../common/validation'
import {oncePerServices, missingService, missingExport} from '../../../common/services'
import nanoid from 'nanoid'
import jwt from 'jsonwebtoken'
import multer from 'multer'
import makeDir from 'make-dir'
import bodyParser from 'body-parser'
import {addCounter} from '../../../common/monitoring'
import {folderName} from '../utils'

const secret = configApi.get('secret.value');

export default oncePerServices(function(services) {
  const {
    bus = missingService('bus'),
    'files/upload': filesUpload = missingService('files/upload')
  } = services;

  const uploadCounter = addCounter({
    serviceName: filesUpload._service.name,
    name: "upload_kbytes",
    type: "times"
  });

  const {
    authMiddleware = missingExport('authMiddleware'),
  } = require('../../user/middleware').default(services);

  return function (expressApp) {

    let {path: uploadPath, newSubdirInMin} = configApi.get("files.upload");

    uploadPath = path.resolve(process.cwd(), uploadPath);

    const destinationPath = path.join(uploadPath, folderName(newSubdirInMin));

    const storage = multer.diskStorage({
      destination: (req, file, callback) => { makeDir(destinationPath).then(() => { callback(null, destinationPath); }); },
      filename: (req, file, callback) => { callback(null, `${nanoid()}${path.extname(file.originalname)}`); }
    });

    const upload = multer({storage});

    expressApp.post("/upload", authMiddleware, bodyParser.urlencoded({
      limit: "100mb",
      extended: true
    }), upload.any(), uploadMiddleware);

    async function uploadMiddleware(req = missingArgument('req'), res = missingArgument('res')) {
      if (!req.files) throw new Error("No files provided");
      const context = nanoid(),
        {username = null, email = null} = req.user,
        result = {};

      const actionMsg = {
        service: "files.upload",
        type: 'files.upload.middleware',
        action: "fileUpload",
        ...req.context
      };

      let {options = null} = req.query;
      if (typeof options === "string") options = JSON.parse(req.query.options);
      let token = null;
      for (const file of req.files) {
        const {
          originalname: filename,
          filename: pathFilename,
          mimetype: mimeType,
          path: fullPath,
          fieldname,
          size
        } = file;
        const [fileId] = pathFilename.split('.');
        uploadCounter(size / 1024);
        const createdFile = await filesUpload.uploadFile({
          context,
          username,
          email,
          filename,
          size,
          mimeType,
          fullPath,
          fileId,
          options
        });

        actionMsg.mimeType = mimeType;
        actionMsg.size = size;
        actionMsg.result = "OK";

        try {
          if (createdFile) {
            const completedFile = await filesUpload.fileCompleted({context, file: createdFile});
            token = jwt.sign(completedFile, secret);
            result[fieldname] = token;
          }
        } catch (error) {
          if (error && !error.context) error.context = context;
          actionMsg.result = "failed";
          actionMsg.error = error.message;
          await filesUpload.deleteFile({context, file: createdFile});
          res.send({error: error.message});
        } finally {
          bus.action(actionMsg);
        }
      }
      res.send(result);
    }
  }
});
