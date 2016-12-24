# DHMQ

DHMQ is a message queueing system that focuses on tasks.

The whole management of queues and workers is driven by the MQManager.
There can be multiple instances, but usually one node process has only one default instance.

The DHMQServer can be used as interface to the MQManager.

An application could be designed to have the MQManager within its node process or remote as separate server.

## Usage

Install the dependencies:

    npm install
    
Run the server:

    node server.js
    
## Configuration

The listen port for the Server can be configured with the environment variable `PORT`.
All the configuration options can be found in the _lib/config.js_.


## Components

### MQManager

The `MQManager` is the main component, as all operations on queues and workers are run through the `MQManager`.
The `MQQueue`, `MQTask` and the `MQWorker` are just data model objects. 

When an instance is requested the first time, the `MQManager` will lookup its storage directory for stored queues to restore them.

When the `MQManager` is shutdown, it will save the Queues and its waiting tasks to its storage folder.

### DHMQServer

The `DHMQServer` is a HTTP Server that offers a Socket.io Websocket interface. This interface can be used to manage the queues and tasks.

### DHMQClient

The `DHMQClient` can be used to connect to the `DHMQServer`.



## License 

The MIT License (MIT)
