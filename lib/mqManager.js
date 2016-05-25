/* Created by Dominik Herbst on 2016-05-14 */
'use strict';

const log = require('dhlog')('MQManager');
const _instances = {};
const MQQueue = require('./mqQueue');

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

	removeWorkersByClient(serverClient) {
		for (var i = 0; i < this.workers.length; i++) {
			var w = this.workers[i];
			if (w.io == serverClient) {
				this.workers.splice(i, 1);
				i--;
			}
		}
	}

	getWorker(id) {
	}

	/**
	 * Adds a task to a queue
	 * @param {MQTask} task
	 */
	addTask(task) {
		if (this.state != 'running') {
			return {error: 'manager_not_running'};
		}

		var type = task.getType();
		var queue = this.getQueue(type);
		return queue.addTask(task);
	}

	getTask(id) {

	}

	findWorkerForTask(task) {

	}

	/**
	 * Returns a matching queue
	 * @param queueId
	 * @returns MQQueue
	 */
	getQueue(queueId) {
		var queues = this.queues.filter((q) => q.id == queueId);
		if (queues.length) return queues[0];

		var queue = new MQQueue(queueId);
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
	 * @param [instanceId]
	 * @returns {MQManager}
	 */
	static getInstance(instanceId) {
		if (!instanceId) instanceId = 'default';
		if (!_instances[instanceId])
			_instances[instanceId] = new MQManager();
		return _instances[instanceId];
	}

}
module.exports = MQManager;
