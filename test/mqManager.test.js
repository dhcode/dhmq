/* Created by Dominik Herbst on 2016-11-20 */

const assert = require('assert');
const MQManager = require('../lib/mqManager');

describe('Basic Worker and Task work', () => {

    const manager = MQManager.getInstance('test1');
    const task = manager.createTask('test', 'task1');

    let lastTaskToWork = null;

    const worker = manager.createWorker((taskToWork) => {
        lastTaskToWork = taskToWork;
    }, null);

    it('should register worker', () => {
        manager.registerWorker(worker);
        assert.equal(manager.getWorker(worker.id), worker);
    });

    it('should add task', () => {
        const taskInfo = manager.addTask(task);
        assert.equal(taskInfo.state, 'added');
    });

    it('should got work request', () => {
        assert.equal(lastTaskToWork, task);
        const taskInfo = manager.getTaskInfo(task.id);
        assert.equal(taskInfo.state, 'working');
    });

    it('should update task', () => {
        const taskInfo = manager.updateTask(task.id, 'result1');
        assert.equal(taskInfo.state, 'working');
        assert.equal(task.result, 'result1');
        assert.ok(task.updatedAt);
    });

    it('should finish task', () => {
        const taskInfo = manager.finishTask(task.id, 'result2');
        assert.equal(taskInfo.state, 'finished');
        assert.equal(task.result, 'result2');
        assert.ok(task.finishedAt);
    });


});
