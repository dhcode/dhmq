/* Created by Dominik Herbst on 2016-04-30 */
'use strict';

const EventEmitter = require('events');
const log = require('dhlog')('DHMQClient');
const SocketIoClient = require('socket.io-client');
const func = require('./func');

/**
 * @extends EventEmitter
 */
class DHMQClient extends EventEmitter {
	constructor(config) {
		super();
		this.config = config;
		/**
		 * @type {Socket}
		 */
		this.io = new SocketIoClient(this.config.url, this.config);

		this.workerHandlers = {};

		this.initEvents();
	}

	initEvents() {
		this.io.on('connect', () => {
			log.debug('connect');
			this.emit('connect');
		});
		this.io.on('connect_error', (err) => {
			log.debug('connect_error', err);
			this.emit('connect_error', err);
		});
		this.io.on('connect_timeout', (err) => {
			log.debug('connect_timeout', err);
			this.emit('connect_timeout', err);
		});
		this.io.on('disconnect', () => {
			this.emit('disconnect');
		});

		this.io.on('startTask', (data) => {
			if(!data) {
				return this.finishTask({error:'invalid_input'});
			}
			if(!data.workerId) {
				return this.finishTask({error:'invalid_workerId'});
			}
			this._handleTask(data.workerId, data.task);
		});
		this.io.on('abortTask', (data) => {

		});
	}

	authenticate(callb) {
		this.io.emit('auth', {
			userId: this.config.userId,
			key: this.config.key
		}, (response) => {
			callb(response);
		});
	}

	registerAsWorker(match, taskHandler) {

		this.io.emit('registerWorker', {
			match: match
		}, (response) => {
			if(response && response.success && response.workerId) {
				this.workerHandlers[response.workerId] = taskHandler;
				this.emit('registeredWorker', response.workerId);
			}

		});
	}

	_handleTask(workerId, task) {
		if(!this.workerHandlers[workerId]) {
			return this.finishTask({error:'unknown_worker', workerId: workerId});
		}
		var handler = this.workerHandlers[workerId];
		handler(task, (data) => {
			this.finishTask(workerId, task, data);
		});

	}


	/**
	 * Called to add a task
	 * @param type
	 * @param data
	 * @param callb
	 */
	addTask(type, data, callb) {
		this.io.emit('addTask', {
			taskId: 'T'+func.randomString(11),
			type: type,
			data: data
		}, (response) => {
			callb(response);
		});
	}

	/**
	 * Called to receive info about a task
	 * @param taskId
	 * @param callb
	 */
	getTaskInfo(taskId, callb) {
		this.io.emit('getTaskInfo', {taskId: taskId}, (response) => {
			callb(response);
		});
	}

	/**
	 * Called to finish a task
	 * @param workerId
	 * @param task
	 * @param data
	 */
	finishTask(workerId, task, data) {

	}

	/**
	 * Called to return a task
	 * @param data
	 */
	returnTask(data) {

	}



}

module.exports = DHMQClient;
