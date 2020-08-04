import {oncePerServices} from '../../../common/services'
import missingService from '../../../common/services/missingService'
import {BaseEvent, validateEventFactory, VType} from "../../../common/events";

export default oncePerServices(function defineEvents({bus = missingService('bus')}) {

  bus.registerEvent([
    {
      kind: 'event',
      type: 'file.new',
      validate: validateEventFactory({
        _extends: BaseEvent,
        fileid: {type: VType.String().notEmpty(), required: true}, // идентификатор файла
        filename: {type: VType.String().notEmpty(), required: true}, // имя файла, как оно будет выглядеть при выгрузке из браузера
        mimeType: {type: VType.String()}, // mime-тип файла для выгрузки.  если не указан определяется на основе расширения файла в filename
        username: {type: VType.String()}, // Пользователь для которого создается данный файл
        email: {type: VType.String()}, // Email пользователя для которого создается данный файл
        client: {type: VType.String()}, // Клиент для которого создается данный файл
      }),
      toString: (ev) => `${ev.service}: new file (${ev.fileid}): '${ev.filename}'`,
    },
    {
      kind: 'event',
      type: 'file.completed',
      validate: validateEventFactory({
        _extends: BaseEvent,
        fileid: {type: VType.String().notEmpty(), required: true}, // идентификатор файла
        filename: {type: VType.String().notEmpty(), required: true}, // имя файла, как оно будет выглядеть при выгрузке из браузера
        mimeType: {type: VType.String()}, // mime-тип файла для выгрузки.  если не указан определяется на основе расширения файла в filename
        username: {type: VType.String()}, // Пользователь для которого создается данный файл
        email: {type: VType.String()}, // Email пользователя для которого создается данный файл
        client: {type: VType.String()}, // Клиент для которого создается данный файл
        size: {type: VType.Int(), required: true}, // Размер файла в байтах
        duration: {type: VType.Int(), required: true}, // Время формирования файла в ms
      }),
      toString: (ev) => `${ev.service}: file completed (${ev.fileid}): '${ev.filename}' ${ev.size} bytes in ${ev.duration} ms`,
    },
    {
      kind: 'event',
      type: 'file.removed',
      validate: validateEventFactory({
        _extends: BaseEvent,
        fileid: {type: VType.String().notEmpty(), required: true}, // идентификатор файла
        filename: {type: VType.String().notEmpty(), required: true}, // имя файла, как оно будет выглядеть при выгрузке из браузера
        email: {type: VType.String()}, // Email пользователя для которого создается данный файл
        username: {type: VType.String()}, // Пользователь для которого создается данный файл
        client: {type: VType.String()}, // Клиент для которого создается данный файл
      }),
      toString: (ev) => `${ev.service}: file removed (${ev.fileid}): '${ev.filename}'`,
    },
    {
      kind: 'event',
      type: 'file.cleanup',
      validate: validateEventFactory({
        _extends: BaseEvent,
        count: {type: VType.Int(), required: true}, // количество удаленных файлов
      }),
      toString: (ev) => `${ev.service}: files cleanup: removed ${ev.count} files`,
    },
  ]);
})
