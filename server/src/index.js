import {promisify} from 'util'
import fs from 'fs'
import path from 'path'
import http from 'http'
import {nanoid} from 'nanoid'
import 'moment-duration-format'
import prettyError from './common/utils/prettyError'
import configAPI from 'config'
import express from 'express'
import {graphqlExpress, graphiqlExpress} from 'apollo-server-express'
import cors from 'cors'
import errorDataToEvent from './common/errors/errorDataToEvent'
import cookieParser from 'cookie-parser'
import bodyParser from 'body-parser'

const schema = require('./index.schema');

const exists = (path) =>
  new Promise(function (resolve, reject) {
      fs.exists(path, function (res) {
        resolve(res);
      });
    }
  );

const startOnlyFilename = path.resolve(process.cwd(), './config/startOnly.js');

(async function () {

  let manager, nodeName, bus;

  const context = nanoid();

  try {

    const httpConfig = configAPI.get('http');
    schema.httpConfigSchema(httpConfig, {argument: 'config.http'});

    const timeOfProcessStart = new Date().getTime();

    nodeName = configAPI.get('node');

    const consoleAndBusServicesOnly = Object.create(null);
    consoleAndBusServicesOnly.console = console;
    bus = consoleAndBusServicesOnly.bus = new (require('./common/events').Bus(consoleAndBusServicesOnly))({
      nodeName,
      color: true,
      listeners: [
        require('./common/monitoring').monitoringHook,
      ],
    });

    const eventLoader = require('./common/services/defineEvents').default(consoleAndBusServicesOnly);
    await eventLoader(path.join(process.cwd(), 'src'));

    bus.event({type: 'node.state', service: nodeName, state: 'starting'});

    if (process.env.NODE_ENV === 'development') {
      if (await require('./common/postgres/evolutions').default(consoleAndBusServicesOnly)({
        context,
        postgres: {
          ...configAPI.get('postgres'),
          ...(configAPI.has('evolutions') ? configAPI.get('evolutions') : {}),
        },
        dev: true,
      })) return;
    }

    let expressApp = express();

    expressApp.use(cors({
      origin: 'http://localhost:8080',
      credentials: true,
    }));

    expressApp.use(cookieParser());

    manager = new (require('./common/services').NodeManager(consoleAndBusServicesOnly))({ // далее consoleAndBusServicesOnly нельзя.  нужно пользоваться manager.services
      context,
      name: nodeName,
      startOnly: (await exists(startOnlyFilename)) ? require(startOnlyFilename).default : null,
      services: [

        // ! Этот сервис должен идти первым, иначе он будет ругаться
        require('./common/monitoring'),

        // Сервис для подключения к базе postgres личного кабинета
        require('./services/postgres'),

        require('./services/interactions'),

        // Авторизация
        require('./services/user'),

        require('./services/files/upload'),
        require('./services/files/upload/cleanup'),
        // require('./services/files/temp'),
        // require('./services/files/temp/cleanup'),
        // require('./services/files/generated'),
        // require('./services/files/generated/cleanup'),
      ],
    });

    await manager.started;

    const {
      getToken = missingExport('getToken'),
      putTokenToCookie = missingExport('putTokenToCookie'),
      authMiddleware = missingExport('authMiddleware')
    } = require('./services/user/middleware').default(manager.services);

    expressApp.post('/getToken', bodyParser.text({limit: '5mb'}), getToken);

    if (manager.services.monitoring) require('./services/monitoring/middleware').default(manager.services)(expressApp);

    expressApp.use('*', async (req, res, next) => {
      req.context = nanoid();
      next();
    });

    expressApp.post('/auth', authMiddleware, (req, res) => {
      res.status(200).send({status: 'ok'});
    });

    // чтобы graphiql мог работать как авторизованный пользователь, добавляем работу с авторизацией через cookie
    expressApp.use('/graphql', cookieParser(), putTokenToCookie);

    const graphqlSchema = await require('./graphqlSchema').default(manager.services)();

    let graphqlRouter = express.Router();

    graphqlRouter.post(
      '/graphql',
      authMiddleware,
      bodyParser.json({
        limit: '50mb',
        extended: true
      }),
      graphqlExpress(request => {

        // console.info(`request`, request);
        request.body.variables = request.body.variables || {};

        const startTime = Date.now();
        return {
          schema: graphqlSchema,
          context: {
            request,
            // context: request.context.reqId,
            crmId: request.crmId,
            context: request.context
          },
          formatResponse: function (res, gql) {
            if (!res.errors) {
              // логируем только если не было ошибок для избежания дублирования и логирования неверной информации
              // (если ошбки были, логирование произойдет в formatError)
              bus.method({
                type: 'graphql.method',
                service: 'graphql', // ???
                method: request.body.operationName,
                // context: request.context.reqId,
                args: request.body.variables,
                crmId: request.crmId,
                // username: request.user ? request.user.username : '',
                // email: request.user ? request.user.email : '',
                duration: Date.now() - startTime,
                data: res.data,
              });
            }
            return res;
          },
          formatError: function (error) {
            if (error && error.originalError) {
              if (Object.prototype.hasOwnProperty.call(error.originalError, 'context')) {
                error.context = error.originalError.context;
              }
            }
            bus.method({
              type: 'graphql.method',
              service: 'graphql', // ???
              method: request.body.operationName,
              // context: request.context.reqId,
              args: request.body.variables,
              crmId: request.crmId,
              // username: request.user ? request.user.username : '',
              // email: request.user ? request.user.email : '',
              failed: 1,
              // error: error,
              duration: Date.now() - startTime,
            });

            const errEvent = {
              type: 'graphql.error',
              service: 'graphql',
              method: request.body.operationName,
              // context: request.context.reqId,
            };
            errorDataToEvent(error, errEvent);
            bus.error(errEvent);

            // error.message = buildFullErrorMessage(error);
            delete error.context;

            return error;
          }
        }
      }));

    graphqlRouter.get(
      '/graphql',
      authMiddleware,
      graphiqlExpress({endpointURL: '/graphql'})
    );
    expressApp.use('/', graphqlRouter);

    require('./services/files/upload/middleware').default(manager.services)(expressApp);

    const httpServer = http.Server(expressApp);
    await new Promise(function (resolve, reject) {
      httpServer.listen(httpConfig.port,
        httpConfig.host,
        function (err, data) {
          console.log('connect');
          // console.log('env', process.env);
        if (err) reject(err);
        else resolve(data);
      })
    });

    bus.event({
      context,
      type: 'webserver.started',
      service: nodeName,
      startDuration: new Date().getTime() - timeOfProcessStart,
      config: {...httpConfig},
      urls: []
    });

  } catch (error) {
    if (bus) {
      const errEvent = {
        context,
        type: 'nodemanager.error',
        service: nodeName,
      };
      errorDataToEvent(error, errEvent);
      bus.error(errEvent);
    } else {
      console.error(prettyError(error).stack);
    }
    if (manager) await manager.dispose();
  }

})();
