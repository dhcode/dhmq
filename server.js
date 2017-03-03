#! /usr/bin/env node
/* Created by Dominik Herbst on 2016-12-18 */

const DHMQServer = require('./lib/dhmqServer');
const log = require('dhlog').forModule(module);



exports.runServer = function (config) {
    const server = new DHMQServer(config);
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
};

if(!module.parent) {
    const config = require('./lib/config');
    exports.runServer(config.server);
}

