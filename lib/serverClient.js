/* Created by Dominik Herbst on 2016-02-12 */
'use strict';

const log = require('dhlog').forModule(module);
const config = require('./config');
const func = require('./func');
const AuthProvider = require('./authProvider');
const authProvider = new AuthProvider(config.authProvider);

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

        this._workers = func.advancedArray();

		this._initEvents();
	}

	_initEvents() {

		this._bindRequest('auth', this.auth);
		this._bindRequest('registerWorker', this.registerWorker);
		this._bindRequest('removeWorker', this.removeWorker);
		this._bindRequest('getStats', this.getStats);
		this._bindRequest('addTask', this.addTask);
		this._bindRequest('abortTask', this.abortTask);
		this._bindRequest('getTaskInfo', this.getTaskInfo);

		this.io.on('disconnect', () => {
			this._removeWorkers();
			this._setStateDisconnected();
		});

		this.io.on('error', (err) => {
            // TODO handle error
			log.error('client', err);
		});

	}

	_removeWorkers() {
        for (let i = 0; i < this._workers.length; i++) {
            const w = this._workers[i];
            this.mqManager.removeWorkerById(w.id);
            this._workers.splice(i--, 1);
        }
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
		const matcher = new RegExp(data.match);
		const worker = this._createWorker(matcher);

		this.mqManager.registerWorker(worker);

		respond({
			success: true,
			workerId: worker.id
		});
	}

	removeWorker(data, respond) {
        if(!data) {
            return respond({error: 'invalid_input'});
        }
        if(!data.workerId) {
            return respond({error: 'invalid_workerId'});
        }

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

		var task = this.mqManager.createTask(data.type, data.taskId);
        task.data = data.data;

		var result = this.mqManager.addTask(task);
		respond(result);

	}

	abortTask(data, respond) {

	}

	getTaskInfo(data, respond) {

	}

	_createWorker(matcher) {

        const worker = this.mqManager.createWorker((task) => {
            const data = {
                task: task
            };
            this.io.in(worker.id).emit('startTask', data);

        }, (task) => {
            const data = {
                taskId: task.id
            };
            this.io.in(worker.id).emit('abortTask', data);

        });
        worker.matcher = matcher;
        this.io.join(worker.id);

        this._workers.push(worker);


        // Input from the client
        this.io.in(worker.id).on('finishedTask', (data) => {
            // TODO validate input
            this.mqManager.finishTask(data.taskId, data.result);
        });
        this.io.in(worker.id).on('updateTask', (data) => {
            // TODO validate input
            this.mqManager.updateTask(data.taskId, data.result);
        });
        this.io.in(worker.id).on('returnTask', (data) => {
            // TODO validate input
            this.mqManager.returnTask(data.taskId);
        });

        return worker;
    }

}

module.exports = DHMQServerClient;

