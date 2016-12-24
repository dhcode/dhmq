/* Created by Dominik Herbst on 2016-02-17 */

const assert = require('assert');
const TestHelper = require('./testHelper');
const fs = require('fs');

describe('Test server', () => {
    const DHMQServer = require('../lib/dhmqServer');
    const DHMQClient = require('../lib/dhmqClient');
    let server = null;
    let client = null;
    let testDirPath = null;

    const serverConfig = {
        secure: false,
        host: '',
        port: 30000 + Math.floor(Math.random() * 10000),
        authProvider: {
            provider: 'dir',
            dirPath: null
        },
        managerInstance: null,
        managerProperties: {}
    };

    const credentials = {
        userId: 'user1',
        key: 'buxdADiwyPB2o0AuuwlD'
    };

    before(() => {
        return TestHelper.createTempFolder().then(folderPath => {
            testDirPath = folderPath;
            serverConfig.authProvider.dirPath = testDirPath + '/auth';
            serverConfig.managerProperties.storagePath = testDirPath + '/queues';
        }).then(() => {
            return TestHelper.writeFile(serverConfig.authProvider.dirPath + '/' + credentials.userId, credentials.key)
        });
    });
    after(() => {
        return TestHelper.removeFolder(testDirPath);
    });

    it('instantiate server', () => {
        server = new DHMQServer(serverConfig);
    });

    it('should start', () => {
        return server.start();
    });

    it('should spawn a client', (done) => {
        client = new DHMQClient({
            transports: ['websocket'],
            url: 'http://localhost:' + serverConfig.port + '/',
            userId: credentials.userId,
            key: credentials.key
        });
        client.on('connect', () => {
            done();
        });
        client.on('connect_error', (err) => {
            done(err);
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

    function abortTaskHandler(taskId) {

    }

    it('should register worker', () => {
        return client.registerAsWorker('^doTest$', testTaskHandler, abortTaskHandler).then((response) => {
            assert.ok(response.workerId);
        });
    });

    it('should add task', () => {
        return client.addTask('doTest', {name: 'Tester'});
    });

    it('should add task and fail', () => {
        return client.addTask('do(T)est', {name: 'Tester'}).catch((err) => {
            console.log('failed', err);
            assert.equal(err.error, 'invalidInput');
        });
    });

    it('should stop', () => {
        return server.stop();
    });

});
