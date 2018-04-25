#!/usr/bin/env node

const amqp = require('amqplib/callback_api');
const Executor = require('../lib/executor');

amqp.connect('amqp://localhost', (err, conn) => {
  conn.createChannel((chErr, ch) => {
    const q = 'calculation_queue';

    ch.assertQueue(q, { durable: true });
    ch.prefetch(1);

    const executor = new Executor('mongodb://localhost/cypress_development');

    console.log(' [*] Waiting for messages in %s. To exit press CTRL+C', q);

    ch.consume(q, (msg) => {
      const messageJSON = JSON.parse(msg.content.toString());
      console.log(messageJSON);
      executor.execute(messageJSON.patient_ids, messageJSON.measure_ids, messageJSON.options).then(
        // Success handler
        (result) => {
          console.log(`Calculated ${result}`);
          ch.ack(msg);
        },
        // Failure handler
        (result) => {
          console.error(result);
          ch.ack(msg);
        }
      );
    }, { noAck: false });
  });
});
