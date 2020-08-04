import configAPI from 'config'
import {missingArgument} from '../../common/validation'
import {oncePerServices, missingService} from '../../common/services'
import jwt from 'jsonwebtoken'

const secret = configAPI.get('secret.value');

export default oncePerServices(function (services) {

  /**
   * Express middleware: Возвращает токен, который не имеет ограничения по времени использования.  Такие токены выдаются партнерам, чтоб их системы
   * могли обращаться к API, без регулярной авторизации.
   */
  async function getLongToken(req = missingArgument('req'), res = missingArgument('res'), next = missingArgument('next')) {
    return res.send(`authorization: Bearer ${jwt.sign({
      appId: req.params.appId,
      ...req.query,
    }, secret)}`);
  }

  return {
    getLongToken,
  };

})
