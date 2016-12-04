/* Created by Dominik Herbst on 2016-05-14 */
'use strict';

class MQTask {
	constructor(type, id) {
		this.type = type;
		this.id = id;
        this.data = null;

		this.state = 'created'; // created, queued, working, finished
		this.result = null;

        /**
         * If >0, the task can timeout while waiting in queue
         * @type {number}
         */
        this.maxWaitTime = 0;

        /**
         * If >0, the task can timeout while working
         * @type {number}
         */
        this.maxWorkTime = 0;

        this.createdAt = new Date().getTime();
        this.updatedAt = null;
        this.queuedAt = null;
        this.workingAt = null;
        this.finishedAt = null;

		Object.defineProperty(this, 'queueId', {enumerable: false, value: null, writable: true});
		Object.defineProperty(this, 'workerId', {enumerable: false, value: null, writable: true});
	}


	setQueue(queue) {
		this.queueId = queue.id;
		this._setStateQueued();
	}

	setWorker(worker) {
		this.workerId = worker.id;
		this._setStateWorking();
	}

	resetWorker() {
        this.workerId = null;
        this.workingAt = null;
        this._setStateQueued();
    }

    setResult(result) {
        this.updatedAt = new Date().getTime();
        this.result = result;
    }

	setEndResult(result) {
        this.setResult(result);
        this._setStateFinished();
    }

	_setStateQueued() {
        this.queuedAt = new Date().getTime();
		this.state = 'queued';
	}
	_setStateWorking() {
        this.workingAt = new Date().getTime();
		this.state = 'working';
	}
	_setStateFinished() {
        this.workerId = null;
        this.finishedAt = new Date().getTime();
		this.state = 'finished';
	}

}
module.exports = MQTask;
