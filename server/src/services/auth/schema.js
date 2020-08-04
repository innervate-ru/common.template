import {
  GraphQLInt,
  GraphQLBoolean,
  GraphQLString,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLInputObjectType,
} from 'graphql';

export const loginMutation = {

  name: 'user_login',

  description: `
      Авторизует пользователя. Возвращает token с даннми пользователя и status: 'ok'. 
      Если пользователь не смог авторизоваться, возвращается status: 'invalidEmailPasswordPair'.
      Если пользователь заблокирован, возвращается status: 'userIsBlocked'`,

  args: {
    usernameOrEmail: { type: new GraphQLNonNull(GraphQLString) },
    password: { type: new GraphQLNonNull(GraphQLString) },
    safeDevice: {
      description: `
        true - если пользователь авторизовался на безопастном устройсте и token может хранится на устройстве длительное время;        
        false - если пользователь отметил галочку "Чужой компьютер", и токен может хранится только до окончания сессии`,
      type: new GraphQLNonNull(GraphQLBoolean),
    },
  },

  type: new GraphQLObjectType({
    name: 'user_login__output',
    fields: {
      status: {
        description: `
        ok - если авторизация не прошла;         
        invalidEmailAndPasswordPair - если не найден пользователь по email или неверный пароль;        
        userIsBlocked - если пользователь заблокирован администратором`,
        type: new GraphQLNonNull(GraphQLString),
      },
      refreshIn: {
        description: `
        Через сколько миллисекунд надо запросить обновление токена`,
        type: GraphQLInt,
      },
      token: {
        description: `
        Access token, с базовой информацией в формате JWT о пользователе.  Или null, если авторизация не прошла.`,
        type: GraphQLString
      },
    },
  }),
};

export const logoutMutation = {

  name: 'user_logout',

  description: `Закрывает сессию пользователя. Всегда возвращает новый токен для неавторизованного пользователя.`,

  type: new GraphQLObjectType({
    name: 'user_logout__output',
    fields: {
      status: {
        description: `ok`,
        type: new GraphQLNonNull(GraphQLString)
      },
      refreshIn: {
        description: `
        Через сколько миллисекунд надо запросить обновление токена`,
        type: GraphQLInt,
      },
      token: {
        description: `
        Новый access token`,
        type: new GraphQLNonNull(GraphQLString)
      },
    },
  }),
};


export const registerMutation = {

  name: 'user_register',

  description: `
      Регистрация нового пользователя.`,
  args: {
    login: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Логин пользователя (500)',
    },
    password: {
      type: GraphQLString,
      description: 'Пароль пользователя (30)',
    },
    idcontact: {
      type: GraphQLString,
      description: 'idcontact - игнорируется',
    },
    name: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Имя пользователя (200)',
    },
    blocked: {
      type: GraphQLInt,
      description: 'Признак блокировки пользователя',
    },
    vgm: {
      description: 'Доступ к vgm',
      type: GraphQLInt,
    },
    intermodal: {
      description: 'Доступ к интермодальным перевозкам',
      type: GraphQLInt,
    },
    manager: {
      description: 'Является ли менеджером',
      type: GraphQLInt,
    },
    customsinformed: {
      description: 'Доступ на раздел таможенное декларирование',
      type: GraphQLInt,
    },
    idclient: {
      description: 'idclient - игнорируется (50)',
      type: GraphQLString,
    },
    tel: {
      description: 'Телефон (100)',
      type: new GraphQLNonNull(GraphQLString),
    },
    email: {
      type: GraphQLString,
      description: 'Email пользователя',
    },
    comments: {
      name: 'comments',
      type: GraphQLString,
      description: 'Комментарии (2000)',
    },
  },

  type: new GraphQLObjectType({
    name: 'user_register__output',
    fields: {
      login: {
        type: new GraphQLNonNull(GraphQLString),
        description: 'Логин пользователя (500)',
      },
      name: {
        type: new GraphQLNonNull(GraphQLString),
        description: 'Имя пользователя (200)',
      },
      email: {
        type: GraphQLString,
        description: 'Email пользователя',
      },
      blocked: {
        type: GraphQLInt,
        description: 'Признак блокировки пользователя',
      },
      vgm: {
        description: 'Доступ к vgm',
        type: GraphQLInt,
      },
      intermodal: {
        description: 'Доступ к интермодальным перевозкам',
        type: GraphQLInt,
      },
      manager: {
        description: 'Является ли менеджером',
        type: GraphQLInt,
      },
      customsinformed: {
        description: 'Доступ на раздел таможенное декларирование',
        type: GraphQLInt,
      },
      phone: {
        description: 'Телефон (100)',
        type: new GraphQLNonNull(GraphQLString),
      },
    },
  }),
};

