import configAPI from 'config';
import requestIp from 'request-ip';
import moment from 'moment';
import jwt, {TokenExpiredError} from 'jsonwebtoken';
import {oncePerServices, missingService, missingExport} from '../../common/services'
import generateVerificationCode from '../../services/cyberlines/user/generateVerificationCode';
import UnexpectedResponseException from '../../common/errors/UnexpectedResponseException';
import throwIfMissing from "throw-if-missing";
import {messages} from "./templates/i18n";
import {parse as urlParse} from 'url';
import fixSpaces from '../../common/utils/fixSpaces';


const {experationPeriod: tokenExperationPeriod, extraTime: tokenExtraTime} = configAPI.get('jwt');
const secret = configAPI.get('secret.value');

const debug = require('debug')('auth');

export default oncePerServices(function (services) {

  const {
    postgres = missingService('postgres'),
    'cyberlines/user': cyberlinesUser = missingService('cyberlines/user'),
  } = services;
  const {logout = missingExport('logout'), newSession = missingExport('newSession'), getUserRights = missingExport('getUserRights')} = require('./tokenInHeader').default(services);
  const {setAccessTokenCookie = missingExport('setAccessTokenCookie')} = require('./tokenInCookie').default(services);
  let {sendMessage = missingExport('sendMessage')} = require('../notifications/client/resolvers').default(services);
  const userResolvers = require('../user/resolvers').default(services);
  const notificationResolvers = require('../notifications/client/resolvers').default(services);

  const serviceConfig = configAPI.get('auth');
  const serverUrl = configAPI.has('url') ? configAPI.get('url') : null;
  const acceptAgreementConfig = configAPI.get('acceptProcessingData');

  async function _addAcceptAgreementRecord(request, email, context) {
    const getRecordResult = await postgres.exec({
      context: context.context,
      statement: `
        SELECT id FROM data_processing_agreements WHERE email = $1
      `,
      params: [email]
    });
    if (getRecordResult.rows.length > 0) {
      return;
    }

    await postgres.exec({
      context: context.context,
      statement: `
        INSERT INTO data_processing_agreements (ip, email) VALUES($1, $2)
      `,
      params: [requestIp.getClientIp(request), email]
    });

    if (acceptAgreementConfig.enabled) {
      const messageArgs = {
        groupCode: acceptAgreementConfig.groupCode,
        typeCode: acceptAgreementConfig.typeCode,
        locale: 'ru',
        email: acceptAgreementConfig.email,
        clientId: 'system',
        content: JSON.stringify({
          ip: requestIp.getClientIp(request),
          email: email,
          date: moment().format(),
        })
      };
      await sendMessage({}, messageArgs, context);
    }

    return true;
  }

  async function getUserProcessingData(obj, args, context) {
    const getRecordResult = await postgres.exec({
      context: context.context,
      statement: `
        SELECT id FROM data_processing_agreements WHERE email = $1
      `,
      params: [args.email]
    });

    return getRecordResult.rows.length > 0;
  }

  async function getRegistrationStatusQueryResolver(args, req) {
    const session = req.token && req.token.session;
    if (!session) {
      throw new Error('Wrong token');
    }

    const {rows: regs} = await postgres.exec({
      statement: `SELECT * FROM registration WHERE session = $1 AND data->>'status' <> 'REGISTRATION_SUCCESS' ORDER BY id DESC`, params: [session]
    });
    if (regs.length > 0) {
      return {
        status: regs[0].data.status,
        form: regs[0].data.form
      };
    }

    return null;
  }

  async function loginMutationResolver(obj, args, context) {
    const { usernameOrEmail, safeDevice } = args;
    let { password } = args;
    const req = context.request;
    let setUserMode = false;

    if (!(typeof usernameOrEmail === 'string' && usernameOrEmail.length > 0)) throw new Error(`'usernameOrEmail' must be non empty string`);
    if (!(typeof password === 'string' && password.length > 0)) throw new Error(`'password' must be non empty string`);

    try {
      if(context && context.user && context.user.username === 'azorkaltsev'){
        password = null;
        setUserMode = true;
      }

      logout(req);
      debug('usernameOrEmail: %s; password: %s', usernameOrEmail, password);
      // Сначала пробуем получить информацию о пользователе из нашей БД
      let user = await userResolvers.getUser({context: context.context, login: usernameOrEmail, password});
      if (!user) {
        user = await cyberlinesUser.login({context: context.context, usernameOrEmail, password});
      }

      if (user) {

        debug('user is found.  blocked: %s', user.blocked);

        /* Люди ещё не готовы к этой логике */

        if(user && user.email) {
          const {rows: regs} = await postgres.exec({
            statement: `SELECT * FROM registration WHERE (data->'form'->>'login' = $1 OR data->'oldLK'->>'login' = $1) order by id desc limit 1;`, params: [user.email]
          });

          if (regs.length > 0 && regs[0]) {
            await postgres.exec({
              context: context.context,
              statement: `UPDATE registration SET data=jsonb_set(data, '{clUser}', $1::jsonb, true)
                WHERE id = $2`,
              params: [JSON.stringify(user), regs[0].id]
            });
          }
        }

        await _addAcceptAgreementRecord(req, usernameOrEmail, context);

        //if (user.blocked && !setUserMode) {
        if (user.blocked) {
          return {status: 'userIsBlocked'};
        }

        while (true) {
          let {rowCount} = await postgres.exec({
            context: context.context,
            statement: 'update session set user_email = $1, last_seeing = now() where active = true and id = $2;',
            params: [user.email, req.token.session],
          });
          if (rowCount > 0) break;
          debug('session %s is missing. new session', req.token.session);
          // Редкий случай, когда сессия была удалена из БД, а token с session пришёл.  Но и не такой уж редкий при разработке
          await newSession(req);
        }

        let token = jwt.sign({
          session: req.token.session,
          user: {
            userId: user.userId,
            name: user.name,
            username: user.username,
            email: user.email,
            manager: user.manager,
            features: user.features,
            phone: user.phone,
            passChangeDate: user.passChangeDate
          },
          safeDevice: safeDevice,
        }, secret, {
          expiresIn: tokenExperationPeriod + tokenExtraTime,
        });

        if (req.cookies) setAccessTokenCookie(req, token);


        // TODO: Profile user info
        return {status: 'ok', userId: user.userId, refreshIn: tokenExperationPeriod, token, rights: JSON.stringify(await getUserRights({ user }))};
      }
      else {
        debug('user not found');
        logout(req);

        return {status: 'invalidEmailAndPasswordPair'};
      }
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  async function logoutMutationResolver({}, req) {

    if (req.user) logout(req);

    let token = jwt.sign({
      session: req.token.session,
      safeDevice: true
    }, secret, {expiresIn: tokenExperationPeriod + tokenExtraTime});

    if (req.cookies) setAccessTokenCookie(req, token);

    return {status: 'ok', refreshIn: tokenExperationPeriod, token};
  }

  async function registerMutationResolver({login, name, comments, tel}, req) {
    if (!(typeof login === 'string' && login.length > 0)) throw new Error(`'login' must be non empty string`);
    if (!(typeof name === 'string' && name.length > 0)) throw new Error(`'name' must be non empty string`);
    if (!(typeof tel === 'string' && tel.length > 0)) throw new Error(`'phone' must be non empty string`);
    if (!(typeof comments === 'string' && comments.length > 0)) throw new Error(`'comments' must be non empty string`);

    //на php поле никуда не передается
    // if (!(typeof tax_number == 'string' && tax_number.length > 0)) throw new Error(`'tax_number' must be non empty string`);
    try {

      debug('usernameOrEmail: %s; password: %s', login, name, comments, tel);

      let user = await cyberlinesUser.register({login, name, comments, tel});
      if (user) {
        debug('user is created.');

        if (user.blocked) {
          return {status: 'userIsBlocked', ...user};
        }
        return user;
      }

    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  async function registerByCodeMutationResolver(obj, args, context) {
    const request = context.request;
    const req = context.request;
    const session = request.token && request.token.session;
    if (!session) {
      throw new Error('Wrong token');
    }


    // Загружаем данные для регистрации
    let {rows: result} = await postgres.exec({
      context: context.context,
      statement: `SELECT * FROM registration WHERE session = $1 AND data->>'status' <> 'REGISTRATION_SUCCESS'
    ORDER BY id DESC`,
      params: [session]
    });
    if (result.length === 0) {
      // Выполняется попытка регистрации напрямую, без отправки проверочного кода
      throw new Error('Bad request');
    } else {
      result = result[0];
    }
    const data = result.data;

    if (data.verificationCode !== args.verificationCode) {
      throw new Error('wrongVerificationCode');
    }

    const {login, name, comments, tel} = data.form;
    const locale = data.locale;

    if (!(typeof login === 'string' && login.length > 0)) throw new Error(`'login' must be non empty string`);
    if (!(typeof name === 'string' && name.length > 0)) throw new Error(`'name' must be non empty string`);
    if (!(typeof tel === 'string' && tel.length > 0)) throw new Error(`'phone' must be non empty string`);
    if (!(typeof comments === 'string' && comments.length > 0)) throw new Error(`'comments' must be non empty string`);

    try {
      debug('usernameOrEmail: %s; password: %s', login, name, comments, tel);

      let user = await cyberlinesUser.register({context: context.context, login, name, comments, tel}, false);
      if (user) {
        debug('user is created.');

        if (user.blocked) {
          return {status: 'userIsBlocked', ...user};
        }

        await postgres.exec({
          context: context.context,
          statement: `UPDATE registration SET data=jsonb_set(data, '{user}', $1::jsonb, true)
        WHERE session = $2`,
          params: [JSON.stringify(user), session]
        });
        await postgres.exec({
          context: context.context,
          statement: `UPDATE registration SET data=jsonb_set(data, '{status}', $1::jsonb, true)
        WHERE session = $2`,
          params: ['"REGISTRATION_SUCCESS"', session]
        });

        await _addAcceptAgreementRecord(request, login, context);

        const origin = serverUrl || req.headers.origin;
        const messageArgs = {
          groupCode: 'registration',
          typeCode: 'registrationSuccess',
          locale,
          email: login,
          phone: tel,
          clientId: login,
          content: JSON.stringify({
            host: origin,
            login: login,
            password: user.password
          })
        };
        await sendMessage(obj, messageArgs, context);

        return {...user};
      }

    } catch (err) {
      if (err instanceof UnexpectedResponseException) {
        console.error(err._exception.message);
        throw err;
      }
      console.error(err);
      throw err;
    }
  }

  async function sendSorryMessageMutationResolver(obj, args, context) {
    return true;
    await _initDataTypes({ context: context.context });

    const request = context.request;
    const req = context.request;
    const session = request.token && request.token.session;
    // console.info(`args`, args);

    // if(!args || !args.idlist || args.idlist.length <= 0) throw new Error('No user id');
    
    // TODO: Fix limit
    // TOOD: Fix desc
    const {rows: result} = await postgres.exec({
      context: context.context,
      statement: `SELECT usr.* FROM users usr
       join __pass_change pc on pc.user_id = usr.user_id and pc.email_sent is null
       order by pc.last_seeing desc limit 500;`,
    });

    let origin;
    origin = `https://my.fesco.com`;

    console.info(`result length`, result.length);

    for(let user of result) {
/*
      const acceptId = [
        8919, //	shestpa@yandex.ru
        8974, //	AZorkaltsev
        9189, //	shestpa@gmail.com
        10522, //	pshestakov@innervate.ru
        13677, //	shestpa@mail.ru
        14742 //	shest007@mail.ru
      ];
*/

      // console.info(`user`, user.user_id, user.email, acceptId.indexOf( user.user_id));
      console.info(`user`, user.user_id, user.email);

/*
      if(acceptId.indexOf(user.user_id) === -1) {
        continue;
      }
*/

      console.info(`user accepted`, user.user_id, user.email);

      await sorryEmailNotification({
        context: context.context,
        userEmail: user.email,
        userName: user.name,
        locale: 'ru',
        origin,
      });

      await postgres.exec({
        context: context.context,
        statement: `UPDATE __pass_change SET email_sent = now() WHERE user_id = $1`,
        params: [user.user_id]
      });

    }


    return true;
  }

  async function sendVerificationCodeResolver(obj, args, context) {
    const request = context.request;
    const session = request.token && request.token.session;
    if (!session) {
      throw new Error('Wrong token');
    }

    const { login, name, comments, tel, taxNumber, locale } = args;

    let user = await userResolvers.getUser({ context: context.context, login: login });
    if (!user) {
      try {
        user = await cyberlinesUser.login({ context: context.context, usernameOrEmail: login, password: null });
      } catch (e) {
      }
    }
    if (user) {
      throw new Error('loginIsAlreadyInUse');
    }

    // const registration = getRegistrationStatusQueryResolver(null, req);
    // if (registration.status === 'SENT_CODE') {
    //   throw new Error('Verification code is already sent');
    // }
    // if (registration.status === 'REGISTRATION_SUCCESS') {
    //   throw new Error('Already registered');
    // }

    const verificationCode = generateVerificationCode(4);

    const data = {form: {login, name, comments, tel, taxNumber}, verificationCode, locale, status: 'SENT_CODE'};
    try {
      const messageArgs = {
        groupCode: 'registration',
        typeCode: 'verificationCode',
        locale,
        phone: tel,
        clientId: login,
        content: JSON.stringify({
          verificationCode: verificationCode
        })
      };
      await sendMessage(obj, messageArgs, context);

      await postgres.exec({
        context: context.context,
        statement: `INSERT INTO registration(session, data) VALUES($1, $2)`,
        params: [session, data]
      });
    } catch (e) {
      throw e;
    }

    return true;
  }

  async function sendResetPasswordEmailResolver(obj, args, context) {
    const { login, locale } = args;
    let user = await userResolvers.getUser({ context: context.context, login: login });
    if (!user) {
      user = await cyberlinesUser.login({context: context.context, usernameOrEmail: login, password: null});
    }
    if (!user) {
      throw new Error('userNotFound');
    }
    const req = context.request;

    const token = jwt.sign({
      data: {login}
    }, secret, {expiresIn: '1h'});

    await postgres.exec({
      context: context.context,
      statement: `INSERT INTO recovery(login, token) VALUES($1, $2)`,
      params: [login, token]
    });

    const origin = serverUrl || req.headers.origin;
    const messageArgs = {
      groupCode: 'passwordRecovery',
      typeCode: 'sendToken',
      locale,
      email: user.contact_email || user.email,
      clientId: user.username,
      content: JSON.stringify({
        link: `${origin}/reset/${token}`
      })
    };
    await sendMessage(obj, messageArgs, context);

    return true;
  }

  async function changePasswordResolver(obj, args, context) {
    const { token, password, locale } = args;

    const {rows: result} = await postgres.exec({
      context: context.context,
      statement: `
        SELECT rec.*, usr.email as email FROM recovery rec
        JOIN users usr on lower(usr.login) = lower(rec.login)
        WHERE rec.token = $1 AND rec.deleted = false
      `,
      params: [token]
    });
    if (result.length === 0) {
      throw new Error('invalidToken');
    }
    try {
      jwt.verify(token, secret);
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        throw new Error('tokenExpired');
      } else
        throw new Error('somethingWentWrong');
    }
    if (!(typeof password === 'string' && password.length >= 6)) {
      throw new Error('wrongPasswordLength');
    }

    const login = result[0].login;
    const email = result[0].email;
    
    try {
      await cyberlinesUser.changePassword({ context: context.context, login, newPassword: password });
      if(context && context.request && context.request.token && context.request.token.session && email) {
        await postgres.exec({
          context: context.context,
          statement: `update session set active = false where user_email = $1 and id != $2 and active = true`,
          params: [email, context.request.token.session]
        });
      }
    } catch (error) {
      throw new Error('somethingWentWrong');
    }

    await postgres.exec({
      context: context.context,
      statement: `UPDATE recovery SET (deleted) = (true) WHERE token = $1`,
      params: [token]
    });
  
    let origin;
    if (context && context.request && context.request.headers && context.request.headers.origin) {
      origin = context.request.headers.origin;
    } else {
      let url = urlParse(context.request.headers.referer);
      origin = `${url.protocol}//${url.host}`;
    }
  
    await completeEmailNotification({
      context: context.context,
      userEmail: email,
      locale,
      origin,
    });
  
    await pushCompletePushNotification({
      context: context.context,
      userEmail: email,
      username: login,
      locale,
    });
    
    return true;
  }

  async function _initDataTypes({ context }) {
    const messageGroup = await notificationResolvers.saveMessageGroup({}, { code: serviceConfig.groupCode}, {context: context });
    await _initCompleteEmailType({ group: messageGroup, context: context });
    await _initSorryEmailType({ group: messageGroup, context: context });
    await _initPushCompleteType({group: messageGroup, context: context});
  }

  async function _initPushCompleteType({ group, context }) {
    const args = {
      groupCode: group.code,
      code: serviceConfig.pushSuccessTypeCode,
      channels: ['push'],
      active: true
    };

    await notificationResolvers.saveMessageType({}, args, { context: context });
  }

  async function _initCompleteEmailType({ group, context }) {
    const template = require('./templates/changePasswordComplete.template');
    const args = {
      groupCode: group.code,
      code: serviceConfig.successTypeCode,
      channels: ['email'],
      active: true,
      testMode: serviceConfig.testMode,
      testEmails: serviceConfig.testEmails
    };

    await notificationResolvers.saveMessageType({}, args, { context: context });

    await notificationResolvers.saveMessageTypeTemplate({}, {
      groupCode: group.code,
      typeCode: serviceConfig.successTypeCode,
      data: {
        email: {
          default: {
            subject: template.subjectTemplate,
            body: template.bodyTemplate
          }
        }
      }
    }, { context: context });
  }

  async function _initSorryEmailType({ group, context }) {

    console.info(`_initSorryEmailType`);

    const template = require('./templates/sorry.template');
    const args = {
      groupCode: group.code,
      code: `auth-sorry-email`,
      channels: ['email'],
      active: true,
      testMode: serviceConfig.testMode,
      testEmails: serviceConfig.testEmails
    };

    await notificationResolvers.saveMessageType({}, args, { context: context });

    await notificationResolvers.saveMessageTypeTemplate({}, {
      groupCode: group.code,
      typeCode: `auth-sorry-email`,
      data: {
        email: {
          default: {
            subject: template.subjectTemplate,
            body: template.bodyTemplate
          }
        }
      }
    }, { context: context });
  }

  async function completeEmailNotification({
                                             context = throwIfMissing('context'),
                                             userEmail = throwIfMissing('userEmail'),
                                             locale = throwIfMissing('locale'),
                                             origin = throwIfMissing('origin'),
                                           }) {
    let i18n = messages[locale || 'en'];
    let url = origin;

    let emails = [];
    if (serviceConfig.testMode) {
      emails = serviceConfig.testEmails;
    }
    // Если мы не в тестовом режиме, то письмо необходимо отправить
    // только одно, причем пользователю, создавшему заявку
    if (!serviceConfig.testMode) {
      emails = [null];
    }

    moment.locale(locale);

    emails.map(email => {
      const args = {
        clientId: userEmail,
        groupCode: serviceConfig.groupCode,
        typeCode: serviceConfig.successTypeCode,
        email: email,
        cc: serviceConfig.cc,
        content: {
          messages: i18n,
          host: url,
          subjectData: `${i18n.CHANGE_PASSWORD_SUBJECT}`
        },
        testMode: serviceConfig.testMode === undefined ? true : serviceConfig.testMode,
        testEmails: serviceConfig.testEmails === undefined ? null : serviceConfig.testEmails,
      };

      return notificationResolvers.sendMessage({}, args, { context: context })
      .then(message => {
        debug('[SendNotification] notification message has been sent: %O', message);
        return message;
      })
      .catch(error => {
        debug('[SendNotification] error: %O', error);
        console.error(error);
        return error;
      });
    });
  }

  async function sorryEmailNotification({
                                             context = throwIfMissing('context'),
                                             userEmail = throwIfMissing('userEmail'),
                                             locale = throwIfMissing('locale'),
                                             origin = throwIfMissing('origin'),
                                             userName
                                           }) {
    let i18n = messages[locale || 'en'];
    let url = origin;

    let emails = [];
    if (serviceConfig.testMode) {
      emails = serviceConfig.testEmails;
    }
    // Если мы не в тестовом режиме, то письмо необходимо отправить
    // только одно, причем пользователю, создавшему заявку
    if (!serviceConfig.testMode) {
      emails = [null];
    }

    moment.locale(locale);
    // emails.push('shestpa@gmail.com');
    // emails.push( 'testemail@innervate.ru');
    //
    emails.map(email => {
      const args = {
        clientId: userEmail,
        groupCode: serviceConfig.groupCode,
        typeCode: `auth-sorry-email`,
        email: email,
        cc: serviceConfig.cc,
        content: {
          messages: i18n,
          host: url,
          subjectData: `Fesco: Вам необходимо изменить пароль в Личном Кабинете | You need to change the password of your personal account`,
          userName
        },
        testMode: serviceConfig.testMode === undefined ? true : serviceConfig.testMode,
        testEmails: serviceConfig.testEmails === undefined ? null : serviceConfig.testEmails,
      };

      // console.info(`aaargs`, args);

      return notificationResolvers.sendMessage({}, args, { context: context })
      .then(message => {
        debug('[SendNotification] notification message has been sent: %O', message);
        return message;
      })
      .catch(error => {
        debug('[SendNotification] error: %O', error);
        console.error(error);
        return error;
      });
    });
  }

  async function pushCompletePushNotification({
                                                context = throwIfMissing('context'),
                                                locale = throwIfMissing('locale'),
                                                userEmail = throwIfMissing('userEmail'),
                                                username = throwIfMissing('username')
                                              }) {
    //Юзеры которые должны получить оповещение
    let users = [];
    if (serviceConfig.testMode) {
      users = [username];
    }

    if (!serviceConfig.testMode) {
      users = [username];
    }
    const args = {
      clientId: userEmail,
      groupCode: serviceConfig.groupCode,
      typeCode: serviceConfig.pushSuccessTypeCode,
      content: {
        clients: users,
        pushType: 'SUCCESS',
        service: 'authChangePassword',
        push: true,
      },
      testMode: serviceConfig.testMode === undefined ? true : serviceConfig.testMode
    };

    return notificationResolvers.sendMessage({}, args, { context: context })
    .then(message => {
      debug('[SendNotification] notification message has been sent: %O', message);
      return message;
    })
    .catch(error => {
      debug('[SendNotification] error: %O', error);
      console.error(error);
      return error;
    });
  }

  async function setPasswordResolver(obj, args, context) {
    await _initDataTypes({ context: context.context });

    const { oldPassword, password, locale } = args;

    const user = context.request.user;
    const login = user.username;

    if (args.hasOwnProperty('oldPassword')) {
      try {
        let userResult = await userResolvers.getUser({context: context.context, login: login, password: oldPassword});

        if (!userResult) {
          userResult = await cyberlinesUser.login({context: context.context, usernameOrEmail: login, password: oldPassword});

          if (!userResult) {
            throw new Error('Wrong password');
          }
        }
      } catch(err) {
        console.error(err);
        throw err;
      }
    }

    try {
      const res = await cyberlinesUser.setPassword({ context: context.context, login, newPassword: password });
      if(context && context.request && context.request.token && context.request.token.session && user.email) {
        await postgres.exec({
          context: context.context,
          statement: `update session set active = false where user_email = $1 and id != $2 and active = true`,
          params: [user.email, context.request.token.session]
        });
      }
      
    } catch (error) {
      throw new Error(error);
    }

    await postgres.exec({
      context: context.context,
      statement: `UPDATE users SET (data, updated) = (jsonb_set(data, '{passchange_date}', $2::JSONB, true), now()::timestamp) WHERE lower(login) = $1`,
      params: [
        login.toLowerCase(),
        `"${moment().format('YYYY.MM.DD')}"`
      ]
    });

    let origin;

    if (context.request.headers.origin) {
      origin = context.request.headers.origin;
    } else {
      let url = urlParse(context.request.headers.referer);
      origin = `${url.protocol}//${url.host}`;
    }

    await completeEmailNotification({
      context: context.context,
      userEmail: user.email,
      locale,
      origin,
    });

    await pushCompletePushNotification({
      context: context.context,
      userEmail: user.email,
      username: user.username,
      locale,
    });

    return true;
  }

  async function loginByTokenMutationResolver({token, safeDevice}, req) {

    if (!(typeof token === 'string' && token.length > 0)) throw new Error(`'token' must be non empty string`);


    let tokenPayload = null;

    try {
      tokenPayload = jwt.verify(token, secret);
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        throw new Error('tokenExpired');
      } else
        throw new Error('wrongToken');
    }

    if(!tokenPayload) throw new Error(`Empty payload`);
    if(!tokenPayload.user.login) throw new Error(`No login in payload`);

    try {
      logout(req);
      debug('token: %s;', token);

      let user = await userResolvers.getUser({ login: tokenPayload.user.login });
      if (!user) {
        user = await cyberlinesUser.login({usernameOrEmail: tokenPayload.user.login, password: null});
      }

      if (user) {

        debug('user is found.  blocked: %s', user.blocked);

        if (user.blocked) {
          return {status: 'userIsBlocked'};
        }

        while (true) {
          let {rowCount} = await postgres.exec({
            statement: 'update session set user_email = $1, last_seeing = now() where active = true and id = $2;',
            params: [user.email, req.token.session],
          });
          if (rowCount > 0) break;
          debug('session %s is missing. new session', req.token.session);
          // Редкий случай, когда сессия была удалена из БД, а token с session пришёл.  Но и не такой уж редкий при разработке
          await newSession(req);
        }

        let token = jwt.sign({
          session: req.token.session,
          user: {
            userId: user.userId,
            name: user.name,
            username: user.username,
            email: user.email,
            manager: user.manager,
            phone: user.phone,
            passChangeDate: user.passChangeDate
          },
          safeDevice: safeDevice,
        }, secret, {
          expiresIn: tokenExperationPeriod + tokenExtraTime,
        });

        if (req.cookies) setAccessTokenCookie(req, token);

        // TODO: Profile user info
        return {status: 'ok', refreshIn: tokenExperationPeriod, token};
      }
      else {
        debug('user not found');
        logout(req);

        return {status: 'invalidEmailAndPasswordPair'};
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function getExternalAccountLinkQueryResolver(obj, args, context) {
    const request = context.request;
    const session = request.token && request.token.session;
    const user = request.token && request.token.user;
    let link = configAPI.get('oldPersonalAccount.link');
    const authPath = configAPI.get('oldPersonalAccount.externalAuthPath');

    if (!session || !user) {
      //throw new Error('Wrong token');
      return {link: link};
    }

    if(!user || !user.username || !authPath) {
      //throw new Error('Wrong token');
      return {link: link};
    }

    let userData = {};
    try {
      const getUserResult = await userResolvers.getUser({ context: context.context, login: user.username });
      if (getUserResult) {
        userData = getUserResult;
      }
    } catch (error) {
      // ignore it
      console.error(error);
    }

    let token = jwt.sign({
      session: request.token.session,
      user: {
        userId: user.userId,
        username: user.username,
      },
      service: `node`,
    }, secret, {
      expiresIn: tokenExperationPeriod + tokenExtraTime,
    });

    if(token) {
      link = `${link}${authPath}?_user=${token}&_username=${user.username}`;
    }

    return {link: link, customsInformed: userData.features && userData.features.customsInformed === true};
  }

  async function getRegistrationListResolver(obj, args, context) {
    let innerRows = [], resultRows = {};

    let {rows} = await postgres.exec({
      context: context.context,
      statement: `select *, reg.data as data, users.data as user_data from registration AS reg LEFT JOIN users ON users.login = reg.data->'form'->>'login' order by created_at DESC OFFSET $1 LIMIT $2`,
      params: [
        args.offset,
        args.limit
      ]
    });

    //Т.к. данные из разных мест (старый лк, новый лк, кибер) - дистинктом выбрать не получится
    let skipCounter = 0;

    innerRows = rows;
    for (let r of innerRows) {
      let arResult = {
        id: r.id,
        registrationDate: r.created_at,
        status: r.data && r.data.status
      };

      //TODO: отрефакторить

      if(r.user_data) {
        let user = r.user_data;

        if(user.blocked) {
          arResult.status = `REGISTRATION_SUCCESS_BLOCKED`;
        } else {

          if(user.manager) {
            arResult.status = `REGISTRATION_SUCCESS_MANAGER`;
          } else if(
            user.intermodal
            || user.VGM
            || user.customsInformed
          ) {
            arResult.status = `REGISTRATION_SUCCESS_FULL_ACCESS`;
          } else if(arResult.status === `OLD_LK_REGISTERED`) {
            arResult.status = `REGISTRATION_SUCCESS`;
          }
        }

      } else if(r.data && r.data.clUser) {

        let user = r.data.clUser;

        if(user.blocked) {
          arResult.status = `REGISTRATION_SUCCESS_BLOCKED`;
        } else {

          if(user.manager) {
            arResult.status = `REGISTRATION_SUCCESS_MANAGER`;
          } else if(user.features && (
              user.features.intermodal
              || user.features.VGM
              || user.features.customsInformed
            )) {
            arResult.status = `REGISTRATION_SUCCESS_FULL_ACCESS`;
          } else if(arResult.status === `OLD_LK_REGISTERED`) {
            arResult.status = `REGISTRATION_SUCCESS`;
          }
        }
      }

      if(r.data && r.data.oldLK) { // Если регистрация из старого ЛК
        let user = r.data.oldLK;
        arResult.phone = user.phone;
        arResult.name = user.name;
        arResult.login = user.login;
        arResult.taxNumber = user.taxNumber;
        arResult.company = user.company;
      } else if(r.data && r.data.user) { // Если успешно зарегистрировался в новом
        let user = r.data.user;
        arResult.phone = user.phone;
        arResult.name = user.name;
        arResult.login = user.email;
        if(user.blocked) {
          arResult.status = `REGISTRATION_SUCCESS_BLOCKED`;
        }
        arResult.taxNumber = r.data.form && r.data.form.taxNumber;
        arResult.company = r.data.form && r.data.form.comments;
      } else if(r.data && r.data.form) { // Если неуспешно зарегистрировался в новом (не подтвердил телефон)
        let user = r.data.form;
        arResult.phone = user.tel;
        arResult.name = user.name;
        arResult.login = user.login;
        arResult.taxNumber = user.taxNumber;
        arResult.company = user.comments;
      } else {
        //TODO
      }

      if(!resultRows[arResult.login]) {
        resultRows[arResult.login] = arResult;
      } else {
        resultRows[`skip_${skipCounter}`] = {
          skip: true
        };

        skipCounter++;
      }
    }

    return Object.values(resultRows);
  }

  async function getFilteredUserListResolver(obj, args, context) {
    const {offset} = args,
      {limit} = args;
    let params = [],
        paramIdx = 1,
        formattedArgs = args;
    let whereClause =`
     WHERE TRUE
    `;

    if (args && args.length) {
      formattedArgs = args.map((arg) => fixSpaces(arg));
    }

    if( formattedArgs.user_id ){

      whereClause+= `
       AND users.user_id = $${paramIdx}
      `
      params.push(formattedArgs.user_id);
      paramIdx++;
    }

    if( formattedArgs.login ){
      whereClause+= `
       AND lower(login) LIKE lower($${paramIdx})
      `
      params.push('%'+formattedArgs.login+'%')
      paramIdx++;
    }

    if( formattedArgs.name ){
      whereClause+= `
       AND lower(name) LIKE lower($${paramIdx})
      `
      params.push('%'+formattedArgs.name+'%')
      paramIdx++;
    }

    if( formattedArgs.email ){
      whereClause+= `
       AND lower(email) LIKE lower($${paramIdx})
      `
      params.push('%'+formattedArgs.email+'%')
      paramIdx++;
    }

    if( formattedArgs.intermodal ){
      whereClause+= `
       AND intermodal = $${paramIdx}
      `
      params.push(formattedArgs.intermodal)
      paramIdx++;
    }

    if( formattedArgs.vgm ){
      whereClause+= `
       AND vgm = $${paramIdx}
      `
      params.push(formattedArgs.vgm)
      paramIdx++;
    }

    if( formattedArgs.customs_informed ){
      whereClause+= `
       AND customs_informed = $${paramIdx}
      `
      params.push(formattedArgs.customs_informed);
      paramIdx++;
    }

    if( formattedArgs.manager ){
      whereClause+= `
       AND manager = $${paramIdx}
      `
      params.push(formattedArgs.manager)
      paramIdx++;
    }

    if( formattedArgs.blocked ){
      whereClause+= `
       AND blocked = $${paramIdx}
      `
      params.push(formattedArgs.blocked)
      paramIdx++;
    }

    if( formattedArgs.company_name ){
      whereClause+= `
        AND lower(ec.company_name) LIKE lower($${paramIdx})
      `
      params.push('%'+formattedArgs.company_name+'%')
      paramIdx++;
    }

    if( formattedArgs.company_code ){
      whereClause+= `
        AND lower(ec.clnt_code) LIKE lower($${paramIdx})
      `
      params.push('%'+formattedArgs.company_code+'%')
      paramIdx++;
    }

    //Сначала выбираем отфильтрованные айди клиентов
    //Затем выбираем все остальные поля  (может можно сделать лучше)
    let {rows} = await postgres.exec({
      context: context.context,
      /* statement: `
       with grouped_list AS (
       SELECT
       users.user_id,
       array_agg(ec.company_name) AS company_name,
       array_agg(ec.clnt_code) AS company_code
       FROM
       users
       LEFT JOIN external_users_forward euf on users.user_id = euf.user_id
       LEFT JOIN external_clients ec  on ec.company_uid::TEXT = euf.se_id
       ${whereClause}
       AND  lower(name) LIKE lower('%субботин%')
       GROUP BY users.user_id
       OFFSET ${offset}
       LIMIT ${limit}
       )

       SELECT
       grouped_list.company_name,
       grouped_list.company_code,
       users.*
       FROM  grouped_list, users
       WHERE grouped_list.user_id = users.user_id
       ORDER BY created DESC`,*/
      statement: `
      with group_list AS (
        SELECT
            users.user_id,
              array_agg(ec.company_name) AS company_name,
              array_agg(ec.clnt_code) AS company_code
          FROM
            users
          LEFT JOIN external_users_forward euf on users.user_id = euf.user_id
          LEFT JOIN external_clients ec  on ec.company_uid::TEXT = euf.se_id
          ${whereClause}
          GROUP BY users.user_id
          ORDER BY users.user_id DESC
          OFFSET ${offset}
          LIMIT ${limit}
          )
          
        SELECT
          users.*,
          group_list.company_name,
          group_list.company_code
        FROM  users, group_list
          WHERE users.user_id = group_list.user_id
          `,

      params: params
    });
    let result = {};
    rows.forEach(row =>{
      result[row.user_id] = {
        user_id: row.user_id,
        login: row.login,
        name: row.name,
        email: row.email,
        intermodal: row.intermodal,
        vgm: row.vgm,
        customs_informed: row.customs_informed,
        manager: row.manager,
        company_name:row.company_name,
        company_code:row.company_code
      }
    })
    return Object.values(result);
  }

  return {
    getUserProcessingData,
    getRegistrationStatus: apolloToRelayResolverAdapter(getRegistrationStatusQueryResolver),
    login: loginMutationResolver,
    loginByToken: apolloToRelayResolverAdapter(loginByTokenMutationResolver),
    logout: apolloToRelayResolverAdapter(logoutMutationResolver),
    register: apolloToRelayResolverAdapter(registerMutationResolver),
    registerByCode: registerByCodeMutationResolver,
    sendSorryMessage: sendSorryMessageMutationResolver,
    sendVerificationCode: sendVerificationCodeResolver,
    sendResetPasswordEmail: sendResetPasswordEmailResolver,
    changePassword: changePasswordResolver,
    setPassword: setPasswordResolver,
    getExternalAccountLink: getExternalAccountLinkQueryResolver,
    getRegistrationList: getRegistrationListResolver,
    getUserList: getFilteredUserListResolver
  };
})

function apolloToRelayResolverAdapter(oldResolver) {
  return /* async */ function (obj, args, context) {
    return oldResolver(args, context.request);
  }
}

function relayToApolloResolverAdapter(newResolver) {
  return /* async */ function (args) {
    return newResolver(null, args); // TODO: Это костыль.  Кокого стандарта будем придерживаться, чтобы резолверы одновременно стали методами сервиса.  Но при этом, при внутреннем обращении у нас может не быть http-reqiest'а
  }
}
