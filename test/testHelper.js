/* Created by Dominik Herbst on 2016-12-04 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const func = require('../lib/func');
const exec = require('child_process').exec;
const MQWorker = require('../lib/mqWorker');
const Writable = require('stream').Writable;
const Readable = require('stream').Readable;

class TestHelper {

    static getWorkingTaskInfo(manager, taskId) {
        return new Promise((resolve, reject) => {
            const taskInfo = manager.getTaskInfo(taskId);
            if (taskInfo.state == 'working') {
                return resolve(taskInfo);
            }
            if (taskInfo.state == 'waiting') {
                return TestHelper.oneEventForTask(manager, 'taskStarted', taskId);
            }
            reject();
        });
    }

    static getFinishedTaskInfo(manager, taskId) {
        return new Promise((resolve, reject) => {
            const taskInfo = manager.getTaskInfo(taskId);
            if (taskInfo.state == 'finished') {
                return resolve(taskInfo);
            }
            if (taskInfo.state == 'waiting' || taskInfo.state == 'working') {
                return resolve(TestHelper.oneEventForTask(manager, 'taskFinished', taskId));
            }
            reject();
        });
    }

    static createTestWorker(manager) {
        let expectedTask = null;
        let expectedAbort = false;
        let waitingForWork = null;
        let waitingForAbort = null;
        let expectedTaskReceived = null;
        const worker = manager.createWorker((taskToWork) => {
            if (expectedTask && expectedTask.id == taskToWork.id) {
                if (waitingForWork) {
                    waitingForWork(taskToWork);
                    waitingForWork = null;
                } else {
                    expectedTaskReceived = taskToWork;
                }
                expectedTask = null;
            }

        }, () => {
            if (expectedAbort) {
                if (waitingForAbort) {
                    waitingForAbort();
                    waitingForAbort = null;
                }
                expectedAbort = false;

            }
        });

        worker.expectingTask = function (task) {
            expectedTask = task;
        };

        worker.hasReceivedExpectedTask = function () {
            if (!expectedTask && expectedTaskReceived) {
                const result = Promise.resolve(expectedTaskReceived);
                expectedTaskReceived = null;
                return result;
            } else if (!expectedTask) {
                return Promise.reject(new Error('No task expected in worker'));
            }
            return new Promise((resolve) => {
                waitingForWork = resolve;
            });
        };

        worker.expectingAbort = function () {
            expectedAbort = true;
        };

        worker.hasReceivedExpectedAbort = function () {
            if (!expectedAbort) return Promise.resolve();
            return new Promise((resolve) => {
                waitingForAbort = resolve;
            });
        };

        return worker;
    }

    static oneEventForTask(manager, event, taskId) {
        return new Promise((resolve) => {
            const listener = function (taskInfo) {
                if (taskInfo.task.id == taskId) {
                    manager.removeListener(event, listener);
                    resolve(taskInfo);
                }
            };
            manager.on(event, listener);
        });
    }

    static getMockManagerAndWorker() {
        const manager = {
            findWorkerForTask: function (task) {
                if (worker.isFree()) return worker;
                return null;
            },
            startTask: function (worker, taskInfo) {
                worker.startTask(taskInfo.task);
            },
            createWorker(startCallback, abortCallback) {
                return new MQWorker('Wtest', startCallback, abortCallback);
            }
        };

        const worker = TestHelper.createTestWorker(manager);

        return {manager: manager, worker: worker};
    }

    static getWriteStreamBuffer() {
        const writable = new Writable({
            write(chunk, encoding, callback) {
                writable.calls++;
                writable.cachedLines.push(chunk);
                callback();
            },
        });
        writable.calls = 0;
        writable.cachedLines = [];
        return writable;
    }

    static getReadStreamBuffer(lines) {
        const data = lines.join('');
        const readable = new Readable({
            read(size) {
                if (readable.index >= data.length) {
                    return this.push(null);
                }
                const part = data.substring(readable.index, readable.index + size);
                readable.index += part.length;
                this.push(part);
            },
        });
        readable.index = 0;
        return readable;
    }

    static createTempFolder() {
        return new Promise((resolve, reject) => {
            fs.mkdtemp('test-', (err, dirPath) => {
                err ? reject(err) : resolve(dirPath);
            });
        });
    }

    static removeFolder(path) {
        return new Promise((resolve, reject) => {
            let p;
            if (os.platform() == 'win32') {
                p = exec('rmdir /s /q "' + path + '"');
            } else {
                p = exec('rm -rf "' + path + '"');
            }
            p.on('close', (code) => {
                code == 0 ? resolve() : reject();
            });
            p.on('error', (err) => {
                reject(err);
            });
        });
    }

    static statPath(fsPath) {
        return new Promise((resolve, reject) => {
            fs.stat(fsPath, (err, stats) => {
                err ? reject(err) : resolve(stats);
            });
        });
    }

    static writeFile(filePath, content) {
        const dir = path.dirname(filePath);
        return func.ensureFolder(dir).then(() => {
            return new Promise((resolve, reject) => {
                fs.writeFile(filePath, content, (err) => {
                    err ? reject(err) : resolve();
                });
            });
        });
    }

}

module.exports = TestHelper;
