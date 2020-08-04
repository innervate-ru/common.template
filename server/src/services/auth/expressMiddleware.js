import configAPI from 'config'
import jwt, {JsonWebTokenError, TokenExpiredError} from 'jsonwebtoken'
import {oncePerServices, missingService, missingExport} from '../../common/services'
import requestIp from 'request-ip'
import shortid from 'shortid'

const secret = configAPI.get('secret.value');

const debug = require('debug')('auth');

export default oncePerServices(function (services) {

  const {updateToken = missingExport('updateToken')} = require('./tokenInHeader').default(services);
  const {setAccessTokenCookie = missingExport('setAccessTokenCookie')} = require('./tokenInCookie').default(services);

  /**
   * ExpressJS middleware модуль, поддерживающий авторизацию пользователя.  Выполняет:
   * - Обрабатывает данные из request.session (свойство поддерживает cookie-session npm).
   * - Если токен авторизации истек, продлевается токен используя таблицу sessions в БД.
   * - Если пользователь авторизован добавляет свойство request.user c данными пользователя.  Если пользователь не
   * авторизован request.user == null.
   */

  async function authMiddleware(req, res, next) {

    let auth = req.query.auth;

    if (!auth && req.headers.authorization) {
      const r = req.headers.authorization.split(' ');
      if (r.length === 2 && r[0] === 'Bearer') {
        auth = r[1];
      }
    }

    if (auth) { // проверяем что токен прислали или в заголовке илд как параметр запроса auth
      try {
        req.token = jwt.verify(auth, secret);
        if (req.token.user) {
          req.user = req.token.user;
        }
      } catch (err) {
        if (err instanceof TokenExpiredError) {
          res.status(401).send('Authorization token expired');
          return;
        }
        if (err instanceof JsonWebTokenError) {
          res.status(401).send('Invalid authorization token');
          return;
        }
        throw err;
      }
    } else if (req.cookies && req.cookies.access_token) { // проверяем cookie
      debug(`cookies.access_token: %s`, req.cookies.access_token);
      try {
        req.token = jwt.verify(req.cookies.access_token, secret)
      } catch (err) {
        if (err instanceof JsonWebTokenError || err instanceof TokenExpiredError) {
          setAccessTokenCookie(req, await updateToken(req, req.cookies.access_token));
          return;
        }
        throw err;
      }
    }

    if (!req.token) {
      res.status(401).send('Authorization token is required');
      return;
    }

    let context = req.context;
    if (!context) {
      const ip = requestIp.getClientIp(req);
      context = req.context = {
        reqId: shortid(),
        userIp: ip.startsWith('::ffff:') ? ip.substr(7) : ip, // удаляем префикс ipV6 для ipV4 адресов
      };
    }

    if (req.token.user) {
      const user = req.user = req.token.user;
      context.username = user.username;
      context.email = user.email;
    }

    if (req.token.appId) {
      context.appId = req.token.appId;
    }

    next();
  }

  return {
    authMiddleware,
  };
})
