/* Created by Dominik Herbst on 2016-02-10 */
'use strict';
const util = require('util');
const log = require('dhlog').forModule(module);
const SocketIOServer = require('socket.io');
const https = require('https');
const http = require('http');
const EventEmitter = require('events');
const DHMQServerClient = require('./serverClient');

/**
 * Listen for new connections on an interface and spawn
 * ServerClients to handle the connected sockets
 * @param config
 * port
 * host
 * key
 * cert
 */
class DHMQServer extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        if (this.config.secure) {
            this.httpServer = https.createServer(this.config);
        } else {
            this.httpServer = http.createServer();
        }


        this.ioServer = new SocketIOServer(this.httpServer, this.config);

        this.initEvents();
    }

    initEvents() {
        this.ioServer.on('connection', (socket) => {
            log.info('Connection from ' + socket.id);
            new DHMQServerClient(this, socket);
        });
    }

    start() {
        return new Promise((resolve, reject) => {
            log.info('starting server');
            this.httpServer.listen(this.config.port, this.config.host, (err) => {
                err ? reject(err) : resolve(this);
            });
        });
    }

    stop() {
        return new Promise((resolve, reject) => {
            this.httpServer.close((err) => {
                err ? reject(err) : resolve(this);
            });
        });
    }
}

module.exports = DHMQServer;
