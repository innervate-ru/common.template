import {oncePerServices, missingService, serviceName} from "../../../../common/services";
import nanoid from "nanoid";

export const name = serviceName(__filename);

export default oncePerServices(function (services) {
  const {
    interactions = missingService("interactions"),
    bus = missingService("bus"),
    "files/upload": filesUpload = missingService("files/upload"),
  } = services;


  class FilesUploadCleanup {
    async _serviceRun() {
      const context = nanoid();
      const servName = filesUpload._service.name;
      const action = "cleanup";
      await interactions.create({
        context,
        action,
        singleton: true,
        fromService: servName,
        toService: servName
      });
      this._iaProcess = await interactions.process({
        maxInParaller: 1,
        toService: servName,
        action,
        processor: async function (interaction) {
          try {
            await filesUpload.cleanup({context: interaction.context});
          } catch(error) {
            if (error && !error.context) error.context = interaction.context;
            this._service._reportError(error);
          } finally {
            console.info(37, filesUpload._cleanupInMin, filesUpload._cleanupInMin * 60 * 1000)
            interaction.processIn = filesUpload._cleanupInMin * 60 * 1000;
          }
        }
      });
    }

    async _serviceStop() {
      if (this._iaProcess) {
        await this._iaProcess();
        delete this._iaProcess;
      }
    }
  }

  return new (require('../../../../common/services').Service(services)(FilesUploadCleanup, {contextRequired: true}))(name, {
    dependsOn: [interactions, filesUpload],
  });
});
