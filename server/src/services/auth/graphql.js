import {oncePerServices} from '../../common/services'

const PREFIX = require('../../common/graphql/typePrefix').default(__dirname);

export default oncePerServices(function (services) {

  return async function build(args) {

    require('../../common/graphql/LevelBuilder.schema').build_options(args);

    const {parentLevelBuilder, typeDefs} = args;

    const resolvers = require('./resolvers').default(services);


    typeDefs.push(`
    type ${PREFIX}RegistrationList {
      id: Int
      registrationDate: String
      status: String
      phone: String
      name: String
      login: String
      taxNumber: String
      company: String
      skip: Boolean
      #Не отображать в конечном списке
    },
    
    type ${PREFIX}UserList {
      user_id: Int
      login: String
      name: String
      email: String
      
      intermodal: Boolean
      vgm: Boolean
      customs_informed: Boolean
      manager: Boolean
      blocked: Boolean
      company_name: [String]
      company_code: [String]
    }`

    );

    parentLevelBuilder.addQuery({
      name: 'getUserProcessingData',
      args: `
        email: String!
      `,
      type: 'Boolean',
      resolver: resolvers.getUserProcessingData
    });

    parentLevelBuilder.addMutation({
      description: `
Авторизует пользователя. Возвращает token с даннми пользователя и status: 'ok'.
Если пользователь не смог авторизоваться, возвращается status: 'invalidEmailPasswordPair'.
Если пользователь заблокирован, возвращается status: 'userIsBlocked'
`,
      name: `login`,
      args: `
usernameOrEmail: String!
password: String!
# true - если пользователь авторизовался на безопастном устройсте и
# token может хранится на устройстве длительное время;
# false - если пользователь отметил галочку "Чужой компьютер", и токен может хранится только до окончания сессии
safeDevice: Boolean!`,
      type: `${PREFIX}loginLogoutOutput`,
      typeDef: `
type ${PREFIX}loginLogoutOutput {
  # ok - если авторизация не прошла;
  # invalidEmailAndPasswordPair - если не найден пользователь по email или неверный пароль;
  # userIsBlocked - если пользователь заблокирован администратором
  status: String!
  # Через сколько миллисекунд надо запросить обновление токена
  refreshIn: Int
  # Access token, с базовой информацией в формате JWT о пользователе.  Или null, если авторизация не прошла.
  # При logout, новый access token в которм пользователь не авторизован.
  token: String
  # Права пользователя
  rights: String
}`,
      resolver: resolvers.login,
    });

    parentLevelBuilder.addMutation({
      description: `
Закрывает сессию пользователя. Всегда возвращает новый токен для неавторизованного пользователя.`,
      name: `logout`,
      type: `${PREFIX}loginLogoutOutput`,
      resolver: resolvers.logout,
    });

    parentLevelBuilder.addMutation({
      description: `Регистрация нового пользователя.`,
      name: `register`,
      args: `
# Логин пользователя (500)
login: String!
# Пароль пользователя (30)
password: String
# idcontact - игнорируется
idcontact: String
# Имя пользователя (200)
name: String!
# Признак блокировки пользователя
blocked: Int
# Доступ к vgm
vgm: Int
# Доступ к интермодальным перевозкам
intermodal: Int
# Является ли менеджером
manager: Int
# Доступ на раздел таможенное декларирование
customsinformed: Int
# idclient - игнорируется (50)
idclient: String
# Телефон (100)
tel: String!
# Email пользователя
email: String
# Комментарии (2000)
comments: String`,
      type: `${PREFIX}registerOutput`,
      typeDef: `
type ${PREFIX}registerOutput {
  # Логин пользователя (500)
  login: String!
  # Имя пользователя (200)
  name: String!
  # Email пользователя
  email: String
  # Признак блокировки пользователя
  blocked: Int
  # Доступ к vgm
  vgm: Int
  # Доступ к интермодальным перевозкам
  intermodal: Int
  # Является ли менеджером
  manager: Int
  # Доступ на раздел таможенное декларирование
  customsinformed: Int
  # Телефон (100)
  phone: String!
}`,
      resolver: resolvers.register,
    });


    parentLevelBuilder.addMutation({
      description: `
Регистрация нового пользователя.`,
      name: `registerByCode`,
      args: `
# Код подтверждения
verificationCode: String!`,
      type: `${PREFIX}registerByCodeOutput`,
      typeDef: `
type ${PREFIX}registerByCodeOutput {
  # Логин пользователя (500)
  login: String
  # Имя пользователя (200)
  name: String!
  # Email пользователя
  email: String
  # Признак блокировки пользователя
  blocked: Int
  # Доступ к vgm
  vgm: Int
  # Доступ к интермодальным перевозкам
  intermodal: Int
  # Является ли менеджером
  manager: Int
  # Доступ на раздел таможенное декларирование
  customsinformed: Int
  # Телефон (100)
  phone: String
}`,
      resolver: resolvers.registerByCode,
    });

    parentLevelBuilder.addMutation({
      description: `
Отправка смс с проверочным кодом пользователю.`,
      name: `sendVerificationCode`,
      args: `
# Логин пользователя (500)
login: String!
# Имя пользователя (200)
name: String!
# Телефон (100)
tel: String!
# ИНН (12)
taxNumber: String!
# Комментарии (2000)
comments: String
# Текущая локаль пользователя
locale: String`,
      type: `Boolean`,
      resolver: resolvers.sendVerificationCode,
    });

    parentLevelBuilder.addMutation({
      description: `
Отправка ссылки для сброса пароля`,
      name: `sendResetPasswordEmail`,
      args: `
    # Логин пользователя (500)
    login: String!
    # Текущая локаль пользователя
    locale: String`,
      type: `Boolean`,
      resolver: resolvers.sendResetPasswordEmail,
    });

    parentLevelBuilder.addMutation({
      description: `
Изменение пароля пользователя`,
      name: `changePassword`,
      args: `
# Проверочный токен
token: String!
# Текущая локаль пользователя
locale: String
# Новый пароль пользователя
password: String!`,
      type: `Boolean`,
      resolver: resolvers.changePassword,
    });

    parentLevelBuilder.addMutation({
      description: `Установка пароля для пользователя`,
      name: `setPassword`,
      args: `
      # Старый пароль - сейчас не проверяется
      oldPassword: String
      # Новый пароль пользователя
      password: String!
      # Текущая локаль пользователя
      locale: String`,
      type: `Boolean`,
      resolver: resolvers.setPassword,
    });

    parentLevelBuilder.addQuery({
      name: `getRegistrationStatus`,
      type: `${PREFIX}getRegistrationStatusOutput`,
      typeDef: `
type ${PREFIX}RegistrationStatusForm {
  # Логин пользователя (500)
  login: String!
  # Имя пользователя (200)
  name: String!
  # Телефон (100)
  tel: String!
  # ИНН (12)
  taxNumber: String!
  # Комментарии (2000)
  comments: String
}

type ${PREFIX}getRegistrationStatusOutput {
  form: ${PREFIX}RegistrationStatusForm
  status: String
}`,
      resolver: resolvers.getRegistrationStatus,
    });

    // TODO: Добавить getIpAddress, чтоб не гадать
    // TODO: getEmailFromUserToken

    parentLevelBuilder.addMutation({
      description: `
Получение токена, для авторизованного пользователя.  Операция доступна только для ip-адреса указанного в файле конфигурации`,
      name: `getUserAuthToken`,
      args: [
        {name: 'email', type: 'String!'}
      ],
      type: `String!`,
    });

    parentLevelBuilder.addMutation({
      description: `
Авторизует пользователя. Возвращает token с даннми пользователя и status: 'ok'.
Если пользователь не смог авторизоваться, возвращается status: 'invalidEmailPasswordPair'.
Если пользователь заблокирован, возвращается status: 'userIsBlocked'
`,
      name: `loginByToken`,
      args: `
token: String!
# true - если пользователь авторизовался на безопастном устройсте и
# token может хранится на устройстве длительное время;
# false - если пользователь отметил галочку "Чужой компьютер", и токен может хранится только до окончания сессии
safeDevice: Boolean!`,
      type: `${PREFIX}loginLogoutOutput`,
      typeDef: `
type ${PREFIX}loginLogoutOutput {
  # ok - если авторизация не прошла;
  # invalidEmailAndPasswordPair - если не найден пользователь по email или неверный пароль;
  # userIsBlocked - если пользователь заблокирован администратором
  status: String!
  # Через сколько миллисекунд надо запросить обновление токена
  refreshIn: Int
  # Access token, с базовой информацией в формате JWT о пользователе.  Или null, если авторизация не прошла.
  # При logout, новый access token в которм пользователь не авторизован.
  token: String
  # Права пользователя
  rights: String
}`,
      resolver: resolvers.loginByToken,
    });

    parentLevelBuilder.addQuery({
      name: `getExternalAccountLink`,
      type: `${PREFIX}getExternalAccountLinkOutput`,
      typeDef: `
        type ${PREFIX}getExternalAccountLinkOutput {
          link: String,
          customsInformed: Boolean,
        }
      `,
      resolver: resolvers.getExternalAccountLink,
    });

    parentLevelBuilder.addQuery({
      name: `getRegistrationList`,
      type: `[${PREFIX}RegistrationList]`,
      args: `
        offset: Int,
        limit: Int
      `,
      resolver: resolvers.getRegistrationList,
    });

    parentLevelBuilder.addQuery({
      name: `getUserList`,
      type: `[${PREFIX}UserList]`,
      args: `
        offset: Int!,
        limit: Int!,
        user_id: Int,
        login: String,
        name: String,
        email: String,
        intermodal: Boolean,
        vgm: Boolean,
        customs_informed: Boolean,
        blocked: Boolean,
        manager: Boolean,
        company_name: String,
        company_code: String
      `,
      resolver: resolvers.getUserList,
    });
  
    // parentLevelBuilder.addMutation({
    //   description: `Отправка Email с кастомным сообщением`,
    //   name: `sendSorryMessage`,
    //   args: `
    //     # Список идентификаторов пользователей
    //     idlist: [Int]`,
    //   type: `Boolean`,
    //   resolver: resolvers.sendSorryMessage,
    // });
    
  };
})
