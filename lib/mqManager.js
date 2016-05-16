/* Created by Dominik Herbst on 2016-05-14 */
'use strict';

const log = require('dhlog')('MQManager');
const _instances = {};

class MQManager {
	constructor() {
		this.workers = [];
		this.queues = [];
	}

	registerWorker(worker) {
		this.workers.push(worker);

	}

	removeWorkersByClient(serverClient) {
		for (var i = 0; i < this.workers.length; i++) {
			var w = this.workers[i];
			if(w.io == serverClient) {
				this.workers.splice(i, 1);
				i--;
			}
		}
	}

	getWorker(id) {
	}

	addTask(task) {

	}

	getTask(id) {

	}

	findWorkerForTask(task) {

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
