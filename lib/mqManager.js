/* Created by Dominik Herbst on 2016-05-14 */
'use strict';

const EventEmitter = require('events');
const fs = require('fs');
const ldj = require('ldjson-stream');
const func = require('./func');
const MQQueue = require('./mqQueue');
const MQWorker = require('./mqWorker');
const MQTask = require('./mqTask');
const log = require('dhlog').forModule(module);

const instances = {};

/**
 * The orchestrator for all workers and queues.
 * Events:
 * taskAdded
 * taskAborted
 * taskReturned
 * taskFinished
 * taskUpdated
 * taskStarted
 * loading
 * saving
 * running
 * paused
 * task:[taskId]
 */
class MQManager extends EventEmitter {
    constructor() {
        super();

        /**
         * @type {Array.<MQWorker>}
         */
        this.workers = func.advancedArray();

        /**
         * @type {Array.<MQQueue>}
         */
        this.queues = func.advancedArray();

        this.state = 'loading'; // running, loading, saving, paused

        this.checkTimeoutsInterval = 10000;

        this.maxWaitForShutdown = 0;

        this.interval = null;

        this.storagePath = 'data/queues';

        this.setMaxListeners(10000);

    }

    _setStateRunning() {
        this.state = 'running';
        this.emit(this.state);
    }

    _setStateLoading() {
        this.state = 'loading';
        this.emit(this.state);
    }

    _setStateSaving() {
        this.state = 'saving';
        this.emit(this.state);
    }

    _setStatePaused() {
        this.state = 'paused';
        this.emit(this.state);
    }

    registerWorker(worker) {
        this.workers.push(worker);
        this.queues.forEach(q => q.tryHandleNext());
        this._validateInterval();
    }

    removeWorkerById(workerId) {
        for (let i = 0; i < this.workers.length; i++) {
            const w = this.workers[i];
            if (w.id == workerId) {
                if (w.currentTask) {
                    this.returnTask(w.currentTask.id, 'shutdown');
                }
                w.remove();
                this.workers.splice(i, 1);
                i--;
            }
        }
        this._validateInterval();
    }

    /**
     * @param id
     * @returns {?MQWorker}
     */
    getWorker(id) {
        return this.workers.find(w => w.id == id);
    }

    /**
     * Adds a task to a queue
     * @param {MQTask} task
     */
    addTask(task) {
        if (this.state != 'running') {
            return {state: 'error', error: 'manager_not_running'};
        }

        const queue = this.getQueue(task.type);
        const taskInfo = queue.addTask(task);
        this._validateInterval();
        if (taskInfo.state == 'added') {
            this.emit('taskAdded', taskInfo);
            this.emit('task:' + task.id, taskInfo);
        }
        return taskInfo;
    }

    /**
     * @param {String} type
     * @param {String} taskId
     * @returns {MQTask}
     */
    createTask(type, taskId) {
        return new MQTask(type, taskId);
    }

    getTaskInfo(taskId) {
        for (const queue of this.queues) {
            const info = queue.getTaskInfo(taskId);
            if (info.state != 'none') {
                return info;
            }
        }
        return {state: 'none'};
    }

    /**
     * @param {String} taskId
     * @returns {?MQQueue}
     */
    getQueueOfTask(taskId) {
        return this.queues.find(queue => queue.getTaskInfo(taskId).state != 'none');
    }

    /**
     * Aborts the task
     * @param {String} taskId
     */
    abortTask(taskId) {
        if (this.state != 'running' && this.state != 'saving') {
            return {state: 'error', error: 'manager_not_running'};
        }

        const queue = this.getQueueOfTask(taskId);
        if (queue) {
            this._abortTaskOnWorker(taskId);
            const taskInfo = queue.abortTask(taskId);
            this.emit('taskAborted', taskInfo);
            this.emit('task:' + taskId, taskInfo);
            this.removeListener('task:' + taskId);
            this._validateInterval();
            return taskInfo;
        } else {
            return {state: 'none'};
        }
    }

