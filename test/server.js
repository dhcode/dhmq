/* Created by Dominik Herbst on 2016-02-17 */

const assert = require('assert');

describe('Test server', () => {
	const DHMQServer = require('../lib/server');
	const DHMQClient = require('../lib/client');
	var server = null;
	var client = null;
	var port = 31443;

	it('instantiate', () => {
		server = new DHMQServer({
			secure: false,
			host: '',
			port: port
		});
	});

	it('should start', (done) => {
		server.start(done);
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

	it('should authenticate client', (done) => {
		client.authenticate((response) => {
			assert.ok(response);
			assert.equal(response.success, true);
			done();
		});
	});
	

	after(() => {
		server.stop();
	});

});
