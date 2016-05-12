/* Created by Dominik Herbst on 2016-02-12 */
'use strict';

const log = require('dhlog')('DHMQServerClient');
const config = require('./config');
const AuthProvider = require('./authProvider');

const authProvider = new AuthProvider(config.authProvider);

/**
 * Handles all the requests from one connected client
 */
class DHMQServerClient {

	/**
	 *
	 * @param {DHMQServer} server
	 * @param {Socket} client
	 */
	constructor(server, client) {

		/**
		 * @type {DHMQServer}
		 */
		this.server = server;

		/**
		 * @type {Socket}
		 */
		this.io = client;

		/**
		 * @type {string}
		 */
		this.state = 'init'; // init, authRequested, authFailed, ready, disconnected


		this.initEvents();
	}

	initEvents() {

		this._bindCommand('auth', this.auth);
		this._bindCommand('registerWorker', this.registerWorker);
		this._bindCommand('removeWorker', this.removeWorker);
		this._bindCommand('getStats', this.getStats);
		this._bindCommand('pushTask', this.pushTask);
		this._bindCommand('getTaskInfo', this.getTaskInfo);

		this.io.on('disconnect', () => {
			this._setStateDisconnected();
		});

		this.io.on('error', (err) => {
			log.error('client', err);
		});

	}

	_bindCommand(name, handler) {
		this.io.on(name, (data, respond) => {
			log.debug('received '+name);
			handler.call(this, data, respond);
		});
	}

	_setStateAuthRequested() {
		this.state = 'authRequested';
	}

	_setStateAuthFailed() {
		this.state = 'authFailed';
	}

	_setStateReady() {
		this.state = 'ready';
	}

	_setStateDisconnected() {
		this.state = 'disconnected';
	}

	_getAuthProvider() {
		return authProvider;
	}

	auth(data, respond) {
		this._setStateAuthRequested();
		if (!data) {
			this._setStateAuthFailed();
			return respond({error: 'invalid_input'});
		}
		this._getAuthProvider().identify(data.userId, data.key, (response) => {
			if (response.success) {
				this._setStateReady();

			} else {
				this._setStateAuthFailed();
			}

			respond(response);
		});
	}

	registerWorker(data, respond) {

	}

	removeWorker(data, respond) {

	}

	getStats(data, respond) {

	}

	pushTask(data, respond) {

	}

	getTaskInfo(data, respond) {

	}

}

module.exports = DHMQServerClient;

