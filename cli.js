/* Created by Dominik Herbst on 2016-12-26 */

const DHMQClient = require('./lib/dhmqClient');
const config = require('./lib/config');
const fs = require('fs');

class CLICommands {

    constructor() {
    }

    runCommand(cmd, args) {
        const handlers = Object.getOwnPropertyNames(this.__proto__)
            .filter(name => name != 'constructor' && name != 'runCommand');
        const index = handlers.indexOf(cmd);
        if (index == -1) {
            console.log('Unknown command ' + cmd + '. Use one of:');
            handlers.forEach(name => console.log(name));
            return;
        }
        const handler = this[handlers[index]];
        handler(args);
    }


    getStats(args) {
        let client = null;
        CLICommands.getClient()
            .then(c => client=c)
            .then(() => client.getStats())
            .then(stats => {
                console.log(stats);
            })
            .then(() => client.disconnect())
            .catch(err => {
                console.error(err);
            });
    }

    static getClient() {
        return CLICommands.getFirstUser().then(credentials => {
            const clientConfig = {
                transports: ['websocket'],
                url: 'http://localhost:' + config.server.port + '/',
                userId: credentials.userId,
                key: credentials.key
            };
            const client = new DHMQClient(clientConfig);
            return client.connect().then(() => client);
        });
    }

    static getFirstUser() {
        const userDir = config.server.authProvider.dirPath;
        return new Promise((resolve, reject) => {
            fs.readdir(userDir, (err, files) => {
                if (err) return reject(err);
                const user = files[0];
                fs.readFile(userDir + '/' + user, {encoding: 'utf8'}, (err, content) => {
                    if (err) return reject(err);
                    resolve({userId: user, key: content});
                });
            });
        });

    }

}
module.exports = CLICommands;

if (!module.parent) {
    const cli = new CLICommands();
    cli.runCommand(process.argv[2], process.argv.slice(3));
}
