/* Created by Dominik Herbst on 2016-05-09 */
'use strict';

const log = require('dhlog').forModule(module);
const fs = require('fs');
const path = require('path');

class AuthProvider {
    constructor(config) {
        this.provider = config.provider;
        if (this.provider == 'dir') {
            this._dirPath = config.dirPath;
        }

    }

    identify(id, secret) {
        if (this.provider == 'dir') {
            return this._identifyByDir(id, secret);
        } else {
            log.error('Unknown auth provider ' + this.provider);
            return Promise.reject(new Error('unknownAuthProvider'));
        }
    }

    _identifyByDir(id, secret) {
        return new Promise((resolve, reject) => {
            if (typeof(id) != 'string') return reject(new Error('invalidId'));
            if (typeof(secret) != 'string') return reject(new Error('invalidSecret'));
            if (!id.match(/^[0-9a-zA-Z]{3,40}$/)) return reject(new Error('invalidId'));

            const filePath = path.join(this._dirPath, id);
            fs.readFile(filePath, {encoding: 'utf-8'}, (err, content) => {
                if (err) {
                    log.warn('Unknown user ' + id);
                    return reject(new Error('invalidCredentials'));
                }
                if (content !== secret) {
                    log.warn('Invalid secret for user ' + id);
                    if (typeof(secret) != 'string') {
                        return reject(new Error('invalidCredentials'));
                    }
                }

                resolve({
                    id: id
                });
            });
        });
    }

}

module.exports = AuthProvider;
