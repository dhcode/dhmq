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
        this._config = config;
        this._config.autoConnect = false;
        /**
         * @type {Socket}
         */
        this.io = new SocketIoClient(this._config.url, this._config);

        this.workerHandlers = {};

        this.initEvents();
    }

    connect() {
        return new Promise((resolve, reject) => {
            if (this.io.connected) {
                resolve();
                return;
            }
            this.io.once('connect', () => {
                resolve();
            });
            this.io.once('connect_error', (err) => {
                reject(err);
            });
            this.io.connect();
        });
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
                userId: this._config.userId,
                key: this._config.key
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
     * Watches any task changes. If the task is finished,
     * the listener will be removed.
     * If the task is finished at time of this call
     * the listener will be called once and the get removed.
     * @param taskId
     * @param listener
     */
    watchTask(taskId, listener) {
        const topic = 'task:' + taskId;
        const _listener = (data) => {
            if (data.state == 'finished' || data.state == 'none') {
                this.io.removeListener(topic, _listener);
            }
            listener(data);
        };
        this.io.on(topic, _listener);

        this.io.emit('watchTask', {taskId: taskId});
    }

    /**
     * Called to abort a task
     * @param taskId
     */
    abortTask(taskId) {
        return new Promise((resolve) => {
            this.io.emit('abortTask', {taskId: taskId}, (response) => {
                resolve(response);
            });
        });
    }

    /**
     * Called to receive stats about the queues
     */
    getStats() {
        return new Promise((resolve) => {
            this.io.emit('getStats', {}, (response) => {
                resolve(response.result);
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
