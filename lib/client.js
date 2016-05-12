/* Created by Dominik Herbst on 2016-04-30 */
'use strict';

const EventEmitter = require('events');
const log = require('dhlog')('DHMQClient');
const SocketIoClient = require('socket.io-client');

class DHMQClient extends EventEmitter {
	constructor(config) {
		super();
		this.config = config;
		this.io = new SocketIoClient(this.config.url, this.config);

		this.initEvents();
	}

	initEvents() {
		this.io.on('connect', () => {
			log.debug('connect');
			this.emit('connect');
		});
		this.io.on('connect_error', (err) => {
			log.debug('connect_error', err);
			this.emit('connect_error', err);
		});
		this.io.on('connect_timeout', (err) => {
			log.debug('connect_timeout', err);
			this.emit('connect_timeout', err);
		});
		this.io.on('disconnect', () => {
			this.emit('disconnect');
		});
	}
	
	authenticate(callb) {
		this.io.emit('auth',{
			userId: this.config.userId,
			key: this.config.key
		},(response) => {
			callb(response);
		});
	}
	
}

module.exports = DHMQClient;
