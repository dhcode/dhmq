/* Created by Dominik Herbst on 2016-05-15 */

const path = require('path');
const fs = require('fs');

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
            this.splice(i, 0);
        };
        return a;
    }

    static ensureFolder(dirPath) {
        const dirName = path.dirname(dirPath);
        let p = Promise.resolve();
        if (dirName != '.' && dirName != '/') {
            p = p.then(FuncUtilities.ensureFolder(dirName));
        }
        return p.then(() => new Promise((resolve, reject) => {
            fs.stat(dirPath, (err, stat) => {
                if (err || !stat.isDirectory()) reject();
                else resolve();
            });
        })).then(null, () => new Promise((resolve, reject) => {
            fs.mkdir(dirPath, (err) => {
                if (err) reject(err);
                resolve();
            });
        }));

    }

}

module.exports = FuncUtilities;


