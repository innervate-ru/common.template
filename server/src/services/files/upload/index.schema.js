import { VType, validateThisServiceSettings, validate } from '../../../common/validation';

export const ctor_settings = validateThisServiceSettings({
  path: { type: VType.String(), required: true },
  cleanupInMin: { type: VType.Int(), required: true, },
  maxTimeToCompleteInMin: { type: VType.Int(), required: true, },
  newSubdirInMin: {type: VType.Int() },
  _final: true
});

export const uploadFile_args = validate.method.this('args', {
  context: { type: VType.String(), required: true },
  filename: { type: VType.String().notEmpty(), required: true },
  mimeType: { type: VType.String() },
  username: { type: VType.String() },
  email: { type: VType.String() },
  size: {type: VType.Int(), required: true},
  fullPath: {type: VType.String(), required: true},
  fileId: {type: VType.String(), required: true},
  options: {type: VType.Object()},
  _final: true
});

export const fileCompleted_args = validate.method.this('args', {
  context: { type: VType.String() },
  file: {
    fields: {
      fileId: { type: VType.String(), required: true },
      path: { type: VType.String(), required: true },
      timeTaken: { type: VType.Int(), required: true },
      _final: false
    }
  },
  _final: true
});

export const deleteFile_args = validate.method.this('args', {
  context: { type: VType.String() },
  file: {
    fields: {
      fileId: { type: VType.String(), required: true },
      _final: false
    }
  },
  _final: false
});

export const getFile_args = validate.method.this('args', {
  context: { type: VType.String() },
  file: {
    fields: {
      fileId: { type: VType.String(), required: true },
      _final: false
    }
  },
  _final: false
});

export const cleanup_args = validate.method.this("args", {
  context: { type: VType.String()},
  _final: true,
});
