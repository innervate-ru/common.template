import {oncePerServices} from './common/services'
import {makeExecutableSchema} from 'graphql-tools'
import {SchemaBuilder, LevelBuilder} from './common/graphql'
import {missingArgument, invalidArgument} from './common/utils/arguments'
import configAPI from "config";

export default oncePerServices(function (services = missingArgument('services')) {

  const {
    bus
  } = services;

  return async function() {

    const typeDefs = [];
    const resolvers = Object.create(null);

    require('./common/graphql/addCustomTypes').default(typeDefs, resolvers);

    const stat = await (new SchemaBuilder({
      monitoring: configAPI.get('monitoring.graphql') ? require('./common/monitoring/graphql').default(services) : null,
      auth: require('./services/auth/graphql').default(services),
    }).build({bus, typeDefs, resolvers}));

    // console.info(`graphql timings:`, stat);

    // DEBUG: Записывает схему в директорию /temp
    // const tempDir = require('path').join(process.cwd(), './temp')
    // await require('./common/utils/ensureDir').default(tempDir);
    // require('fs').writeFileSync(require('path').join(tempDir, 'v2.gql'), typeDefs.join('\n'));

    return makeExecutableSchema({
      typeDefs,
      resolvers,
    })
  }
});

