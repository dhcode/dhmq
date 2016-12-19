/* Created by Dominik Herbst on 2016-05-14 */
'use strict';

const MQTask = require('./mqTask');

/**
 * A Queue has three lists of Tasks for waiting, working and finished tasks.
 *
 */
class MQQueue {
    constructor(queueId) {
        this.id = queueId;
        this.state = 'detached'; // detached, attached, running, pausing, paused

        this.limit = 1000;

        /**
         * If >0 the queue will be removed from the manager after it was drained for the amount of time.
         * @type {number}
         */
        this.cleanupTime = 3600 * 24 * 1000;

        /**
         * Time until a finished task is removed
         * @type {number}
         */
        this.finishedCleanupTime = 60000;

        this.createdAt = new Date().getTime();
        this.drainedAt = this.createdAt;


        /**
         * @type {?MQManager}
         */
        Object.defineProperty(this, 'manager', {enumerable: false, value: null, writable: true});

        this.stats = {
            queued: 0,
            worked: 0,
            aborted: 0,
            finished: 0,
            totalWaitTime: 0,
            totalWorkTime: 0
        };

        Object.defineProperty(this, 'pausedCallback', {enumerable: false, value: null, writable: true});

        /**
         * @type {Array.<MQTask>}
         */
        Object.defineProperty(this, 'waiting', {enumerable: false, value: [], writable: false});

        /**
         * @type {Array.<MQTask>}
         */
        Object.defineProperty(this, 'working', {enumerable: false, value: [], writable: false});

        /**
         * @type {Array.<MQTask>}
         */
        Object.defineProperty(this, 'finished', {enumerable: false, value: [], writable: false});
    }

    setManager(manager) {
        this.manager = manager;
        this._setStateAttached();
    }

    unsetManager() {
        this.manager = null;
        this._setStateDetached();
    }

    isEmpty() {
        return !this.waiting.length && !this.working.length && !this.finished.length;
    }

    isDrainedAndOverdue(currentTime) {
        return this.drainedAt && this.cleanupTime && this.drainedAt + this.cleanupTime < currentTime;
    }

    _setStateDetached() {
        this.state = 'detached';
    }

    _setStateAttached() {
        this.state = 'attached';
    }

    _setStateRunning() {
        this.state = 'running';
    }

    _setStatePausing() {
        this.state = 'pausing';
    }

    _setStatePaused() {
        this.state = 'paused';
    }

    /**
     *
     * @param {MQTask} task
     * @returns {TaskInfo}
     */
    addTask(task) {
        const taskInfo = this.getTaskInfo(task.id);
        if (taskInfo.state != 'none') {
            return taskInfo;
        }

        if (this.waiting.length >= this.limit) {
            return TaskInfo.forState('full');
        }

        if (this.state != 'running') {
            return TaskInfo.forState('inactive');
        }

        task.setQueue(this);

        const pos = this.waiting.length;
        this.waiting.push(task);
        this.stats.queued++;
        this.drainedAt = null;

        this.tryHandleNext();
        return TaskInfo.forTask(task, pos, 'added');
    }

    abortTask(taskId) {
        return this.finishTask(taskId, null, 'abort');
    }

    returnTask(taskId, reason) {
        const taskInfo = this.getTaskInfo(taskId);
        if (taskInfo.state == 'working') {
            this.working.splice(taskInfo.pos, 1);
            if (reason == 'error') {
                this.waiting.push(taskInfo.task);
            } else {
                this.waiting.unshift(taskInfo.task);
            }
            taskInfo.task.resetWorker();
            this.tryHandleNext();
            return this.getTaskInfo(taskId);

        } else {
            return null;
        }
    }

    updateTask(taskId, result) {
        const taskInfo = this.getTaskInfo(taskId);
        if (taskInfo.state == 'working') {
            taskInfo.task.setResult(result);
            return taskInfo;
        } else {
            return null;
        }
    }

    /**
     * @param {String} taskId
     * @param {*} result
     * @param {'success'|'abort'} reason should be one of: success, abort
     * @returns {TaskInfo}
     */
    finishTask(taskId, result, reason) {
        const taskInfo = this.getTaskInfo(taskId);
        if (taskInfo.state != 'working' && taskInfo.state != 'waiting') {
            return taskInfo;
        }

        if (taskInfo.state == 'working') {
            this.working.splice(taskInfo.pos, 1);
        } else if (taskInfo.state == 'waiting') {
            this.waiting.splice(taskInfo.pos, 1);
        }

        taskInfo.task.setEndResult(result);
        this._addFinished(taskInfo.task, reason);
        return this.getTaskInfo(taskId);
    }

    /**
     * @param {String} taskId
     * @returns {TaskInfo}
     */
    getTaskInfo(taskId) {
        let taskInfo;
        taskInfo = MQQueue._findByTaskId(this.waiting, taskId);
        if (taskInfo) {
            taskInfo.state = 'waiting';
            return taskInfo;
        }
        taskInfo = MQQueue._findByTaskId(this.working, taskId);
        if (taskInfo) {
            taskInfo.state = 'working';
            return taskInfo;
        }
        taskInfo = MQQueue._findByTaskId(this.finished, taskId);
        if (taskInfo) {
            taskInfo.state = 'finished';
            return taskInfo;
        }
        return TaskInfo.none();
    }

