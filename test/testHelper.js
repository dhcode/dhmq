/* Created by Dominik Herbst on 2016-12-04 */

class TestHelper {

    static getWorkingTaskInfo(manager, taskId) {
        return new Promise((resolve, reject) => {
            const taskInfo = manager.getTaskInfo(taskId);
            if(taskInfo.state == 'working') {
                return resolve(taskInfo);
            }
            if(taskInfo.state == 'waiting') {
                return TestHelper.oneEventForTask(manager, 'taskStarted', taskId);
            }
            reject();
        });
    }

    static getFinishedTaskInfo(manager, taskId) {
        return new Promise((resolve, reject) => {
            const taskInfo = manager.getTaskInfo(taskId);
            if(taskInfo.state == 'finished') {
                return resolve(taskInfo);
            }
            if(taskInfo.state == 'waiting' || taskInfo.state == 'working') {
                return resolve(TestHelper.oneEventForTask(manager, 'taskFinished', taskId));
            }
            reject();
        });
    }

    static oneEventForTask(manager, event, taskId) {
        return new Promise((resolve, reject) => {
            const listener = function(taskInfo) {
                if(taskInfo.task.id == taskId) {
                    manager.removeListener(event, listener);
                    resolve(taskInfo);
                }
            };
            manager.on(event, listener);
        });
    }

}

module.exports = TestHelper;
