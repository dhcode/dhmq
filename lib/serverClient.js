/* Created by Dominik Herbst on 2016-02-12 */
'use strict';

const log = require('dhlog')('DHMQServerClient');
const config = require('./config');
const func = require('./func');
const AuthProvider = require('./authProvider');
const authProvider = new AuthProvider(config.authProvider);

const MQWorker = require('./mqWorker');
const MQManager = require('./mqManager');
const MQTask = require('./mqTask');

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

		this.mqManager = MQManager.getInstance();

		this.initEvents();
	}

	initEvents() {

		this._bindRequest('auth', this.auth);
		this._bindRequest('registerWorker', this.registerWorker);
		this._bindRequest('removeWorker', this.removeWorker);
		this._bindRequest('getStats', this.getStats);
		this._bindRequest('addTask', this.addTask);
		this._bindRequest('abortTask', this.abortTask);
		this._bindRequest('getTaskInfo', this.getTaskInfo);

		this.io.on('disconnect', () => {
			this.mqManager.removeWorkersByClient(this);
			this._setStateDisconnected();
		});

		this.io.on('error', (err) => {
			log.error('client', err);
		});

	}

	_bindRequest(name, handler) {
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
		if(!data) {
			return respond({error: 'invalid_input'});
		}
		if(!data.match) {
			return respond({error: 'invalid_match'});
		}
		var matcher = new RegExp(data.match);

		var workerId = 'W'+func.randomString(11);

		var worker = new MQWorker(this, workerId, matcher);
		this.mqManager.registerWorker(worker);

		respond({
			success: true,
			workerId: worker.id
		});
	}

	removeWorker(data, respond) {

	}

	getStats(data, respond) {

	}

	addTask(data, respond) {
		if(!data) {
			return respond({error: 'invalid_input'});
		}
		if(!data.taskId) {
			return respond({error: 'invalid_taskId'});
		}
		if(!data.type) {
			return respond({error: 'invalid_type'});
		}
		if(!data.data) {
			return respond({error: 'invalid_data'});
		}

		var task = new MQTask(data.type, data.taskId);
		var result = this.mqManager.addTask(task);
		respond(result);

	}

	abortTask(data, respond) {

	}

	getTaskInfo(data, respond) {

	}

}

module.exports = DHMQServerClient;

