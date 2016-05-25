/* Created by Dominik Herbst on 2016-05-14 */
'use strict';

class MQQueue {
	constructor(queueId) {
		this.queueId = queueId;
		this.state = 'detached'; // detached, attached, running, paused

		this.limit = 1000;

		/**
		 * @type {?MQManager}
		 */
		this.manager = null;

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
		var taskInfo = this.getTaskInfo(task.id);
		if(taskInfo.state != 'none') {
			return taskInfo;
		}

		if(this.waiting.length > this.limit) {
			return {state: 'full'};
		}

		task.setQueue(this);

		var pos = this.waiting.length;
		this.waiting.push(task);

		this._tryHandleNext();
		return {state: 'added', pos: pos, task: task};
	}

	getTaskInfo(taskId) {
		var taskInfo;
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

	_tryHandleNext() {
		process.nextTick(() => {
			this._handleNext();
		});
	}

	_handleNext() {

	}

	static _findByTaskId(queue, taskId) {
		for (var i = 0; i < queue.length; i++) {
			var task = queue[i];
			if (task.id == taskId) return {pos: i, task: task};
		}
		return null;
	}


}
module.exports = MQQueue;
