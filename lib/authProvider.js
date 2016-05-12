/* Created by Dominik Herbst on 2016-05-09 */
'use strict';

const log = require('dhlog')('AuthProvider');
const fs = require('fs');
const path = require('path');

class AuthProvider {
	constructor(config) {
		this.provider = config.provider;
		if (this.provider == 'dir') {
			this.dirPath = config.dirPath;
		}

	}

	identify(id, secret, callb) {
		if (this.provider == 'dir') {
			this._identifyByDir(id, secret, callb);
		} else {
			log.error('Unknown auth provider ' + this.provider);
			callb({error: 'unknown_auth_provider'});
		}

	}

	_identifyByDir(id, secret, callb) {
		if (typeof(id) != 'string') return callb({error: 'invalid_id'});
		if (typeof(secret) != 'string') return callb({error: 'invalid_secret'});
		if (!id.match(/^[0-9a-zA-Z]{3,40}$/)) return callb({error: 'invalid_id'});

		var filePath = path.join(this.dirPath, id);
		fs.readFile(filePath, {encoding: 'utf-8'}, (err, content) => {
			if (err) {
				log.warn('Unknown user ' + id);
				return callb({error: 'invalid_credentials'});
			}
			if (content !== secret) {
				log.warn('Invalid secret for user ' + id);
				if (typeof(secret) != 'string') return callb({error: 'invalid_credentials'});
			}

			callb({success: true});
		});

	}

}

module.exports = AuthProvider;
