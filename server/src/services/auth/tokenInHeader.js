import {missingArgument} from '../../common/validation'
import {oncePerServices, missingService} from '../../common/services'
import shortid from 'shortid'
import requestIp from 'request-ip'

import configAPI from 'config'
import jwt, {JsonWebTokenError, TokenExpiredError} from 'jsonwebtoken'

const debug = require('debug')('auth');

const secret = configAPI.get('secret.value');
const {experationPeriod: tokenExperationPeriod, extraTime: tokenExtraTime} = configAPI.get('jwt');

export default oncePerServices(function (services) {

  const {
    postgres = missingService('postges'),
    'cyberlines/user': cyberlinesUser = missingService('cyberlines/user'),
    rights = missingService('rights'),
    webclients = missingService('webclients'),
  } = services;

  const userResolvers = require('../user/resolvers').default(services);

  async function newSession(req) {

    const isTestToken = await _isTestToken(req); /// Если тестовый токен, то не создаем сессию в БД

    req.token = {session: shortid(), safeDevice: true};
    debug('new session %s. device considered to be safe', req.token.session);

    if (!isTestToken) {
      await postgres.exec({
        statement: 'insert into session(id, ip) values ($1, $2);',
        params: [req.token.session, requestIp.getClientIp(req)]
      });
    }

    return req.token;
  }

  function logout(req) {
    delete req.user;
  }

  async function getToken(req = missingArgument('req'), res = missingArgument('res'), next = missingArgument('next')) {
    const time = (new Date()).toISOString();
    const [token, clients, rights] = await Promise.all([
      updateToken(req, req.body),
      webclients.getClientsDesc(),
      getUserRights({ value: req.body }),
    ]);
    res.json({
      time,
      refreshIn: tokenExperationPeriod,
      token,
      rights,
      clients,
    });
  }

  /// Тестовый токен, увеличен период жизни, сессия не создается в БД
  async function getTestToken(req = missingArgument('req'), res = missingArgument('res'), next = missingArgument('next')) {
    res.json({
      refreshIn: 60000 * 60 * 24,
      token: await updateToken(req, req.body)
    });
  }

  async function getUserRights({ value, user }) {
    let tokenPayload = null;

    if (value) {
      try {
        tokenPayload = jwt.verify(value, secret);
      } catch (err) {
        if (err instanceof TokenExpiredError) {
          tokenPayload = jwt.decode(value);
        }
      }
    }

    if ((!tokenPayload || !tokenPayload.user) && !user) return {};
    return await rights.getUserRights({ user: user || tokenPayload.user })
  }

  async function updateToken(req = missingArgument('req'), value) {

    let tokenPayload = null;
    const isTestToken = await _isTestToken(req);

    if (value) {
      try {
        tokenPayload = jwt.verify(value, secret);
      } catch (err) {
        if (err instanceof TokenExpiredError) {
          tokenPayload = jwt.decode(value);
        } else if (!(err instanceof JsonWebTokenError))
          throw err;
      }
    }

    let newPayload = null;
    debug('tokenPayload: %O', tokenPayload);
    if (!tokenPayload) { // делаем новый token
      debug('no token');
      newPayload = await newSession(req);
    } else {

      let {rowCount, rows} = await postgres.exec({
        statement: 'update session set last_seeing = now() where id = $1 returning active;',
        params: [tokenPayload.session]
      });

      if (isTestToken) { /// Если тестовый токен, то сессии нет БД, эмулируем запись в БД
        rowCount = 1;
        rows = [{active: true}]
      }

      debug('rowCount %d, active: %s', rowCount, (rowCount > 0 ? rows[0].active : 'n/a'));

      if (rowCount == 0 || !rows[0].active) { // сессия или была деактивированна, или её удалили из БД
        debug('session is missing');
        newPayload = await newSession(req);
      } else if (tokenPayload.user) { // если укзаан пользователь
        let crmFailure = false;
        let user = null;
        try {
          user = await userResolvers.getUser({login: tokenPayload.user.username});
          if (!user) {
            user = await cyberlinesUser.login({usernameOrEmail: tokenPayload.user.username, password: null});
          }
          debug('user found');
        } catch (err) {
          debug('Authentication error');
          crmFailure = true;
        }

        if (!crmFailure && (!user || user.blocked)) { // пользователя или удалили или заблокировали
          debug('user is missing or blocked');
          // блокируем все сессии пользователя
          await postgres.exec({
            statement: 'update session set active = false where user_email = $1;',
            params: [tokenPayload.user.email]
          });
          newPayload = await newSession(req);
        } else {
          debug('issue token with user');
          newPayload = {
            session: tokenPayload.session,
            user: {
              userId: user.userId,
              name: user.name,
              username: user.username,
              email: user.email,
              manager: user.manager,
              features: user.features,
              phone: user.tel || user.phone,
              passChangeDate: user.passChangeDate
            },
            safeDevice: tokenPayload.safeDevice
          }
        }
      } else {// пользователь не указан
        debug('issue token without user');
        newPayload = {session: tokenPayload.session, safeDevice: true};
      }
    }

    // console.info(`newPayload`, newPayload);

    req.token = newPayload;
    if (newPayload.hasOwnProperty('user'))
      req.user = newPayload.user;
    else
      delete req.user;

    return jwt.sign(newPayload, secret, {expiresIn: tokenExperationPeriod + tokenExtraTime});
  }

  async function _isTestToken(req = missingArgument('req')) {
    if (req.params.test) return true;
    return false;
  }

  return {
    newSession,
    logout,
    getToken,
    updateToken,
    getTestToken,
    getUserRights
  };
})
