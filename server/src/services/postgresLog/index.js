import configAPI from 'config'
import oncePerServices from '../../common/services/oncePerServices'

import {ACTION} from '../../common/events/Bus.levels'
import {READY} from '../../common/services/Service.states'

export const name = require('../../common/services/serviceName').default(__filename);

let postgresLog;

export default oncePerServices(function (services) {

  const PGConnector = require('../../common/connectors/PGConnector').default(services);

  return postgresLog = new (require('../../common/services').Service(services)(PGConnector))(name, configAPI.get('postgresLog'));
});

export function logActions(ev) {

  if (ev.level !== ACTION || !postgresLog || postgresLog._service.state !== READY) return;

  const {timestamp, host, node, service, type, message, username, email, client, level, req_id, action, user_ip, ...options} = ev;

  postgresLog.exec({
    statement: `insert into actions (timestamp, host, node, service, type, message, username, email, client, req_id, action, user_ip, options) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    params: [new Date(timestamp * 1000), host, node, service, type, message, username, email, client, req_id, action, user_ip, options],
  })
}
