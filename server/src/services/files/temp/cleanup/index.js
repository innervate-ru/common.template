import oncePerServices from '../../../../common/services/oncePerServices'
import missingService from '../../../../common/services/missingService'
import nanoid from "nanoid";

export const name = require('../../../../common/services/serviceName').default(__filename);

export default oncePerServices(function (services) {

  const {
    interactions = missingService('interactions'),
    'files/temp': fileTemp  = missingService('files/temp'),
  } = services;

  class FilesGeneratedCleanup {

    async _serviceRun() {
      const context = nanoid();
      const svcName = fileTemp._service.name;
      const action = 'cleanup';
      await interactions.create({
        context,
        singleton: true,
        fromService: svcName,
        toService: svcName,
        action,
      });
      this._stopProcessing = await interactions.process({
        С: 1,
        toService: svcName,
        action,
        processor: async (ia) => {
          try {
            await this.cleanup({context: ia.context})
          } catch (err) {
            if (!err.context) err.context = ia.context;
            this._service._reportError(err);
          } finally {
            ia.processIn = fileTemp._newSubdirInMin * 60 * 1000;
          }
        }
      });
    }

    async _serviceStop() {
      if (this._stopProcessing) {
        await this._stopProcessing();
        delete this._stopProcessing;
      }
    }
  }

  return new (require('../../../../common/services').Service(services)(FilesGeneratedCleanup, {contextRequired: true}))(name, {
    dependsOn: [interactions, fileTemp],
  });
});
