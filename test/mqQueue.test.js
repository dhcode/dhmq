/* Created by Dominik Herbst on 2016-12-10 */

const MQQueue = require('../lib/mqQueue');
const MQTask = require('../lib/mqTask');
const assert = require('assert');
const TestHelper = require('./testHelper');
const ldj = require('ldjson-stream');
const Writable = require('stream').Writable;

describe('MQQueue', () => {

    const {manager, worker} = TestHelper.getMockManagerAndWorker();

    const queue = new MQQueue('test');
    queue.setManager(manager);

    queue.start();

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
            queue.finishTask(worker.currentTask.id, 'done');
        }, 10);

        return promise.then(() => {
            assert.equal(queue.state, 'paused');
            assert.equal(queue.waiting.length, 9);
            assert.equal(queue.finished.length, 1);
            assert.equal(queue.working.length, 0);

        });

    });

    it('serialize queue', () => {
        let calls = 0;
        const myWritable = new Writable({
            write(chunk, encoding, callback) {
                calls++;
                console.log('queue: '+chunk);
                callback();
            },
        });
        const objectStream = ldj.serialize();
        objectStream.pipe(myWritable);

        return queue.serializeQueue(objectStream).then(() => {
            return queue.serializeWaiting(objectStream);
        }).then(() => {
            assert.equal(calls, 10);
        });

    });


});
