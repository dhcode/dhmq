/* Created by Dominik Herbst on 2016-05-14 */
'use strict';

/**
 * Represents a worker on the server side.
 * Life cycle is managed by the MQServerClient.
 * Gets registered with the MQManager
 */
class MQWorker {
	constructor(serverClient, workerId, matcher) {
		this.serverClient = serverClient;
		this.io = serverClient.io;
		this.id = workerId;
		this.matcher = matcher;

		this.currentTask = null;

		this.state = 'waiting'; // waiting, busy, disconnected, suspended
	}

	init() {
		this.io.on('finishedTask', this.onFinishedTask.bind(this));
		this.io.on('returnTask', this.onReturnTask.bind(this));


	}


	/**
	 * Called from the MQQueue to start a task
	 * @param task
	 */
	startTask(task) {
		this._setStateBusy();
		this.currentTask = task;

		var data = {
			workerId: this.id,
			task: task
		};
		this.io.emit('startTask', data);

	}

	/**
	 * Called from MQQueue to abort the currently running task
	 */
	abortTask() {
		if (!this.currentTask) return;

		this.io.emit('abortTask', {
			taskId: this.currentTask.id
		});
	}

	canWork(task) {
		return task.getId().match(this.matcher);
	}

	isFree() {
		return this.state == 'waiting';
	}

	_setStateWaiting() {
		this.state = 'waiting';
	}

	_setStateBusy() {
		this.state = 'busy';
	}

	_setStateDisconnected() {
		this.state = 'disconnected';
	}

	_setStateSuspended() {
		this.state = 'suspended';
	}

	/**
	 * Called from the worker client to finish the task
	 * @param data
	 */
	onFinishedTask(data) {

		this.currentTask = null;
		this._setStateWaiting();

	}

	/**
	 * Called from the worker to return the task
	 * @param data
	 */
	onReturnTask(data) {

		this.currentTask = null;
		this._setStateWaiting();
	}

}
module.exports = MQWorker;
