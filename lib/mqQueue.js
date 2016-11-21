/* Created by Dominik Herbst on 2016-05-14 */
'use strict';

class MQQueue {
	constructor(queueId) {
		this.id = queueId;
		this.state = 'detached'; // detached, attached, running, paused

		this.limit = 1000;

		/**
		 * @type {?MQManager}
		 */
		Object.defineProperty(this, 'manager', {enumerable: false, value: null, writable: true});

		this.waiting = [];
		this.working = [];
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
		if(taskInfo.state != 'none') {
			return taskInfo;
		}

		if(this.waiting.length > this.limit) {
			return {state: 'full'};
		}

		task.setQueue(this);

		const pos = this.waiting.length;
		this.waiting.push(task);

		this._tryHandleNext();
		return {state: 'added', pos: pos, task: task};
	}

	abortTask(taskId) {
        return this.finishTask(taskId, null);
    }

    returnTask(taskId) {
        const taskInfo = this.getTaskInfo(taskId);
        if(taskInfo.state == 'working') {
            this.working.splice(taskInfo.pos, 1);
            this.waiting.unshift(taskInfo.task);
            taskInfo.task.resetWorker();
            this._tryHandleNext();
            return this.getTaskInfo(taskId);

        } else {
            return null;
        }
    }

    updateTask(taskId, result) {
        const taskInfo = this.getTaskInfo(taskId);
        if(taskInfo.state == 'working') {
            taskInfo.task.setResult(result);
            return taskInfo;
        } else {
            return null;
        }
    }

    finishTask(taskId, result) {
        const taskInfo = this.getTaskInfo(taskId);
        if(taskInfo.state == 'working') {
            taskInfo.task.setEndResult(result);
            this.working.splice(taskInfo.pos, 1);
            this._addFinished(taskInfo.task);
            this._tryHandleNext();
            return this.getTaskInfo(taskId);

        } else if(taskInfo.state == 'waiting') {
            taskInfo.task.setEndResult(result);
            this.waiting.splice(taskInfo.pos, 1);
            this._addFinished(taskInfo.task);
            this._tryHandleNext();
            return this.getTaskInfo(taskId);

        } else if(taskInfo.state == 'finished') {
            return taskInfo;

        } else {
            return null;
        }
    }

	getTaskInfo(taskId) {
		let taskInfo;
		taskInfo = MQQueue._findByTaskId(this.waiting, taskId);
		if(taskInfo) {
			taskInfo.state = 'waiting';
			return taskInfo;
		}
		taskInfo = MQQueue._findByTaskId(this.working, taskId);
		if(taskInfo) {
			taskInfo.state = 'working';
			return taskInfo;
		}
		taskInfo = MQQueue._findByTaskId(this.finished, taskId);
		if(taskInfo) {
			taskInfo.state = 'finished';
			return taskInfo;
		}
		return {state: 'none'};
	}

	_addFinished(task) {
        this.finished.push(task);
        if(this.finished.length > this.limit) {
            this.finished.shift();
        }
    }

	_tryHandleNext() {
		process.nextTick(() => {
			this._handleNext();
		});
	}

	_handleNext() {
		if(!this.waiting.length) return;

		const task = this.waiting[0];
		const worker = this.manager.findWorkerForTask(task);
		if(worker) {
			this.waiting.shift();
			this.working.push(task);
			worker.startTask(task);
		}

	}

	static _findByTaskId(queue, taskId) {
		for (let i = 0; i < queue.length; i++) {
			const task = queue[i];
			if (task.id == taskId) return {pos: i, task: task};
		}
		return null;
	}


}
module.exports = MQQueue;
