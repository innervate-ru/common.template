import {VType, validateThisServiceSettings, validate} from '../../../common/validation';

export const ctor_settings = validateThisServiceSettings({
  path: { type: VType.String(), required: true, }, // путь к директории для временных файлов
  keepInMin: { type: VType.Int(), required: true, }, // через какое количество минут удалять не удаленные временные файлы
  newSubdirInMin: { type: VType.Int(), required: true, }, // через какое количество минут создавать новые папки для файлов.  Должно быть меньше или равно keepInMin
  _validate: (context, value, message, validateOptions) => {
    if (message) return message;
    if (value.keepInMin < value.newSubdirInMin) {
      return [`newSubdirInMin (${value.newSubdirInMin}) must be less or equal to keepInMin (${value.keepInMin})`];
    }
  },
  _final: true,
});

export const newFile_args = validate.method.this('args', {
  context: {type: VType.String(), required: true},
  _final: true,
});

export const fileCompleted_args = validate.method.this('args', {
  context: {type: VType.String()},
  file: {
    fields: {
      path: {type: VType.String(), required: true},
      ct: {type: VType.Int(), required: true},
      _final: false,
    }
  },
  _final: true,
});

export const removeFile_args = validate.method.this('args', {
  context: {type: VType.String()},
  file: {
    fields: {
      path: {type: VType.String(), required: true},
      _final: false,
    }
  },
  _final: false,
});

export const cleanup_args = validate.method.this('args', {
  context: {type: VType.String()},
  _final: true,
});

