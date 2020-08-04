import configAPI from 'config'
import {missingArgument} from '../../common/validation'
import {oncePerServices, missingExport} from '../../common/services'

export default oncePerServices(function (services) {

  const {
    getToken = missingExport('getToken'),
    updateToken = missingExport('updateToken'),
  } = require('./tokenInHeader').default(services);

  /**
   * Express middleware, которое кладет токен пользователя в cookie.  Это нужно чтоб пользователь мог пользоваться
   * авторизацией, при использовании graphiql, которые ничего не знает про алгоритм работы с токенами, который
   * использует клиент ЛК.
   */
  function setAccessTokenCookie(req = missingArgument('req'), token = missingArgument('token')) {
    let opts = {httpOnly: true, path: configAPI.get('graphql.pathname')};
    if (token.safeDevice) opts.maxAge = 1000 * 24 * 60 * 60 * 1000; // отдаем длительную cookie
    req.res.cookie('access_token', token, opts);
  }

  /**
   * Express middleware, которое кладет токен пользователя в cookie.  Это нужно чтоб пользователь мог пользоваться
   * авторизацией, при использовании graphiql, которые ничего не знает про алгоритм работы с токенами, который
   * использует клиент ЛК.
   */
  async function putTokenToCookie(req = missingArgument('req'), res = missingArgument('res'), next = missingArgument('next')) {
    if (req.method == 'GET' && !req.cookies.access_token)
      setAccessTokenCookie(req, await updateToken(req, req.cookies.access_token));
    next();
  }

  return {
    setAccessTokenCookie,
    putTokenToCookie,
  };
})
