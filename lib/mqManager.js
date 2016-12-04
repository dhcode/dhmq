/* Created by Dominik Herbst on 2016-05-14 */
'use strict';

const EventEmitter = require('events');
const func = require('./func');
const MQQueue = require('./mqQueue');
const MQWorker = require('./mqWorker');
const MQTask = require('./mqTask');

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
 */
class MQManager extends EventEmitter {
    constructor() {
        super();

        /**
         * @type {Array.<MQWorker>}
         */
        this.workers = [];

        /**
         * @type {Array.<MQQueue>}
         */
        this.queues = [];

        this.state = 'running'; // running, loading, saving, paused

        this.checkTimeoutsInterval = 10000;

        this.interval = null;

        this.storagePath = 'data/queues';

        this.setMaxListeners(10000);

    }

    _setStateRunning() {
        this.state = 'running';
    }

    _setStateLoading() {
        this.state = 'loading';
    }

    _setStateSaving() {
        this.state = 'saving';
    }

    _setStatePaused() {
        this.state = 'paused';
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
        if (this.state != 'running') {
            return {state: 'error', error: 'manager_not_running'};
        }

        const queue = this.getQueueOfTask(taskId);
        if (queue) {
            this._abortTaskOnWorker(taskId);
            const taskInfo = queue.abortTask(taskId);
            this.emit('taskAborted', taskInfo);
            this._validateInterval();
            return taskInfo;
        } else {
            return {state: 'none'};
        }
    }

    /**
     * Returns the task to the queue
     * @param taskId
     */
    returnTask(taskId) {
        if (this.state != 'running') {
            return {state: 'error', error: 'manager_not_running'};
        }
        const queue = this.getQueueOfTask(taskId);
        if (queue) {
            this._freeWorkerOfTask(taskId);
            const taskInfo = queue.returnTask(taskId);
            this.emit('taskReturned', taskInfo);
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
            const taskInfo = queue.finishTask(taskId, result);
            this.emit('taskFinished', taskInfo);
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

        return queue;
    }

    /**
     * Saves the current queue state and stops everything
     */
    shutdown() {


    }

    restore() {

    }

    _validateInterval() {
        if (this.queues.every(q => q.isEmpty())) {
            if (this.interval) {
                clearInterval(this.interval);
                this.interval = null;
            }
        } else if (!this.interval) {
            this.interval = setTimeout(() => {
                this.runPeriodicCheck();
            }, this.checkTimeoutsInterval);
            this.interval.unref();
        }

    }

    runPeriodicCheck() {
        const now = new Date().getTime();
        this.queues.forEach(q => this._abortTimedOutTasks(q, now));
        this.queues.forEach(q => q.cleanupFinished(now));
    }

    _abortTimedOutTasks(queue, now) {
        queue.getTimedOutWaitingTasks(now).forEach(task => {
            this.abortTask(task.id);
        });
        queue.getTimedOutWorkingTasks(now).forEach(task => {
            this.abortTask(task.id);
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
     * @returns {MQManager}
     */
    static getInstance(instanceId) {
        if (!instanceId) instanceId = 'default';
        if (!instances[instanceId])
            instances[instanceId] = new MQManager();
        return instances[instanceId];
    }

}
module.exports = MQManager;
