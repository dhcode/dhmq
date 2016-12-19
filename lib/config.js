/* Created by Dominik Herbst on 2016-05-09 */

const DHMQConfig = {
    server: {
        secure: false,
        host: '',
        port: process.env.PORT || 7010,
        authProvider: {
            provider: 'dir',
            dirPath: 'data/auth'
        },
        managerInstance: null,
        managerProperties: {},
        maxWaitForShutdown: 5000
    }
};


module.exports = DHMQConfig;