export const registerByVerificationCodeMutation = {

  name: 'user_register_by_code',

  description: `
      Регистрация нового пользователя.`,
  args: {
    verificationCode: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Код подтверждения',
    },
  },

  type: new GraphQLObjectType({
    name: 'user_register_by_code__output',
    fields: {
      login: {
        type: GraphQLString,
        description: 'Логин пользователя (500)',
      },
      name: {
        type: new GraphQLNonNull(GraphQLString),
        description: 'Имя пользователя (200)',
      },
      email: {
        type: GraphQLString,
        description: 'Email пользователя',
      },
      blocked: {
        type: GraphQLInt,
        description: 'Признак блокировки пользователя',
      },
      vgm: {
        description: 'Доступ к vgm',
        type: GraphQLInt,
      },
      intermodal: {
        description: 'Доступ к интермодальным перевозкам',
        type: GraphQLInt,
      },
      manager: {
        description: 'Является ли менеджером',
        type: GraphQLInt,
      },
      customsinformed: {
        description: 'Доступ на раздел таможенное декларирование',
        type: GraphQLInt,
      },
      phone: {
        description: 'Телефон (100)',
        type: GraphQLString,
      },
    },
  }),
};

const FormFields = {
  login: {
    type: new GraphQLNonNull(GraphQLString),
    description: 'Логин пользователя (500)',
  },
  name: {
    type: new GraphQLNonNull(GraphQLString),
    description: 'Имя пользователя (200)',
  },
  tel: {
    description: 'Телефон (100)',
    type: new GraphQLNonNull(GraphQLString),
  },
  taxNumber: {
    description: 'ИНН (12)',
    type: new GraphQLNonNull(GraphQLString),
  },
  comments: {
    name: 'comments',
    type: GraphQLString,
    description: 'Комментарии (2000)',
  },
};

export const getRegistrationStatusQuery = {
  name: 'RegistrationStatusText',
  type: new GraphQLObjectType({
    name: 'RegistrationStatusType',
    fields: {
      form: {
        type: new GraphQLObjectType({
          name: 'RegistrationStatusFormType',
          fields: FormFields
        })
      },
      status: { type: GraphQLString }
    }
  })
};

export const sendVerificationCodeMutation = {
  type: GraphQLBoolean,
  name: 'user_send_verification_code',
  description: `
      Отправка смс с проверочным кодом пользователю.`,
  args: {
    ...FormFields,
    locale: {
      type: GraphQLString,
      description: 'Текущая локаль пользователя',
    },
  },
};

export const sendResetPasswordEmailMutation = {
  type: GraphQLBoolean,
  name: 'user_send_reset_password_email',
  description: `
    Отправка ссылки для сброса пароля`,
  args: {
    login: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Логин пользователя (500)',
    },
    locale: {
      type: GraphQLString,
      description: 'Текущая локаль пользователя',
    },
  }
};

export const changePasswordMutation = {
  type: GraphQLBoolean,
  name: 'user_change_password',
  description: `
    Изменение пароля пользователя`,
  args: {
    token: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Проверочный токен'
    },
    locale: {
      type: GraphQLString,
      description: 'Текущая локаль пользователя',
    },
    password: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Новый пароль пользователя'
    }
  }
};

export default function (queries, mutations) {
  queries.auth = {
    name: `User`,
    description: `Запросы (queries) сервиса 'User'`,
    type: new GraphQLObjectType({
      name: 'UserQueries',
      fields: {
        getRegistrationStatus: getRegistrationStatusQuery
      }
    })
  };

  mutations.auth = {
    name: `User`,
    description: `Мутации (mutations) сервиса 'User'`,
    type: new GraphQLObjectType({
      name: `UserMutations`,
      fields: {
        login: loginMutation,
        logout: logoutMutation,
        register: registerMutation,
        registerByCode: registerByVerificationCodeMutation,
        sendVerificationCode: sendVerificationCodeMutation,
        sendResetPasswordEmail: sendResetPasswordEmailMutation,
        changePassword: changePasswordMutation
      }
    }),
  };
}