    /**
     * Returns the task to the queue
     * @param taskId
     * @param {'error', 'shutdown'} reason
     */
    returnTask(taskId, reason) {
        if (this.state != 'running') {
            return {state: 'error', error: 'manager_not_running'};
        }
        const queue = this.getQueueOfTask(taskId);
        if (queue) {
            this._freeWorkerOfTask(taskId);
            const taskInfo = queue.returnTask(taskId, reason);
            this.emit('taskReturned', taskInfo);
            this.emit('task:' + taskId, taskInfo);
            return taskInfo;
        } else {
            return {state: 'none'};
        }
    }

    /**
     * Finished the task and sets the result
     * @param taskId
     * @param result
     */
    finishTask(taskId, result) {
        if (this.state != 'running') {
            return {state: 'error', error: 'manager_not_running'};
        }
        const queue = this.getQueueOfTask(taskId);
        if (queue) {
            this._freeWorkerOfTask(taskId);
            const taskInfo = queue.finishTask(taskId, result, 'success');
            this.emit('taskFinished', taskInfo);
            this.emit('task:' + taskId, taskInfo);
            this.removeListener('task:' + taskId);
            this._validateInterval();
            return taskInfo;
        } else {
            return {state: 'none'};
        }
    }

    /**
     * Updates the task without changing the state
     * @param taskId
     * @param result
     */
    updateTask(taskId, result) {
        if (this.state != 'running') {
            return {state: 'error', error: 'manager_not_running'};
        }
        const queue = this.getQueueOfTask(taskId);
        if (queue) {
            const taskInfo = queue.updateTask(taskId, result);
            this.emit('taskUpdated', taskInfo);
            this.emit('task:' + taskId, taskInfo);
            return taskInfo;
        } else {
            return {state: 'none'};
        }
    }

    /**
     * Finds a free worker that can handle the given task
     * @param {MQTask} task
     * @returns {?MQWorker}
     */
    findWorkerForTask(task) {
        for (let i = 0; i < this.workers.length; i++) {
            const w = this.workers[i];
            if (w.canWork(task) && w.isFree()) return w;
        }
        return null;
    }

    /**
     * Called by a queue to start a task with the found worker
     * @param {MQWorker} worker
     * @param {TaskInfo} taskInfo
     */
    startTask(worker, taskInfo) {
        worker.startTask(taskInfo.task);
        this.emit('taskStarted', taskInfo);
        this.emit('task:' + taskInfo.task.id, taskInfo);
    }

    /**
     * Returns a matching queue
     * @param queueId
     * @returns {MQQueue}
     */
    getQueue(queueId) {
        const queues = this.queues.filter((q) => q.id == queueId);
        if (queues.length) return queues[0];

        const queue = new MQQueue(queueId);
        queue.setManager(this);
        this.queues.push(queue);
        queue.start();

        return queue;
    }

    getQueueStats() {
        return this.queues.map(q => q.getStats());
    }

    _serializeQueue(queue) {
        return func.ensureFolder(this.storagePath).then(() => {
            const filePath = this.storagePath + '/' + queue.id;
            log.info('Storing queue in ' + filePath);
            const writeStream = fs.createWriteStream(filePath);
            const objectStream = ldj.serialize();
            objectStream.pipe(writeStream);
            return queue.serializeQueue(objectStream).then(() => {
                return new Promise(resolve => {
                    objectStream.end(() => resolve());
                });
            });
        });
    }

    /**
     * Saves the current queue state and stops everything
     * @param [maxWait] maximum wait time
     */
    shutdown(maxWait) {
        this._setStateSaving();
        if (maxWait) {
            this.maxWaitForShutdown = maxWait;
        }
        return Promise.all(this.queues.map(q => {
            return q.pause()
                .then(() => this._serializeQueue(q));
        })).then(() => {
            this._setStatePaused();
            this._validateInterval();
        });
    }

    restore() {
        this._setStateLoading();
        return this._restoreQueueFiles().then(() => {
            this._setStateRunning();
        });
    }

