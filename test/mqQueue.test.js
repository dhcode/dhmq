/* Created by Dominik Herbst on 2016-12-10 */

const MQQueue = require('../lib/mqQueue');
const MQTask = require('../lib/mqTask');
const assert = require('assert');
const TestHelper = require('./testHelper');
const ldj = require('ldjson-stream');

describe('MQQueue', () => {

    const {manager, worker} = TestHelper.getMockManagerAndWorker();

    const queue = new MQQueue('test');
    queue.limit = 10;
    queue.setManager(manager);

    queue.start();

    let restoredQueue = null;
    let cachedLines = null;

    it('add tasks', () => {
        worker.expectingTask({id: 't0'});
        for (let i = 0; i < 10; i++) {
            const task = new MQTask('test', 't' + i);
            queue.addTask(task);
        }
    });

    it('worker got first task', () => {
        return worker.hasReceivedExpectedTask().then((receivedTask) => {
            assert.equal(worker.state, 'busy');
        });
    });

    it('pause queue waits for last task', () => {

        const promise = queue.pause();

        setTimeout(() => {
            queue.finishTask(worker.currentTask.id, 'done', 'success');
            worker.onFinishedTask();

        }, 10);

        return promise.then(() => {
            assert.equal(queue.state, 'paused');
            assert.equal(queue.waiting.length, 9);
            assert.equal(queue.finished.length, 1);
            assert.equal(queue.working.length, 0);

        });

    });

    it('can\'t add task to paused queue', () => {
        const task = new MQTask('test', 'taskNeverAdds');
        const taskInfo = queue.addTask(task);
        assert.equal(taskInfo.state, 'inactive');
    });

    it('serialize queue', () => {
        const myWritable = TestHelper.getWriteStreamBuffer();
        const objectStream = ldj.serialize();
        objectStream.pipe(myWritable);

        return queue.serializeQueue(objectStream).then(() => {
            cachedLines = myWritable.cachedLines;
            const q = JSON.parse(cachedLines[0]);
            assert.equal(q.id, queue.id);
            assert.equal(q.state, 'paused');
            assert.deepEqual(q.stats, queue.stats);
            assert.equal(myWritable.calls, 10);
        });

    });

    it('deserialize queue', () => {
        const myReadable = TestHelper.getReadStreamBuffer(cachedLines);
        const objectStream = ldj.parse();
        myReadable.pipe(objectStream);

        return MQQueue.fromSerialized(objectStream).then(q => {
            assert.equal(q.id, queue.id);
            assert.equal(q.state, 'paused');
            assert.equal(q.manager, null);
            assert.deepEqual(q.stats, queue.stats);
            restoredQueue = q;
            restoredQueue.setManager(manager);
        });
    });

    it('resume queue', () => {
        worker.expectingTask({id: 't1'});
        restoredQueue.start();
        assert(restoredQueue.state, 'running');
    });

    it('worker got second task', () => {
        return worker.hasReceivedExpectedTask().then((receivedTask) => {
            assert.equal(worker.state, 'busy');
        });
    });

    it('add tasks to hit queue limit', () => {
        let taskInfo;
        taskInfo = restoredQueue.addTask(new MQTask('test', 'tx'));
        assert.equal(taskInfo.state, 'added');
        assert.equal(taskInfo.pos, 8);

        taskInfo = restoredQueue.addTask(new MQTask('test', 'ty'));
        assert.equal(taskInfo.state, 'added');
        assert.equal(taskInfo.pos, 9);

        taskInfo = restoredQueue.addTask(new MQTask('test', 'tz'));
        assert.equal(taskInfo.state, 'full');
    });


});
