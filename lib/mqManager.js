/* Created by Dominik Herbst on 2016-05-14 */
'use strict';

const log = require('dhlog').forModule(module);
const func = require('./func');
const MQQueue = require('./mqQueue');
const MQWorker = require('./mqWorker');
const MQTask = require('./mqTask');

const instances = {};

/**
 * The orchestrator for all workers and queues.
 */
class MQManager {
    constructor() {
        this.workers = [];
        this.queues = [];

        this.state = 'running'; // running, loading, saving, paused
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
    }

    getWorker(id) {
        return this.workers.find(w => w.id == id);
    }

    /**
     * Adds a task to a queue
     * @param {MQTask} task
     */
    addTask(task) {
        if (this.state != 'running') {
            return {error: 'manager_not_running'};
        }

        const queue = this.getQueue(task.type);
        return queue.addTask(task);
    }

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

    getQueueOfTask(taskId) {
        return this.queues.find(queue => queue.getTaskInfo(taskId).state != 'none');
    }

    /**
     * Aborts the task
     * @param taskId
     */
    abortTask(taskId) {
        if (this.state != 'running') {
            return {error: 'manager_not_running'};
        }

        const queue = this.getQueueOfTask(taskId);
        if (queue) {
            return queue.abortTask(taskId);
        }
    }

    /**
     * Returns the task to the queue
     * @param taskId
     */
    returnTask(taskId) {
        if (this.state != 'running') {
            return {error: 'manager_not_running'};
        }
        const queue = this.getQueueOfTask(taskId);
        if (queue) {
            return queue.returnTask(taskId);
        }
    }

    /**
     * Finished the task and sets the result
     * @param taskId
     * @param result
     */
    finishTask(taskId, result) {
        if (this.state != 'running') {
            return {error: 'manager_not_running'};
        }
        const queue = this.getQueueOfTask(taskId);
        if (queue) {
            return queue.finishTask(taskId, result);
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
            return queue.updateTask(taskId, result);
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
    shutdown(callb) {

    }

    restore(callb) {

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
