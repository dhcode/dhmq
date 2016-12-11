/* Created by Dominik Herbst on 2016-11-20 */

const assert = require('assert');
const TestHelper = require('./testHelper');
const MQManager = require('../lib/mqManager');

describe('Basic Task work', () => {

    const manager = MQManager.getInstance('test1');
    const task = manager.createTask('test', 'task1');
    const queue = manager.getQueue('test');
    queue.finishedCleanupTime = 0;

    const worker = TestHelper.createTestWorker(manager);

    it('register worker', () => {
        manager.registerWorker(worker);
        assert.equal(manager.getWorker(worker.id), worker);
    });

    it('add task', () => {
        worker.expectingTask(task);
        const taskInfo = manager.addTask(task);
        assert.equal(taskInfo.state, 'added');
    });

    it('worker got work request', () => {
        return worker.hasReceivedExpectedTask().then((receivedTask) => {
            assert.equal(receivedTask, task);
            assert.equal(worker.currentTask, task);
            assert.equal(worker.state, 'busy');
            const taskInfo = manager.getTaskInfo(task.id);
            assert.equal(taskInfo.state, 'working');
        });
    });

    it('update task', () => {
        const taskInfo = manager.updateTask(task.id, 'result1');
        assert.equal(taskInfo.state, 'working');
        assert.equal(task.result, 'result1');
        assert.equal(worker.currentTask, task);
        assert.equal(worker.state, 'busy');
        assert.ok(task.updatedAt);
    });

    it('finish task', () => {
        const taskInfo = manager.finishTask(task.id, 'result2');
        assert.equal(taskInfo.state, 'finished');
        assert.equal(task.result, 'result2');
        assert.equal(worker.currentTask, null);
        assert.equal(worker.state, 'waiting');
        assert.ok(task.finishedAt);
    });

    it('cleanup', () => {
        const taskInfoBefore = manager.getTaskInfo(task.id);
        assert.equal(taskInfoBefore.state, 'finished');
        manager.runPeriodicCheck();

        const taskInfoAfter = manager.getTaskInfo(task.id);
        assert.equal(taskInfoAfter.state, 'none');

    });

});

describe('Abort Task work', () => {

    const manager = MQManager.getInstance('test2');
    const task = manager.createTask('test', 'task1');

    const worker = TestHelper.createTestWorker(manager);

    it('register worker', () => {
        manager.registerWorker(worker);
        assert.equal(manager.getWorker(worker.id), worker);
    });

    it('add task', () => {
        worker.expectingTask(task);
        const taskInfo = manager.addTask(task);
        assert.equal(taskInfo.state, 'added');
    });

    it('got work request', () => {
        return worker.hasReceivedExpectedTask().then((receivedTask) => {
            assert.equal(receivedTask, task);
            assert.equal(worker.currentTask, task);
            assert.equal(worker.state, 'busy');
            const taskInfo = manager.getTaskInfo(task.id);
            assert.equal(taskInfo.state, 'working');
        });
    });

    it('abort task', () => {
        worker.expectingAbort();
        const taskInfo = manager.abortTask(task.id);
        assert.equal(taskInfo.state, 'finished');
        assert.equal(worker.currentTask, null);
        assert.equal(worker.state, 'waiting');

    });

    it('got abort request', () => {
        worker.hasReceivedExpectedAbort().then(() => {
            assert.equal(worker.currentTask, null);
            assert.equal(worker.state, 'waiting');
        });
    });


});

describe('Return Task work', () => {

    const manager = MQManager.getInstance('test3');
    const task = manager.createTask('test', 'task1');

    let lastTaskToWork = null;

    const worker = manager.createWorker((taskToWork) => {
        lastTaskToWork = taskToWork;
    }, null);

    it('register worker', () => {
        manager.registerWorker(worker);
        assert.equal(manager.getWorker(worker.id), worker);
    });

    it('add task', () => {
        const taskInfo = manager.addTask(task);
        assert.equal(taskInfo.state, 'added');
    });

    it('got work request', () => {
        assert.equal(lastTaskToWork, task);
        assert.equal(worker.currentTask, task);
        assert.equal(worker.state, 'busy');
        const taskInfo = manager.getTaskInfo(task.id);
        assert.equal(taskInfo.state, 'working');
    });

    it('return task', () => {
        const taskInfo = manager.returnTask(task.id);
        assert.equal(taskInfo.state, 'waiting');
        assert.equal(taskInfo.pos, 0);
        assert.equal(worker.currentTask, null);
        assert.equal(worker.state, 'waiting');
    });

});

describe('Check queue stats', () => {
    const manager = MQManager.getInstance('test4');
    const queue = manager.getQueue('test');
    queue.finishedCleanupTime = 0;

    const finishedTasks = [];

    const worker1 = manager.createWorker((task) => {
        manager.finishTask(task.id, 'ok');
    }, null);
    const worker2 = manager.createWorker((task) => {
        manager.finishTask(task.id, 'ok');
    }, null);

    it('register worker', () => {
        manager.registerWorker(worker1);
        manager.registerWorker(worker2);
        assert.equal(manager.getWorker(worker1.id), worker1);
        assert.equal(manager.getWorker(worker2.id), worker2);
    });

    it('work 1000 tasks', () => {
        for (let i = 0; i < 1000; i++) {
            const task = manager.createTask('test', 't' + i);
            const taskInfo = manager.addTask(task);
            assert.equal(taskInfo.state, 'added');
            finishedTasks.push(TestHelper.getFinishedTaskInfo(manager, task.id));
        }
    });

    it('should have worked the tasks', () => {
        const allPromise = Promise.all(finishedTasks);
        return allPromise.then((taskInfoList) => {
            for (const taskInfo of taskInfoList) {
                assert.equal(taskInfo.state, 'finished', taskInfo.task.id + ' should be finished');
            }

            const stats = queue.getStats();
            assert.equal(stats.queued, 1000);
            assert.equal(stats.finished, 1000);
        });

    });

});

describe('Check queue stats', () => {


});
