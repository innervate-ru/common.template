module.exports = {
  node: 'tmpl.prod',
  consoleLevel: 5, // Глубина логирования в graylog и серверную консоль (см. src/common/events/Bus.js)
  http: { // Настройки протокола, хоста и порта, на которых работает ЛК
    port: process.env.HTTP_PORT || 3000, // Порт, на котором запускается инстанс. Важно! Разнотипные инстансы (прод и дев) должны быть на разных портах.
  },
  grayLog: { // Параметры логирования в Graylog
    enabled: true, // Сервис активен
    config: {
      adapterName: 'udp', // Название адаптера (см. настройки грейлога)
      adapterOptions: {
        protocol: 'udp4', // Протокол
        host: process.env.HOST || '...', // Хост
        port: 12201, // Порт
      }
    }
  },
  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_HOST || 5432,
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
    max: process.env.POSTGRES_MAX || 10,
    idleTimeoutMillis: process.env.POSTGRES_TIMEOUT || 30000,
  },
  evolutions: { // подключение к БД под пользователем, который имеет право менять структуру БД
    user: undefined,
    password: undefined,
  },
  monitoring: {
    key: process.env.MONITORING_KEY || '123',
    countersResetPeriod: process.env.MONITORING_PERIOD || 60000,
  },
  secret: { // Настройки ключа шифрования, необходимого для валидации сессий пользователей
    value: process.env.SECRET || '1234567890', // Ключ для шифрования JWT-токенов для авторизации
  },
  jwt: { // Настройки модуля для работы с JWT-токенами
    experationPeriod: 600, // Основное время активности токена !!! в секундах
    extraTime: 300, // Дополнительное время активности !!! в секундах
  },
  graphql: { // Настройки graphiql интерфейса
    enableUI: process.env.hasOwnProperty('GRAPHIQL') ? JSON.parse(process.env.GRAPHIQL) : true, // Активность graphiql
    pathname: '/graphql', // Адрес graphiql
  },
  files: {
    temp: {
      path: process.env.FILES_TMP_PATH || '../tmp',
      keepInMin: 30,
      newSubdirInMin: 10,
    },
    generated: {
      path: process.env.FILES_GEN_PATH || '../gen',
      cleanupInMin: 30,
      maxTimeToCompleteInMin: 20,
      newSubdirInMin: 10,
    },
    upload: {
      path: process.env.FILES_UPLOAD_PATH || '../upload',
      cleanupInMin: 30,
      maxTimeToCompleteInMin: 20,
      newSubdirInMin: 10,
    },
  },
};
