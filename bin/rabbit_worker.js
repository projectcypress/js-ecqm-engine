#!/usr/bin/env node

const amqp = require('amqplib/callback_api');
const Executor = require('../lib/executor');
const mongoose = require('mongoose');

amqp.connect('amqp://localhost', (err, conn) => {
  conn.createChannel((chErr, ch) => {
    const q = 'calculation_queue';

    ch.assertQueue(q, { durable: true });
    ch.prefetch(1);

    const connectionURL = 'mongodb://127.0.0.1:27017/cypress_development';
    const connectionOptions = { poolSize: 10 };
    const connection = mongoose.createConnection(connectionURL, connectionOptions);

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
