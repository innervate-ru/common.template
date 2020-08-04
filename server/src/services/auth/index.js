import {oncePerServices, missingExport} from '../../common/services'

export default oncePerServices(function (services) {
  return Object.assign({},
    require('./expressMiddleware').default(services),
    require('./tokenInHeader').default(services),
    require('./tokenInCookie').default(services),
    require('./getLongToken').default(services),
    require('./getExternalToken').default(services),
  );
});
