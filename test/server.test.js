/* Created by Dominik Herbst on 2016-02-17 */

const assert = require('assert');
const TestHelper = require('./testHelper');
const fs = require('fs');

describe('Test server', () => {
    const DHMQServer = require('../lib/dhmqServer');
    const DHMQClient = require('../lib/dhmqClient');
    let server = null;
    let client = null, client2 = null;
    let testDirPath = null;

    const credentials = {
        userId: 'user1',
        key: 'buxdADiwyPB2o0AuuwlD'
    };

    const serverConfig = {
        secure: false,
        host: '',
        port: 30000 + Math.floor(Math.random() * 10000),
        authProvider: {
            provider: 'dir', // dir or env
            dirPath: null,
            defaultId: credentials.userId,
            defaultSecret: credentials.key
        },
        managerInstance: null,
        managerProperties: {}
    };



    let taskId;

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

    it('should spawn a client', () => {
        client = new DHMQClient({
            transports: ['websocket'],
            url: 'http://localhost:' + serverConfig.port + '/',
            userId: credentials.userId,
            key: credentials.key
        });
        return client.connect();
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
        return client.addTask('doTest', {name: 'Tester'}).then((taskInfo) => {
            assert.ok(taskInfo.task.id);
            taskId = taskInfo.task.id;
        });
    });

    it('should watch task', (done) => {
        client.watchTask(taskId, (taskInfo) => {
            assert.equal(taskInfo.task.id, taskId);
            if(taskInfo.state == 'finished') {
                done();
            }
        });
    });

    it('should add task and fail', () => {
        return client.addTask('do(T)est', {name: 'Tester'}).catch((err) => {
            console.log('failed', err);
            assert.equal(err.error, 'invalidInput');
        });
    });

    it('should spawn a second client', () => {
        client2 = new DHMQClient({
            transports: ['websocket'],
            url: 'http://localhost:' + serverConfig.port + '/',
            userId: credentials.userId,
            key: credentials.key
        });
        return client2.connect();
    });

    it('should authenticate second client', () => {
        return client2.authenticate().then((response) => {
            assert.ok(response);
            assert.equal(response.success, true);
        });
    });

    it('should broadcast a message from client 1 to 2', (done) => {
        client2.onceMessage('testMessage', (msg) => {
            assert.equal(msg.value, 'test');
            done();
        });

        client.sendMessage(null, 'testMessage', {value: 'test'});
    });

    it('should join a room', () => {
        return client2.joinRoom('testRoom').then((response) => {
            assert.equal(response.success, true);
        });
    });

    it('should send a message to room', (done) => {
        client2.onceMessage('testRoomMessage', (msg) => {
            assert.equal(msg.value, 'test');
            done();
        });

        client.sendMessage('testRoom', 'testRoomMessage', {value: 'test'});
    });

    it('should stop', () => {
        return server.stop();
    });

});
