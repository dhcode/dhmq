/* Created by Dominik Herbst on 2016-02-10 */
'use strict';
const util = require('util');
const log = require('dhlog').forModule(module);
const SocketIOServer = require('socket.io');
const https = require('https');
const http = require('http');
const DHMQServerClient = require('./dhmqServerClient');
const MQManager = require('./mqManager');
const AuthProvider = require('./authProvider');

/**
 * Listen for new connections on an interface and spawn
 * ServerClients to handle the connected sockets
 * @param config
 * port
 * host
 * key
 * cert
 * secure
 * managerInstance
 * managerProperties
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

        this.authProvider = new AuthProvider(this._config.authProvider);

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

    _disconnectClients() {
        Object.keys(this.ioServer.sockets.connected).forEach((socketId) => {
            const socket = this.ioServer.sockets.connected[socketId];
            socket.disconnect();
        });
    }

    start() {
        return MQManager.getInstance(this._config.managerInstance, this._config.managerProperties).then((manager) => {
            this.mqManager = manager;
            return this._listen();
        });
    }

    stop() {
        const stops = [];
        stops.push(this._close());
        if (this.mqManager) {
            stops.push(this.mqManager.shutdown(this._config.maxWaitForShutdown).then(() => this._disconnectClients()));
        }

        return Promise.all(stops).then(() => {
            log.info('Server stopped');
        });
    }
}

module.exports = DHMQServer;
