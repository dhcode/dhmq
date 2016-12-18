/* Created by Dominik Herbst on 2016-02-12 */
'use strict';

const log = require('dhlog').forModule(module);
const config = require('./config');
const func = require('./func');
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

        /**
         * @type {MQManager}
         */
		this.mqManager = server.mqManager;

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

		this._bindEvent('workerFinishedTask', this.workerFinishedTask);
		this._bindEvent('workerUpdatedTask', this.workerUpdatedTask);
		this._bindEvent('workerReturnedTask', this.workerReturnedTask);

		this.io.on('disconnect', () => {
			this._removeWorkers();
			this._setStateDisconnected();
			log.info(`client ${this.io.id} disconnected`);
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

    _bindEvent(name, handler) {
        this.io.on(name, (data) => {
            log.debug('received '+name);
            handler.call(this, data);
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
			return respond({error: 'invalidInput'});
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
			return respond({error: 'invalidInput'});
		}
		if(!data.typeMatcher) {
			return respond({error: 'invalidTypeMatcher'});
		}
		const typeMatcher = new RegExp(data.typeMatcher);
        const idMatcher = new RegExp(data.idMatcher||undefined);

		const worker = this._createWorker(typeMatcher, idMatcher);

		this.mqManager.registerWorker(worker);

		respond({
			success: true,
			workerId: worker.id
		});
	}

	removeWorker(data, respond) {
        if(!data) {
            return respond({error: 'invalidInput'});
        }
        if(!data.workerId) {
            return respond({error: 'invalidWorkerId'});
        }
        const worker = this._workers.find(w => w.id == data.workerId);
        if(!worker) {
            return respond({error: 'unknownWorkerId'});
        }
        this._workers.remove(worker);

        this.mqManager.removeWorkerById(worker.id);

        respond({success: true});
	}

	getStats(data, respond) {

	}

	addTask(data, respond) {
		if(!data) {
			return respond({error: 'invalidInput'});
		}
		if(!data.taskId) {
			return respond({error: 'invalidTaskId'});
		}
		if(!data.type) {
			return respond({error: 'invalidType'});
		}
		if(!data.data) {
			return respond({error: 'invalidData'});
		}

		const task = this.mqManager.createTask(data.type, data.taskId);
        task.data = data.data;

        const result = this.mqManager.addTask(task);
		respond(result);

	}

	abortTask(data, respond) {

	}

	getTaskInfo(data, respond) {

	}

    workerFinishedTask(data) {
	    if(!data.workerId || !data.taskId) {
	        return log.error('Illegal workerFinishedTask', data);
        }

        this.mqManager.finishTask(data.taskId, data.result);
    }

    workerUpdatedTask(data) {
        if(!data.workerId || !data.taskId) {
            return log.error('Illegal workerUpdatedTask', data);
        }
        this.mqManager.updateTask(data.taskId, data.result);
    }

    workerReturnedTask(data) {
        if(!data.workerId || !data.taskId) {
            return log.error('Illegal workerReturnedTask', data);
        }
        this.mqManager.returnTask(data.taskId, 'error');
    }

	_createWorker(typeMatcher, idMatcher) {

        const worker = this.mqManager.createWorker((task) => {
            const data = {
                workerId: worker.id,
                task: task
            };
            this.io.emit('startTask', data);

        }, (task) => {
            const data = {
                workerId: worker.id,
                taskId: task.id
            };
            this.io.emit('abortTask', data);

        });
        worker.typeMatcher = typeMatcher;
        worker.idMatcher = idMatcher;

        this._workers.push(worker);

        return worker;
    }

}

module.exports = DHMQServerClient;

