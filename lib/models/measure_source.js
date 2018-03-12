const _ = require('lodash');
const MeasureSchema = require('cqm-models').MeasureSchema;
const mongoose = require('mongoose');

module.exports = class MongoDBMeasureSource {
  constructor(connectionInfo) {
    mongoose.connect(connectionInfo);

    this.Measure = mongoose.model('Measure', MeasureSchema);
  }
};
