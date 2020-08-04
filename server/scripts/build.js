import path from 'path'
import {promisify} from 'util'
import cmd from 'commander'
import {parallel, runTasks, serial, spawn, Task} from '../src/common/build'

import 'coffeescript/register'

const copy = promisify(require('copy'));
const rimraf = promisify(require('rimraf'));

cmd
  .name(`node scripts/build.js`)
  .option(`-d, --dev`, `development mode`)
  .option(`-n, --nostart`, `no start 'quasar dev' and 'npm start' in development mode`)
  .option(`-nr, --norestart`, `no restart in development mode`)
  .parse(process.argv);

let quasarDevRunning, npmStartRunning;

runTasks({

  watch: cmd.dev,

  // delay: 1000,

  tasks:
    serial([
      !cmd.dev && new Task({
        name: `quasar build`,
        run() {
          return spawn('node', [path.resolve(process.cwd(), '../client/node_modules/@quasar/cli/bin/quasar'), 'build'], {
            cwd: path.resolve(process.cwd(), '../client'),
            env: {
              SERVER_API_AUTH_TOKEN_EXTRA_TIME: 300,
              REST_API: 'https://localhost/api',
              GRAPHQL_API: 'https://localhost/api/graphql',
            }
          });
        },
      }),
      cmd.dev && !cmd.nostart && parallel([
        new Task({
          name: `npm start`,
          async run() {
            if (quasarDevRunning) return;
            const go = () => {
              quasarDevRunning = true;
              spawn('node', [
                  path.resolve(process.cwd(), 'node_modules/nodemon/bin/nodemon.js'),
                  '-e', 'sql', '--watch', './db/evolutions', '--delay', '250ms',
                  path.resolve(process.cwd(), 'scripts/babel.js'),
                  path.resolve(process.cwd(), 'src/index.js')
                ],
                {
                  shell: true,
                  detached: true,
                })
                .then(() => {
                  if (cmd.norestart) quasarDevRunning = false;
                  else go();
                }, () => {
                  if (cmd.norestart) quasarDevRunning = false;
                  else go();
                });
            };
            go();
          },
        }),
        new Task({
          name: `quasar dev`,
          async run() {
            if (npmStartRunning) return;
            const go = () => {
              npmStartRunning = true;
              spawn('node', [
                  path.resolve(process.cwd(), '../client/node_modules/@quasar/cli/bin/quasar'),
                  'dev'
                ],
                {
                  cwd: path.resolve(process.cwd(), '../client'),
                  shell: true,
                  detached: true,
                })
                .then(() => {
                  if (cmd.norestart) npmStartRunning = false;
                  else go();
                }, () => {
                  if (cmd.norestart) npmStartRunning = false;
                  else go();
                });
            };
            go();
          },
        }),
      ]),
    ]),
});
