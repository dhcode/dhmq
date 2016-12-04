/* Created by Dominik Herbst on 2016-05-14 */
'use strict';

/**
 * A Queue has three lists of Tasks for waiting, working and finished tasks.
 *
 */
class MQQueue {
    constructor(queueId) {
        this.id = queueId;
        this.state = 'detached'; // detached, attached, running, paused

        this.limit = 1000;

        /**
         * If >0 the queue will be removed from the manager after it was drained for the amount of time.
         * @type {number}
         */
        this.cleanupTime = 0;

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

        Object.defineProperty(this, 'stats', {
            enumerable: false, value: {
                queued: 0,
                worked: 0,
                aborted: 0,
                finished: 0,
                totalWaitTime: 0,
                totalWorkTime: 0
            }, writable: false
        });

        /**
         * @type {Array.<MQTask>}
         */
        this.waiting = [];

        /**
         * @type {Array.<MQTask>}
         */
        this.working = [];

        /**
         * @type {Array.<MQTask>}
         */
        this.finished = [];
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

    _setStateDetached() {
        this.state = 'detached';
    }

    _setStateAttached() {
        this.state = 'attached';
    }

    _setStateRunning() {
        this.state = 'running';
    }

    _setStatePaused() {
        this.state = 'paused';
    }

    /**
     *
     * @param {MQTask} task
     * @returns {*}
     */
    addTask(task) {
        const taskInfo = this.getTaskInfo(task.id);
        if (taskInfo.state != 'none') {
            return taskInfo;
        }

        if (this.waiting.length > this.limit) {
            return {state: 'full'};
        }

        task.setQueue(this);

        const pos = this.waiting.length;
        this.waiting.push(task);
        this.stats.queued++;

        this.tryHandleNext();
        return {state: 'added', pos: pos, task: task};
    }

    abortTask(taskId) {
        return this.finishTask(taskId, null);
    }

    returnTask(taskId) {
        const taskInfo = this.getTaskInfo(taskId);
        if (taskInfo.state == 'working') {
            this.working.splice(taskInfo.pos, 1);
            this.waiting.unshift(taskInfo.task);
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

    finishTask(taskId, result) {
        const taskInfo = this.getTaskInfo(taskId);
        if (taskInfo.state == 'working') {
            this.working.splice(taskInfo.pos, 1);
            taskInfo.task.setEndResult(result);
            this._addFinished(taskInfo.task);
            return this.getTaskInfo(taskId);

        } else if (taskInfo.state == 'waiting') {
            this.waiting.splice(taskInfo.pos, 1);
            taskInfo.task.setEndResult(result);
            this._addFinished(taskInfo.task);
            return this.getTaskInfo(taskId);

        } else if (taskInfo.state == 'finished') {
            return taskInfo;

        } else {
            return null;
        }
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

    _addFinished(task) {
        this.finished.push(task);
        if (this.finished.length > this.limit) {
            this.finished.shift();
        }
        this.tryHandleNext();
        this._checkDrained();

        if (task.workingAt) {
            this.stats.finished++;
            this.stats.totalWorkTime += task.finishedAt - task.workingAt;
        } else {
            this.stats.aborted++;
        }
    }

    tryHandleNext() {
        process.nextTick(() => {
            this._handleNext();
        });
    }

    getStats() {
        const stats = {
            queued: this.stats.queued,
            worked: this.stats.worked,
            aborted: this.stats.aborted,
            finished: this.stats.finished,
            avgWaitTime: 0,
            avgWorkTime: 0
        };

        stats.avgWaitTime = this.stats.worked ? this.stats.totalWaitTime / this.stats.worked : 0;
        stats.avgWorkTime = this.stats.worked ? this.stats.totalWorkTime / this.stats.finished : 0;

        return stats;
    }

    _handleNext() {
        if (!this.waiting.length) return;

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
        this.state = 'none'; // none, waiting, working, finished
    }

    /**
     * @param {MQTask} task
     * @param {Number} pos
     * @returns {TaskInfo}
     */
    static forTask(task, pos) {
        const t = new TaskInfo();
        t.task = task;
        t.pos = pos;
        return t;
    }

    /**
     * @returns {TaskInfo}
     */
    static none() {
        return new TaskInfo();
    }
}