    _restoreQueueFiles() {
        return new Promise((resolve, reject) => {
            fs.readdir(this.storagePath, (err, filesList) => {
                err && err.code != 'ENOENT' ? reject(err) : resolve(filesList || []);
            });
        }).then((filesList) => {
            return Promise.all(filesList.map(fileName => {
                return this.restoreQueueFromFile(this.storagePath + '/' + fileName);
            }));
        });
    }

    restoreQueueFromFile(filePath) {
        const readStream = fs.createReadStream(filePath);
        const objectStream = ldj.parse();
        readStream.pipe(objectStream);
        log.info('Restoring queue from ' + filePath);
        return MQQueue.fromSerialized(objectStream).then(queue => {
            queue.setManager(this);
            this.queues.push(queue);
            queue.start();
        }).catch(err => {
            log.error('Failed to restore queue from ' + filePath, err);
        });
    }

    _validateInterval() {
        if (this.queues.every(q => q.isEmpty())) {
            if (this.interval) {
                clearInterval(this.interval);
                this.interval = null;
            }
        } else if (!this.interval) {
            this.interval = setInterval(() => {
                this.runPeriodicCheck();
            }, this.checkTimeoutsInterval);
            this.interval.unref();
        }

    }

    runPeriodicCheck() {
        const now = new Date().getTime();
        this.queues.forEach(q => this._abortTimedOutTasks(q, now));
        this.queues.forEach(q => q.cleanupFinished(now));
        this._cleanupDrainedQueues();
        if (this.maxWaitForShutdown && this.state == 'saving') {
            this._returnWorkingTasks();
        }
    }

    _cleanupDrainedQueues() {
        const now = new Date().getTime();
        const queues = this.queues.filter(q => q.isDrainedAndOverdue(now));
        queues.forEach(q => this.queues.remove(q));
    }

    _abortTimedOutTasks(queue, now) {
        queue.getTimedOutWaitingTasks(now).forEach(task => {
            this.abortTask(task.id);
        });
        queue.getTimedOutWorkingTasks(now).forEach(task => {
            this.abortTask(task.id);
        });
    }

    _returnWorkingTasks() {
        this.queues.forEach(queue => {
            queue.working.forEach(task => this.returnTask(task.id, 'shutdown'));
        });
    }

    /**
     * Creates a worker with a new Id.
     * @param startCallback
     * @param abortCallback
     * @returns {MQWorker}
     */
    createWorker(startCallback, abortCallback) {
        return new MQWorker('W' + func.randomString(11), startCallback, abortCallback);
    }

    _abortTaskOnWorker(taskId) {
        const taskInfo = this.getTaskInfo(taskId);
        if (taskInfo.state != 'none' && taskInfo.task.workerId) {
            const worker = this.getWorker(taskInfo.task.workerId);
            if (worker && worker.currentTask && worker.currentTask == taskInfo.task) {
                worker.abortTask();
            }
        }
    }

    _freeWorkerOfTask(taskId) {
        const taskInfo = this.getTaskInfo(taskId);
        if (taskInfo.state != 'none' && taskInfo.task.workerId) {
            const worker = this.getWorker(taskInfo.task.workerId);
            if (worker && worker.currentTask && worker.currentTask == taskInfo.task) {
                worker.onFinishedTask();
            }
        }
    }

    /**
     * @param [instanceId]
     * @param [properties] properties will only be used on instantiation
     * @returns {Promise.<MQManager>}
     */
    static getInstance(instanceId, properties) {
        if (!instanceId) instanceId = 'default';
        return new Promise((resolve, reject) => {
            if (!instances[instanceId]) {
                const m = instances[instanceId] = new MQManager();
                m.storagePath += '/' + instanceId;
                Object.keys(properties || {}).forEach(key => m[key] = properties[key]);
                m.restore().then(() => resolve(m));
            } else if (m.state == 'loading') {
                m.once('running', () => resolve(m));
            } else {
                resolve(m);
            }
        });
    }

}
module.exports = MQManager;
