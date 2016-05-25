/* Created by Dominik Herbst on 2016-05-14 */
'use strict';

class MQTask {
	constructor(type, id) {
		this.type = type;
		this.id = id;

		this.state = 'created'; // created, queued, working, finished
		this.result = null;

		this.queue = null;
	}

	getId() {
		return this.id;
	}

	getType() {
		return this.type;
	}

	setQueue(queue) {
		this.queue = queue;
		this._setStateQueued();
	}

	_setStateQueued() {
		this.state = 'queued';
	}
	_setStateWorking() {
		this.state = 'working';
	}
	_setStateFinished() {
		this.state = 'finished';
	}



}
module.exports = MQTask;
