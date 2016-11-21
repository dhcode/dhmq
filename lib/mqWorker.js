/* Created by Dominik Herbst on 2016-05-14 */
'use strict';

/**
 * Represents a worker for the MQManager.
 * Gets registered with the MQManager
 */
class MQWorker {
	constructor(workerId, startCallback, abortCallback) {
		this.id = workerId;
		this.currentTask = null;
		this.state = 'waiting'; // waiting, busy, disconnected, suspended

        this._startTask = startCallback;
        this._abortTask = abortCallback;
	}

	/**
	 * Called from the MQQueue to start a task
	 * @param task
	 */
	startTask(task) {
		this._setStateBusy();
		this.currentTask = task;

		task.setWorker(this);

        if(this._startTask) {
            this._startTask(task);
        }

	}

	/**
	 * Called from MQQueue to abort the currently running task
	 */
	abortTask() {
		if (!this.currentTask) return;

        if(this._abortTask) {
            this._abortTask(this.currentTask);
        }

        this.currentTask = null;
        this._setStateWaiting();

	}

    /**
     * Called by the MQManager to check if this worker can work the given task
     * @param {MQTask} task
     * @returns {boolean}
     */
	canWork(task) {
		return task.id.match(this.matcher) ? true : false;
	}

    /**
     * Called from the MQManager to see if this worker is free
     * @returns {boolean}
     */
	isFree() {
		return this.state == 'waiting';
	}

    /**
     * Called from the MQManager when this worker is removed.
     */
	remove() {

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
