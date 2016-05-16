/* Created by Dominik Herbst on 2016-05-14 */
'use strict';

class MQQueue {
	constructor(queueId) {
		this.queueId = queueId;
		this.state = 'detached'; // detached, attached, running, paused

		/**
		 * @type {?MQManager}
		 */
		this.manager = null;
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

	addTask(task) {
		
	}
	
	handleNext() {
		
	}
	
	
	
}
module.exports = MQQueue;
