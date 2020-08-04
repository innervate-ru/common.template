import configAPI from 'config'
import {missingArgument} from '../../common/validation'
import {oncePerServices, missingService} from '../../common/services'
const {experationPeriod: tokenExperationPeriod, extraTime: tokenExtraTime} = configAPI.get('jwt');
import jwt, {JsonWebTokenError, TokenExpiredError} from 'jsonwebtoken'

const debug = require('debug')('auth');

const secret = configAPI.get('secret.value');

export default oncePerServices(function (services) {

  /**
   * Express middleware: Возвращает токен, который не имеет ограничения по времени использования.  Такие токены выдаются партнерам, чтоб их системы
   * могли обращаться к API, без регулярной авторизации.
   */
  async function getExternalToken(req = missingArgument('req'), res = missingArgument('res'), next = missingArgument('next')) {

    let status = `error`;
    let token = '';

    if(req.body && req.body.login && req.body.system) {
      token = jwt.sign({
        user: {
          login: req.body.login
        },
        system: req.body.system
      }, secret, {expiresIn: 120 }); //2 минуты
      if(token) {
        status = `success`;
      }
    }

    return res.send({status: status, token: token});
  }

  async function checkExternalToken(req = missingArgument('req'), res = missingArgument('res'), next = missingArgument('next')) {
    let status = `error`;
    let login = '';
    let tokenPayload = null;

    if (req.body && req.body.login && req.body.token) {
      try {
        tokenPayload = jwt.verify(req.body.token, secret);
      } catch (err) {
        console.error(err);
      }

      if(tokenPayload) {
        if(tokenPayload.user.username === req.body.login) {
          login = tokenPayload.user.username;
          status = 'success';
        }
      }
    }

    return res.send({status: status, login: login});
  }



  return {
    getExternalToken,
    checkExternalToken
  };

})
