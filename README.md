# DHMQ

DHMQ is a message queueing system that focuses on tasks.

The whole management of queues and workers is driven by the MQManager.
There can be multiple instances, but usually one node process has only one default instance.

The DHMQServer can be used as interface to the MQManager.

An application could be designed to have the MQManager within its node process or remote as separate server.

## MQManager

The `MQManager` is the main component, as all operations on queues and workers are run through the `MQManager`.
The MQQueue, MQTask and the MQWorker are just data model objects. 

When an instance is requested the first time, the MQManager will lookup its storage directory for stored queues to restore them.

When the MQManager is shutdown, it will save the Queues and its waiting tasks to its storage folder.

## License 

The MIT License (MIT)
