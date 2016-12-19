/* Created by Dominik Herbst on 2016-04-30 */
'use strict';

const EventEmitter = require('events');
const log = require('dhlog').forModule(module);
const SocketIoClient = require('socket.io-client');
const func = require('./func');

/**
 * @extends EventEmitter
 */
class DHMQClient extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        /**
         * @type {Socket}
         */
        this.io = new SocketIoClient(this.config.url, this.config);

        this.workerHandlers = {};

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

        this.io.on('startTask', (data) => {
            if (!data || !data.workerId || !data.task || !data.task.id) {
                log.error('Invalid startTask request');
                return;
            }
            this._startTask(data.workerId, data.task);
        });
        this.io.on('abortTask', (data) => {
            if (!data || !data.workerId || !data.taskId) {
                log.error('Invalid abortTask request');
                return;
            }
            this._abortTask(data.workerId, data.taskId);
        });
    }

    authenticate() {
        return new Promise((resolve, reject) => {
            this.io.emit('auth', {
                userId: this.config.userId,
                key: this.config.key
            }, (response) => {
                if (response && response.success) {
                    resolve(response);
                } else {
                    reject(response);
                }
            });
        });
    }

    registerAsWorker(typeMatcher, startHandler, abortHandler) {
        return new Promise((resolve, reject) => {
            this.io.emit('registerWorker', {
                typeMatcher: typeMatcher
            }, (response) => {
                if (response && response.success && response.workerId) {
                    this._setupWorker(response.workerId, startHandler, abortHandler);
                    this.emit('registeredWorker', response.workerId);
                    resolve(response);
                } else {
                    reject(response);
                }
            });
        });
    }

    _setupWorker(workerId, startHandler, abortHandler) {
        this.workerHandlers[workerId] = {start: startHandler, abort: abortHandler};
    }

    _startTask(workerId, task) {
        if (!this.workerHandlers[workerId]) {
            return this.finishTask(workerId, task.id, {state: 'error', error: 'unknownWorker'});
        }
        const handler = this.workerHandlers[workerId];
        handler.start(task).then((result) => {
            this.finishTask(workerId, task.id, result);
        }).catch(error => {
            this.finishTask(workerId, task.id, {state: 'error', error: error});
        });
    }

    _abortTask(workerId, taskId) {
        if (!this.workerHandlers[workerId]) {
            return this.finishTask(workerId, taskId, {state: 'error', error: 'unknownWorker'});
        }
        const handler = this.workerHandlers[workerId];
        handler.abort(taskId);
    }

    /**
     * Called to add a task
     * @param type
     * @param data
     */
    addTask(type, data) {
        const successStates = ['added', 'working', 'waiting', 'finished'];
        return new Promise((resolve, reject) => {
            this.io.emit('addTask', {
                taskId: 'T' + func.randomString(11),
                type: type,
                data: data
            }, (taskInfo) => {
                if (successStates.indexOf(taskInfo.state) != -1) {
                    resolve(taskInfo);
                } else {
                    reject(taskInfo);
                }
            });
        });
    }

    /**
     * Called to receive info about a task
     * @param taskId
     */
    getTaskInfo(taskId) {
        return new Promise((resolve) => {
            this.io.emit('getTaskInfo', {taskId: taskId}, (response) => {
                resolve(response);
            });
        });
    }

    /**
     * Called from a worker to finish a task
     * @param workerId
     * @param taskId
     * @param result
     */
    finishTask(workerId, taskId, result) {
        this.io.emit('workerFinishedTask', {
            workerId: workerId,
            taskId: taskId,
            result: result
        });
    }

    /**
     * Called from a worker to update a task
     * @param workerId
     * @param taskId
     * @param result
     */
    updateTask(workerId, taskId, result) {
        this.io.emit('workerUpdatedTask', {
            workerId: workerId,
            taskId: taskId,
            result: result
        });
    }

    /**
     * Called from a worker to return a task
     * @param workerId
     * @param taskId
     */
    returnTask(workerId, taskId) {
        this.io.emit('workerReturnedTask', {
            workerId: workerId,
            taskId: taskId
        });
    }

    disconnect() {
        this.io.disconnect();
    }


}

module.exports = DHMQClient;