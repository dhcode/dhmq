/* Created by Dominik Herbst on 2016-04-30 */
'use strict';

const EventEmitter = require('events');
const log = require('dhlog')('DHMQClient');
const SocketIOClient = require('socket.io-client');

class DHMQClient extends EventEmitter {
	constructor(config) {
		super();
		this.config = config;
		this.ioServer = new SocketIOClient(this.config.url, this.config);

		this.initEvents();
	}

	initEvents() {
		this.ioServer.on('connect', () => {
			this.emit('connect');
		});
		this.ioServer.on('disconnect', () => {
			this.emit('disconnect');
		});
	}
	
}

module.exports = DHMQClient;
