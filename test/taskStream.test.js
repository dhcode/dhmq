/* Created by Dominik Herbst on 2016-12-10 */

const assert = require('assert');
const MQTask = require('../lib/mqTask');
const ldj = require('ldjson-stream');
const Writable = require('stream').Writable;


const myWritable = new Writable({
    write(chunk, encoding, callback) {
        console.log('l: '+chunk);
        callback();
    },
});

describe('Task stream', () => {
    const tasks = [];
    for (let i = 0; i < 10; i++) {
        const task = new MQTask('tesTask', 't' + i);
        tasks.push(task);
    }

    it('should write tasks', () => {

        const jsonLineWriter = ldj.serialize();
        jsonLineWriter.pipe(myWritable);
        jsonLineWriter.on('finish', () => {
            console.log('finish');
        });
        jsonLineWriter.on('close', () => {
            console.log('close');
        });

        tasks.forEach(t => jsonLineWriter.write(t));
        jsonLineWriter.end();

    });

});

