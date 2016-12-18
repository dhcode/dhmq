/* Created by Dominik Herbst on 2016-02-10 */
'use strict';
const util = require('util');
const log = require('dhlog').forModule(module);
const SocketIOServer = require('socket.io');
const https = require('https');
const http = require('http');
const DHMQServerClient = require('./serverClient');
const MQManager = require('./mqManager');

/**
 * Listen for new connections on an interface and spawn
 * ServerClients to handle the connected sockets
 * @param config
 * port
 * host
 * key
 * cert
 */
class DHMQServer {
    constructor(config) {
        this._config = config;

        if (config.secure) {
            this.httpServer = https.createServer(config);
        } else {
            this.httpServer = http.createServer();
        }

        this.mqManager = null;

        this.ioServer = new SocketIOServer(this.httpServer, this._config);

        this.initEvents();
    }

    initEvents() {
        this.ioServer.on('connection', (socket) => {
            log.info('Connection from ' + socket.id);
            new DHMQServerClient(this, socket);
        });
    }

    _listen() {
        return new Promise((resolve, reject) => {
            this.httpServer.listen(this._config.port, this._config.host, (err) => {
                err ? reject(err) : resolve(this);
            });
        }).then(() => {
            log.info('listening on ' + this._config.host + ':' + this._config.port);
        });
    }

    _close() {
        return new Promise((resolve, reject) => {
            log.info('closing server');
            this.httpServer.close((err) => {
                err ? reject(err) : resolve(this);
            });
        });
    }

    start() {
        return MQManager.getInstance().then((manager) => {
            this.mqManager = manager;
            return this._listen();
        });
    }

    stop() {
        return this._close().then(() => {
            log.info('Server closed');
            if(this.mqManager) {
                return this.mqManager.shutdown();
            } else {
                return Promise.resolve();
            }
        });
    }
}

module.exports = DHMQServer;
