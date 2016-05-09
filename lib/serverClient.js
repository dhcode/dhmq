/* Created by Dominik Herbst on 2016-02-12 */

const config = require('./config');
const authProvider = require('./authProvider')(config.authProvider);

/**
 * Handles all the requests from one connected client
 */
class DHMQServerClient {

	/**
	 *
	 * @param {DHMQServer} server
	 * @param {Socket} client
	 */
	constructor(server, client) {

		/**
		 * @type {DHMQServer}
		 */
		this.server = server;

		/**
		 * @type {Socket}
		 */
		this.client = client;

		/**
		 * @type {string}
		 */
		this.state = 'init'; // init, authRequested, authFailed, ready, shutdown, disconnected

		this.initEvents();
	}

	initEvents() {

		this.client.on('auth', this.auth.bind(this));
		this.client.on('registerWorker', this.registerWorker.bind(this));
		this.client.on('removeWorker', this.removeWorker.bind(this));
		this.client.on('getStats', this.getStats.bind(this));
		this.client.on('pushTask', this.pushTask.bind(this));
		this.client.on('getTaskInfo', this.getTaskInfo.bind(this));

	}

	auth(data, respond) {

	}

	registerWorker(data, respond) {

	}

	removeWorker(data, respond) {

	}

	getStats(data, respond) {

	}

	pushTask(data, respond) {

	}

	getTaskInfo(data, respond) {

	}

}

module.exports = DHMQServerClient;

