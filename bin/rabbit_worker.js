#!/usr/bin/env node
const amqp = require('amqplib/callback_api');
const Executor = require('../lib/executor');
const mongoose = require('mongoose');
const convict = require('convict');
const retry = require('retry');

const config = convict({
  env: {
    doc: 'The application environment',
    format: ['development', 'production', 'test'],
    default: 'development',
    env: 'NODE_ENV',
    arg: 'node_env',
  },
  rabbitmq: {
    host: {
      doc: 'RabbitMQ connection host',
      format: String,
      default: 'localhost',
      env: 'RABBITMQ_HOST',
      arg: 'rabbitmq_host',
    },
    port: {
      doc: 'RabbitMQ connection port',
      format: 'port',
      default: 5672,
      env: 'RABBITMQ_PORT',
      arg: 'rabbitmq_port',
    },
  },
  mongodb: {
    host: {
      doc: 'MongoDB connection host',
      format: String,
      default: 'localhost',
      env: 'MONGODB_HOST',
      arg: 'mongodb_host',
    },
    port: {
      doc: 'MongoDB connection port',
      format: 'port',
      default: 27017,
      env: 'MONGODB_PORT',
      arg: 'mongodb_port',
    },
  },
  cypress: {
    test_num: {
      doc: 'Cypress Test number (if test environment',
      format: '*',
      default: '',
      env: 'TEST_NUM',
      arg: 'test_num',
    },
  },
});

const env = config.get('env');
config.validate({ allowed: 'strict' });

const rabbitURL = `amqp://${config.get('rabbitmq.host')}:${config.get('rabbitmq.port')}`;
const cypressDB = `cypress_${env}${config.get('cypress.test_num')}`;
const mongoURL = `mongodb://${config.get('mongodb.host')}` +
                 `:${config.get('mongodb.port')}/${cypressDB}`;

const operation = retry.operation({
  retries: 5,
  minTimeout: 250,
  factor: 3.5,
});

operation.attempt(() => {
  amqp.connect(rabbitURL, (err, conn) => {
    if (operation.retry(err)) {
      console.error('No rabbitMQ connection possible, retrying...');
      return;
    }

    if (!conn) {
      console.error('No RabbitMQ connection could be made. Please check your RabbitMQ Server/connection settings');
      return;
    }

    conn.createChannel((chErr, ch) => {
      if (operation.retry(chErr)) {
        console.error('Error connecting to channel, retrying...');
        return;
      }

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
                  Buffer.from(JSON.stringify({
                    status: 'success',
                    result,
                  })),
                  { correlationId: msg.properties.correlationId }
                );
                ch.ack(msg);
              },
              // Failure handler
              (result) => {
                console.error(result);
                ch.sendToQueue(
                  msg.properties.replyTo,
                  Buffer.from(JSON.stringify({
                    status: 'fail',
                    error: result,
                  })),
                  { correlationId: msg.properties.correlationId }
                );
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
              Buffer.from(JSON.stringify({
                status: 'fail',
                error,
              })),
              { correlationId: msg.properties.correlationId }
            );
          }
          ch.ack(msg);
        }
      }, { noAck: false });
    });
  });
});
