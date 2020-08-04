require('@babel/polyfill');
require('@babel/register');
require(require('path').resolve(process.cwd(), process.argv[2]));
