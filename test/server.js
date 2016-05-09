/* Created by Dominik Herbst on 2016-02-17 */

describe('Test server', () => {
	const DHMQServer = require('../lib/server');
	const DHMQClient = require('../lib/client');
	var server = null;
	var client = null;
	var port = 31443;

	it('instantiate', () => {
		server = new DHMQServer({
			host: '',
			port: port
		});
	});

	it('should start', (done) => {
		server.start(done);
	});

	it('should spawn a client', (done) => {
		client = new DHMQClient({
			url: 'http://localhost:' + port
		});
		

	});

	after(() => {
		server.stop();
	});

});
