import { oncePerServices, missingService } from '../../../common/services';
import { BaseEvent, validateEventFactory, VType } from '../../../common/events';

export default oncePerServices(function defineEvents({ bus = missingService('bus') }) {
  bus.registerEvent([
    {
      kind: 'event',
      type: 'file.uploaded',
      validate: validateEventFactory({
        _extends: BaseEvent,
        fileId: { type: VType.String().notEmpty(), required: true },
        filename: { type: VType.String().notEmpty(), required: true },
        mimeType: { type: VType.String() },
        username: { type: VType.String() },
        email: { type: VType.String() }
      }),
      toString: (ev) =>
        `${ev.service}: file upload (${ev.fileId}): '${ev.filename}'`
    },
    {
      kind: 'event',
      type: 'file.uploadCompleted',
      validate: validateEventFactory({
        _extends: BaseEvent,
        fileId: { type: VType.String().notEmpty(), required: true },
        filename: { type: VType.String().notEmpty(), required: true },
        mimeType: { type: VType.String() },
        username: { type: VType.String() },
        email: { type: VType.String() },
        size: { type: VType.Int(), required: true },
        duration: { type: VType.Int(), required: true }
      }),
      toString: (ev) =>
        `${ev.service}: file upload completed (${ev.fileId}): '${ev.filename}' ${ev.size} bytes in ${ev.duration} ms`
    },
    {
      kind: 'event',
      type: 'file.deleted',
      validate: validateEventFactory({
        _extends: BaseEvent,
        fileId: { type: VType.String().notEmpty(), required: true },
        filename: { type: VType.String().notEmpty(), required: true },
        email: { type: VType.String() },
        username: { type: VType.String() },
        client: { type: VType.String() }
      }),
      toString: (ev) => `${ev.service}: file removed (${ev.fileId}): '${ev.filename}'`
    }
  ]);
});
