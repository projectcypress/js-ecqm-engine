#!/usr/bin/env node

const amqp = require('amqplib/callback_api');
const Executor = require('../lib/executor');
const mongoose = require('mongoose');

// Build the RabbitMQ connection URL, with sane defaults if the environment variables don't exist
const rabbitHost = process.env.RABBITMQ_HOST ? process.env.RABBITMQ_HOST : 'localhost';
const rabbitPort = process.env.RABBITMQ_PORT ? process.env.RABBITMQ_PORT : '5672';
const rabbitURL = `amqp://${rabbitHost}:${rabbitPort}`;

// Build the MongoDB connection URL, with sane defaults if the environment variables don't exist
const mongoHost = process.env.MONGODB_HOST ? process.env.MONGODB_HOST : 'localhost';
const mongoPort = process.env.MONGODB_HOST ? process.env.MONGODB_PORT : '27017';
// use NODE_ENV to figure out what environment we're running in (or default to development)
const cypressEnv = process.env.NODE_ENV ? process.env.NODE_ENV : 'development';
// If we're running in a test environment, we'll need to get the env number to append to the DB
// If we're not running in a test environment/this variable isn't set, this will be blank and won't matter
const cypressTestNum = process.env.TEST_ENV_NUMBER ? process.env.TEST_ENV_NUMBER : '';
const cypressDB = process.env.CYPRESS_DB ? process.env.CYPRESS_DB : `cypress_${cypressEnv}${cypressTestNum}`;
const mongoURL = `mongodb://${mongoHost}:${mongoPort}/${cypressDB}`;

amqp.connect(rabbitURL, (err, conn) => {
  conn.createChannel((chErr, ch) => {
    const q = 'calculation_queue';

    ch.assertQueue(q, { durable: true });
    ch.prefetch(1);

    const connectionOptions = { poolSize: 10 };
    const connection = mongoose.createConnection(mongoURL, connectionOptions);

    process.on('close', conn.close);

    const executor = new Executor(connection);

    console.log(' [*] Waiting for messages in %s. To exit press CTRL+C', q);

    ch.consume(q, (msg) => {
      const messageJSON = JSON.parse(msg.content.toString());
      // console.log(messageJSON);
      try {
        if (messageJSON.type === 'async') {
          executor.execute(
            messageJSON.patient_ids,
            messageJSON.measure_ids,
            connection,
            messageJSON.options
          ).then(
            // Success handler
            (result) => {
              console.log(`Calculated ${JSON.stringify(result)}`);
              ch.ack(msg);
            },
            // Failure handler
            (result) => {
              console.error(result);
              ch.ack(msg);
            }
          );
        } else if (messageJSON.type === 'sync') {
          executor.execute(
            messageJSON.patient_ids,
            messageJSON.measure_ids,
            connection,
            messageJSON.options
          ).then(
            // Success handler
            (result) => {
              console.log(`Calculated ${JSON.stringify(result)}`);
              ch.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(JSON.stringify(result)),
                { correlationId: msg.properties.correlationId }
              );
              ch.ack(msg);
            },
            // Failure handler
            (result) => {
              console.error(result);
              ch.ack(msg);
            }
          );
        }
      } catch (error) {
        // Uncaught error handler
        if (messageJSON.type === 'sync') {
          console.error(error);
          ch.sendToQueue(
            msg.properties.replyTo,
            Buffer.from(JSON.stringify('fail')),
            { correlationId: msg.properties.correlationId }
          );
        }
        ch.ack(msg);
      }
    }, { noAck: false });
  });
});
