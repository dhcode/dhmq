/* Created by Dominik Herbst on 2016-12-18 */

const config = require('./lib/config');
const DHMQServer = require('./lib/dhmqServer');
const log = require('dhlog').forModule(module);

const server = new DHMQServer(config.server);

if(!module.parent) {
    server.start();

    let askedToStop = false;
    const stopServer = () => {
        if(askedToStop) {
            process.exit(1);
        }
        askedToStop = true;
        server.stop().then(() => {
            process.exit(0);
        }).catch(() => {
            process.exit(1);
        });
    };


    process.on('SIGINT', () => {
        log.info('Received SIGINT, will shutdown');
        stopServer();
    });
    process.on('SIGTERM', () => {
        log.info('Received SIGTERM, will shutdown');
        stopServer();
    });

}

