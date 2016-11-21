# DHMQ

DHMQ is a message queue server that focuses on tasks.

The whole server management is driven by the MQManager, which manages queues and workers.
There can be multiple instances, but usually one node process has only one default instance.

The Server is just an interface to talk to the MQManager.

If your application could be designed to have the MQManager within its node process.


## License 

The MIT License (MIT)
