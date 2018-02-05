
const mongoose = require('mongoose');
const Result = require('./models/result.js');

module.exports = class Handler {
  constructor() {
    /* Initializes cumulative results structure for storage at finish time, and initializes connection to MongoDB
    */

    /* TODO: Placeholder mongodb url */
    this.mongoUrl = 'mongodb://127.0.0.1:27017';

    /* Individual patient results, hashed by patient_id */
    this.calculationResults = {};
    /* Aggregate patient results, calculated at finish */
    this.aggregateResult = Result();
  }

  start() {
    // TODO: Mongodb Connection
    mongoose.connect(this.mongoUrl);

    // TODO: Initialize results variables if need be
  }

  /* Takes in the most recent measure calculation results for a single patient and records/aggregates them
    */
  handleResult(patient, result) {
    this.calculationResults[patient.id][result.measureId] = result;
  }

  /* Stores the aggregate calculation of the patients in calculationResults in
     aggregateResult, then returns
    aggregateResult
    */
  aggregate() {
    return this.aggregateResult;
  }

  /* Wraps up structure for results storage and saves to the database */
  finish() {
    this.aggregate();

    for (const result in this.calculationResults) {
      // TODO: Does the result have patient_id as part of it, or will we have to add it?
      result.save();
    }
    this.aggregateResult.save();
  }
};
