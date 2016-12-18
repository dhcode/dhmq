/* Created by Dominik Herbst on 2016-02-17 */

const assert = require('assert');

describe('Test server', () => {
	const DHMQServer = require('../lib/server');
	const DHMQClient = require('../lib/client');
	let server = null;
    let client = null;
    const port = 31443;

	it('instantiate', () => {
		server = new DHMQServer({
			secure: false,
			host: '',
			port: port
		});
	});

	it('should start', () => {
		return server.start();
	});

	it('should spawn a client', (done) => {
		client = new DHMQClient({
			transports: ['websocket'],
			url: 'http://localhost:' + port+'/',
			userId: 'user1',
			key: 'buxdADiwyPB2o0AuuwlD'
		});
		client.on('connect', ()=> {
			done();
		});
		client.on('connect_error', (err)=> {
			assert.ifError(err);
		});

	});

	it('should authenticate client', () => {
		return client.authenticate().then((response) => {
			assert.ok(response);
			assert.equal(response.success, true);
		});
	});

	function testTaskHandler(task) {
	    return Promise.resolve('ok');
	}

	it('should register worker', () => {
		return client.registerAsWorker('^doTest$', testTaskHandler).then((response) => {
		    assert.ok(response.workerId);
		});
	});

	it('should add task', () => {
		return client.addTask('doTest', {name: 'Tester'});
	});


	it('should stop', () => {
	    client.disconnect();
		return server.stop();
	});

});
