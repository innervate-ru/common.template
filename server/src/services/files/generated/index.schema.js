import { VType, validateThisServiceSettings, validate} from '../../../common/validation';

export const ctor_settings = validateThisServiceSettings({
  path: { type: VType.String(), required: true, }, // путь к директории для временных файлов
  cleanupInMin: { type: VType.Int(), required: true, }, // период через который запускается метод cleanup
  maxTimeToCompleteInMin: { type: VType.Int(), required: true, }, // через какое количество минут удалять файлы, которые были созданны но не дошли до completed
  newSubdirInMin: { type: VType.Int(), required: true, }, // через какое количество минут создавать новые папки для файлов.  Должно быть меньше или равно keepInMin
  _final: true,
});

export const newFile_args = validate.method.this('args', {
  context: {type: VType.String(), required: true},
  filename: {type: VType.String().notEmpty(), required: true}, // имя файла, как оно будет выглядеть при выгрузке из браузера
  mimeType: {type: VType.String()}, // mime-тип файла для выгрузки.  если не указан определяется на основе расширения файла в filename
  username: {type: VType.String()}, // Пользователь для которого создается данный файл
  email: {type: VType.String()}, // Email пользователя для которого создается данный файл
  client: {type: VType.String()}, // Клиент для которого создается данный файл
  _final: true,
});

export const fileCompleted_args = validate.method.this('args', {
  context: {type: VType.String()},
  file: {
    fields: {
      fileid: {type: VType.String(), required: true},
      path: {type: VType.String(), required: true},
      ct: {type: VType.Int(), required: true},
      options: {
        fields: {
          filePaths: {type: VType.Array(), required: true},
        }
      },
      _final: false,
    }
  },
  _final: true,
});

export const removeFile_args = validate.method.this('args', {
  context: {type: VType.String()},
  file: {
    fields: {
      fileid: {type: VType.String(), required: true},
      _final: false,
    }
  },
  _final: false,
});

export const getFilePath_args = validate.method.this('args', {
  context: {type: VType.String()},
  file: {
    fields: {
      fileid: {type: VType.String(), required: true},
      _final: false,
    }
  },
  _final: false,
});

export const cleanup_args = validate.method.this('args', {
  context: {type: VType.String()},
  _final: true,
});

