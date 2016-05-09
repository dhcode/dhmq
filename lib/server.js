/* Created by Dominik Herbst on 2016-02-10 */
'use strict';
const util = require('util');
const log = require('dhlog')('DHMQServer');
const SocketIOServer = require('socket.io');
const https = require('https');
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
		this.httpServer = https.createServer(this.config);

		this.ioServer = new SocketIOServer(this.httpServer, this.config);

		this.initEvents();
	}

	initEvents() {
		this.ioServer.on('connection', (socket) => {
			new DHMQServerClient(socket, this);
		});
	}

	start(callb) {
		log.info('starting server');
		this.httpServer.listen(this.config.port, this.config.host, callb);

	}

	stop(callb) {
		this.httpServer.close(callb);
	}
}

module.exports = DHMQServer;
