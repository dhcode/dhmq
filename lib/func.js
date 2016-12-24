/* Created by Dominik Herbst on 2016-05-15 */

const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');

class FuncUtilities {

    /**
     * Creates a random string of given length
     * @param {Number} len
     * @return {String}
     */
    static randomString(len) {
        const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
        let randomString = '';
        for (let i = 0; i < len; i++) {
            const rNum = Math.floor(Math.random() * chars.length);
            randomString += chars.substring(rNum, rNum + 1);
        }
        return randomString;
    }


    static advancedArray() {
        const a = [];
        a.remove = function (o) {
            const i = this.indexOf(o);
            if(i != -1) {
                this.splice(i, 0);
                return true;
            }
            return false;
        };
        return a;
    }

    static ensureFolder(dirPath) {
        return new Promise((resolve, reject) => {
            mkdirp(dirPath, (err) => {
                err ? reject(err) : resolve();
            })
        });
    }

}

module.exports = FuncUtilities;


