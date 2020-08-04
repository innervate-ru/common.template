import oncePerServices from '../../../../common/services/oncePerServices'
import missingService from '../../../../common/services/missingService'

export const name = require('../../../../common/services/serviceName').default(__filename);

export default oncePerServices(function (services) {

  const {
    interactions = missingService('interactions'),
    'files/generated': filesGenerated  = missingService('files/generated'),
  } = services;

  class FilesGeneratedCleanup {

    async _serviceRun() {
      const context = nanoid();
      const svcName = filesGenerated._service.name;
      const action = 'cleanup';
      await interactions.create({
        context,
        singleton: true,
        fromService: svcName,
        toService: svcName,
        action,
      });
      this._stopProcessing = await interactions.process({
        maxInParaller: 1,
        toService: svcName,
        action,
        processor: async (ia) => {
          try {
            await filesGenerated.cleanup({context: ia.context})
          } catch (err) {
            if (!err.context) err.context = ia.context;
            this._service._reportError(err);
          } finally {
            ia.processIn = filesGenerated._cleanupInMin * 60 * 1000;
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
    dependsOn: [interactions, filesGenerated],
  });
});