    cleanupFinished(currentTime) {
        const earliest = currentTime - this.finishedCleanupTime;
        for (let i = 0; i < this.finished.length; i++) {
            const task = this.finished[i];
            if (task.finishedAt <= earliest) {
                this.finished.splice(i, 1);
                i--;
            }
        }
    }

    getTimedOutWaitingTasks(currentTime) {
        return this.waiting.filter(task => task.queuedAt <= currentTime - task.maxWaitTime);
    }

    getTimedOutWorkingTasks(currentTime) {
        return this.working.filter(task => task.queuedAt <= currentTime - task.maxWaitTime);
    }

    _addFinished(task, reason) {
        this.finished.push(task);
        if (this.finished.length > this.limit) {
            this.finished.shift();
        }
        this.tryHandleNext();
        this._checkDrained();

        if (task.workingAt && reason != 'abort') {
            this.stats.finished++;
            this.stats.totalWorkTime += task.finishedAt - task.workingAt;

        } else if (reason == 'abort') {
            this.stats.aborted++;
        }
    }

    tryHandleNext() {
        if (this.state == 'running') {
            process.nextTick(() => {
                this._handleNext();
            });
        }
        if (this.state == 'pausing') {
            if (!this.working.length) {
                this._setStatePaused();
                if (this.pausedCallback) {
                    this.pausedCallback();
                }
            }
        }

    }

    getStats() {
        const stats = {
            queued: this.stats.queued,
            worked: this.stats.worked,
            aborted: this.stats.aborted,
            finished: this.stats.finished,
            waiting: this.waiting.length,
            working: this.working.length,
            avgWaitTime: 0,
            avgWorkTime: 0
        };

        stats.avgWaitTime = this.stats.worked ? this.stats.totalWaitTime / this.stats.worked : 0;
        stats.avgWorkTime = this.stats.worked ? this.stats.totalWorkTime / this.stats.finished : 0;

        return stats;
    }

    start() {
        this._setStateRunning();
        this.tryHandleNext();
    }

    pause() {
        if (this.working.length) {
            this._setStatePausing();
            return new Promise((resolve) => {
                this.pausedCallback = () => {
                    resolve();
                };
            });
        } else {
            this._setStatePaused();
            return Promise.resolve();
        }
    }

    /**
     * Writes the queue and all waiting task objects to an Object stream.
     * It does not end the stream, it must be done by the caller.
     * @param stream an writable object stream that accepts Objects
     * @returns {Promise}
     */
    serializeQueue(stream) {
        if (this.state != 'paused' && this.state != 'detached') {
            return Promise.reject(new Error('Invalid queue state for serializing it'));
        }
        return new Promise((resolve) => {
            stream.write(this, () => {
                resolve();
            });
        })
            .then(() => this._serializeWaitingTasks(stream))
    }

    _serializeWaitingTasks(stream) {
        return new Promise((resolve) => {
            let index = 0;
            const serializeNext = () => {
                if (index < this.waiting.length) {
                    stream.write(this.waiting[index], serializeNext);
                    index++;
                } else {
                    resolve();
                }
            };
            serializeNext();
        });
    }

    static fromSerialized(stream) {
        return new Promise((resolve, reject) => {
            let queue = null;
            stream.on('data', (obj) => {
                if (!queue) {
                    queue = new MQQueue(obj.id);
                    Object.keys(obj).forEach(key => queue[key] = obj[key]);

                } else {
                    const task = MQTask.fromSerialized(obj);
                    task.setQueue(this);
                    queue.waiting.push(task);
                }
            });
            stream.on('end', () => {
                if(queue) {
                    resolve(queue);
                } else {
                    reject(new Error('invalidSource'));
                }
            });
        });
    }

    _handleNext() {
        if (!this.waiting.length || this.state != 'running' || !this.manager) return;

        const task = this.waiting[0];
        const worker = this.manager.findWorkerForTask(task);
        if (worker) {
            this.waiting.shift();
            this.working.push(task);

            this.stats.worked++;
            this.stats.totalWaitTime += new Date().getTime() - task.queuedAt;

            const taskInfo = MQQueue._findByTaskId(this.working, task.id);
            taskInfo.state = 'working';
            this.manager.startTask(worker, taskInfo);
        }

    }

    _checkDrained() {
        if (!this.waiting.length && !this.working.length) {
            this.drainedAt = new Date().getTime();
        }
    }

    /**
     * @param {Array.<MQTask>} queue
     * @param {String} taskId
     * @returns {?TaskInfo}
     * @private
     */
    static _findByTaskId(queue, taskId) {
        for (let i = 0; i < queue.length; i++) {
            const task = queue[i];
            if (task.id == taskId) return TaskInfo.forTask(task, i);
        }
        return null;
    }


}
module.exports = MQQueue;

class TaskInfo {
    constructor() {
        this.task = null;
        this.pos = null;
        this.state = 'none'; // none, waiting, working, finished, added, inactive, full
    }

    /**
     * @param {MQTask} task
     * @param {Number} pos
     * @param {String} [state]
     * @returns {TaskInfo}
     */
    static forTask(task, pos, state) {
        const t = new TaskInfo();
        t.task = task;
        t.pos = pos;
        if (state) {
            t.state = state;
        }
        return t;
    }

    /**
     * @param {String} state
     * @returns {TaskInfo}
     */
    static forState(state) {
        const t = new TaskInfo();
        t.state = state;
        return t;
    }

    /**
     * @returns {TaskInfo}
     */
    static none() {
        return new TaskInfo();
    }
}
