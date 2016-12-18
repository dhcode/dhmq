/* Created by Dominik Herbst on 2016-11-20 */

const assert = require('assert');
const fs = require('fs');
const TestHelper = require('./testHelper');
const MQManager = require('../lib/mqManager');

let instanceIndex = 0;

function initManagerOptions() {
    const options = {storagePath: null};
    before(() => {
        return TestHelper.createTempFolder().then(folderPath => {
            options.storagePath = folderPath;
        });
    });
    after(() => {
        return TestHelper.removeFolder(options.storagePath);
    });
    return options;
}

describe('Basic Task work', () => {
    let manager, queue, task, worker;

    const options = initManagerOptions();

    it('get manager instance', () => {
        return MQManager.getInstance('test' + (instanceIndex++), options).then((m) => {
            manager = m;
            queue = manager.getQueue('test');
            queue.finishedCleanupTime = 0;

            task = manager.createTask('test', 'task1');
            worker = TestHelper.createTestWorker(manager);

        });
    });

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
    let manager, task, worker;

    const options = initManagerOptions();

    it('get manager instance', () => {
        return MQManager.getInstance('test' + (instanceIndex++), options).then((m) => {
            manager = m;
            task = manager.createTask('test', 'task1');
            worker = TestHelper.createTestWorker(manager);

        });
    });

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
    let manager, task, worker;

    const options = initManagerOptions();

    it('get manager instance', () => {
        return MQManager.getInstance('test' + (instanceIndex++), options).then((m) => {
            manager = m;
            task = manager.createTask('test', 'task1');
            worker = TestHelper.createTestWorker(manager);

        });
    });

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

    it('return task', () => {
        const taskInfo = manager.returnTask(task.id);
        assert.equal(taskInfo.state, 'waiting');
        assert.equal(taskInfo.pos, 0);
        assert.equal(worker.currentTask, null);
        assert.equal(worker.state, 'waiting');
    });

});

describe('Check queue stats', () => {
    const finishedTasks = [];
    let manager, task, worker1, worker2, queue;

    const options = initManagerOptions();

    it('get manager instance', () => {
        return MQManager.getInstance('test' + (instanceIndex++), options).then((m) => {
            manager = m;
            task = manager.createTask('test', 'task1');
            queue = manager.getQueue('test');
            queue.finishedCleanupTime = 0;
            worker1 = manager.createWorker((task) => {
                manager.finishTask(task.id, 'ok');
            }, null);
            worker2 = manager.createWorker((task) => {
                manager.finishTask(task.id, 'ok');
            }, null);

        });
    });

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
            assert.equal(stats.aborted, 0);
        });

    });

});


describe('Shutdown and restore', () => {
    let manager, queue1, queue2, worker1, worker2;
    let workTasks = 5;

    const options = initManagerOptions();

    it('get manager instance', () => {
        return MQManager.getInstance('test' + (instanceIndex++), options).then((m) => {
            manager = m;
            queue1 = manager.getQueue('test1');
            queue2 = manager.getQueue('test2');

            worker1 = manager.createWorker((task) => {
                manager.finishTask(task.id, 'ok');
            }, null);
            worker1.typeMatcher = /^test1$/;

            // Worker that finishes only the first 5 tasks
            worker2 = manager.createWorker((task) => {
                if (workTasks-- > 0) {
                    manager.finishTask(task.id, 'ok');
                }
            }, null);
            worker2.typeMatcher = /^test2$/;

        });
    });

    it('register workers', () => {
        manager.registerWorker(worker1);
        manager.registerWorker(worker2);
    });

    it('add 10 tasks in queue 1', () => {
        const finishedTasks = [];
        for (let i = 0; i < 10; i++) {
            const task = manager.createTask('test1', 't1-' + i);
            const taskInfo = manager.addTask(task);
            assert.equal(taskInfo.state, 'added');
            finishedTasks.push(TestHelper.getFinishedTaskInfo(manager, task.id));
        }
        return Promise.all(finishedTasks);
    });

    it('add 100 tasks in queue 2', () => {
        const finishedTasks = [];
        for (let i = 0; i < 100; i++) {
            const task = manager.createTask('test2', 't2-' + i);
            const taskInfo = manager.addTask(task);
            assert.equal(taskInfo.state, 'added');
            if (i < workTasks) {
                finishedTasks.push(TestHelper.getFinishedTaskInfo(manager, task.id));
            }
        }
        return Promise.all(finishedTasks);
    });

    it('queues have correct stats', () => {
        let stats = queue1.getStats();
        assert.equal(stats.queued, 10);
        assert.equal(stats.aborted, 0);
        assert.equal(stats.waiting, 0);
        assert.equal(stats.working, 0);
        assert.equal(stats.finished, 10);

        stats = queue2.getStats();
        assert.equal(stats.queued, 100);
        assert.equal(stats.aborted, 0);
        assert.equal(stats.waiting, 94);
        assert.equal(stats.working, 1);
        assert.equal(stats.finished, 5);
    });

    it('shutdown', () => {
        assert.equal(manager.state, 'running');
        assert.equal(queue1.state, 'running');
        assert.equal(queue2.state, 'running');

        const p = manager.shutdown().then(() => {
            assert.equal(manager.state, 'paused');
            assert.equal(queue1.state, 'paused');
            assert.equal(queue2.state, 'paused');
        });
        assert.equal(manager.state, 'saving');

        manager.abortTask('t2-5');

        return p;
    });

    it('check serialized files', () => {
        return Promise.all([
            TestHelper.statPath(manager.storagePath+'/test1').then((stats) => {
                assert.equal(stats.isFile(), true);
            }),
            TestHelper.statPath(manager.storagePath+'/test2').then((stats) => {
                assert.equal(stats.isFile(), true);
            })
        ]);
    });

    it('restore manager', () => {
        return MQManager.getInstance('test' + (instanceIndex++), options).then((m) => {
            assert.equal(m.state, 'running');

            let stats = m.getQueue('test1').getStats();
            assert.equal(stats.queued, 10);
            assert.equal(stats.aborted, 0);
            assert.equal(stats.waiting, 0);
            assert.equal(stats.finished, 10);

            stats = m.getQueue('test2').getStats();
            assert.equal(stats.queued, 100);
            assert.equal(stats.aborted, 1);
            assert.equal(stats.waiting, 94);
            assert.equal(stats.working, 0);
            assert.equal(stats.finished, 5);

            manager = m;

        });
    });

    it('register worker', () => {
        const worker = TestHelper.createTestWorker(manager);
        const task = manager.getQueue('test2').waiting[0];
        worker.expectingTask(manager.getQueue('test2').waiting[0]);

        manager.registerWorker(worker);

        return worker.hasReceivedExpectedTask().then((receivedTask) => {
            assert.equal(receivedTask, task);
            assert.equal(worker.currentTask, task);
            assert.equal(worker.state, 'busy');
            const taskInfo = manager.getTaskInfo(task.id);
            assert.equal(taskInfo.state, 'working');
        });
    });


});
