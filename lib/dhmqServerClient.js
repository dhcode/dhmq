/* Created by Dominik Herbst on 2016-02-12 */
'use strict';

const log = require('dhlog').forModule(module);
const func = require('./func');
const validate = require('jsonschema').validate;

const validTaskId = /^[-A-Za-z0-9_.]{4,32}$/;
const validWorkerId = /^[-A-Za-z0-9_.]{4,32}$/;
const validType = /^[-A-Za-z0-9_]{4,32}$/;
const validUser = /^[-A-Za-z0-9_]{4,32}$/;

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

        this.authProvider = server.authProvider;

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
            log.debug('received ' + name);
            handler.call(this, data, respond);
        });
    }

    _bindEvent(name, handler) {
        this.io.on(name, (data) => {
            log.debug('received ' + name);
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
        return this.authProvider;
    }

    auth(data, respond) {
        this._setStateAuthRequested();
        const validation = validate(data, {
            type: 'object',
            properties: {
                userId: {type: 'string', pattern: validUser},
                key: {type: 'string', pattern: /^.{4,64}$/}
            },
            required: ['userId', 'key']
        });
        if(!validation.valid) {
            this._setStateAuthFailed();
            return respond({error: 'invalidInput', errors: validation.errors});
        }
        this._getAuthProvider().identify(data.userId, data.key).then(() => {
            this._setStateReady();
            respond({success: true});
        }).catch(err => {
            this._setStateAuthFailed();
            respond(err);
        });
    }

    registerWorker(data, respond) {
        const validation = validate(data, {
            type: 'object',
            properties: {
                typeMatcher: {type: 'string', pattern: /^.{4,32}$/},
                idMatcher: {type: 'string', pattern: /^.{4,32}$/}
            },
            required: ['typeMatcher']
        });
        if(!validation.valid) {
            return respond({error: 'invalidInput', errors: validation.errors});
        }

        const typeMatcher = new RegExp(data.typeMatcher);
        const idMatcher = new RegExp(data.idMatcher || undefined);

        const worker = this._createWorker(typeMatcher, idMatcher);

        this.mqManager.registerWorker(worker);

        respond({
            success: true,
            workerId: worker.id
        });
    }

    removeWorker(data, respond) {
        const validation = validate(data, {
            type: 'object',
            properties: {
                workerId: {type: 'string', pattern: validWorkerId}
            },
            required: ['workerId']
        });
        if(!validation.valid) {
            return respond({error: 'invalidInput', errors: validation.errors});
        }

        const worker = this._workers.find(w => w.id == data.workerId);
        if (!worker) {
            return respond({error: 'unknownWorkerId'});
        }
        this._workers.remove(worker);

        this.mqManager.removeWorkerById(worker.id);

        respond({success: true});
    }

    getStats(data, respond) {
        respond({
            result: this.mqManager.getQueueStats()
        });
    }

    addTask(data, respond) {
        const validation = validate(data, {
            type: 'object',
            properties: {
                taskId: {type: 'string', pattern: validTaskId},
                type: {type: 'string', pattern: validType},
                data: {}
            },
            required: ['taskId', 'type']
        });
        if(!validation.valid) {
            return respond({error: 'invalidInput', errors: validation.errors});
        }

        const task = this.mqManager.createTask(data.type, data.taskId);
        task.data = data.data;

        const result = this.mqManager.addTask(task);
        respond(result);

    }

    abortTask(data, respond) {
        const validation = validate(data, {
            type: 'object',
            properties: {
                taskId: {type: 'string', pattern: validTaskId},
            },
            required: ['taskId']
        });
        if(!validation.valid) {
            return respond({error: 'invalidInput', errors: validation.errors});
        }

        const taskInfo = this.mqManager.abortTask(data.taskId);
        respond(taskInfo);
    }

    getTaskInfo(data, respond) {
        const validation = validate(data, {
            type: 'object',
            properties: {
                taskId: {type: 'string', pattern: validTaskId},
            },
            required: ['taskId']
        });
        if(!validation.valid) {
            return respond({error: 'invalidInput', errors: validation.errors});
        }
        const taskInfo = this.mqManager.getTaskInfo(data.taskId);
        respond(taskInfo);
    }

    workerFinishedTask(data) {
        if (!data.workerId || !data.taskId) {
            return log.error('Illegal workerFinishedTask', data);
        }

        this.mqManager.finishTask(data.taskId, data.result);
    }

    workerUpdatedTask(data) {
        if (!data.workerId || !data.taskId) {
            return log.error('Illegal workerUpdatedTask', data);
        }
        this.mqManager.updateTask(data.taskId, data.result);
    }

    workerReturnedTask(data) {
        if (!data.workerId || !data.taskId) {
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

