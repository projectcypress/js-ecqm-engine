const IndividualResultSchema = require('cqm-models').IndividualResultSchema;

module.exports = class Handler {
  /* Initializes cumulative results structure for storage at finish time, and initializes connection to MongoDB
    */
  constructor() {
    this.finished = true;

    /* Individual patient results, hashed by measure id and patient id */
    this.individualResultsByMeasureId = {};

    this.correlationId = null;
    this.effectiveDate = null;
  }

  start(options) {
    // this.aggregateResultsByMeasureId = {};
    if (options) {
      this.correlationId = options.correlation_id;
      this.effectiveDate = options.effective_date;
    }
    this.finished = false;
    return true;
  }

  /* Takes in the most recent measure calculation results for a single patient and records/aggregates them
    */
  handleResult(measure, resultsByPatientId) {
    this.individualResultsByMeasureId[measure._id] = resultsByPatientId;
  }

  /* Wraps up individual and aggregate results and saves to the database */
  finish(connection) {
    const IndividualResult = connection.model('individual_result', IndividualResultSchema);
    if (this.finished) {
      throw new Error('Handler cannot be finished until it is started.');
    } else {
      Object.keys(this.individualResultsByMeasureId).forEach((measureId) => {
        Object.keys(this.individualResultsByMeasureId[measureId]).forEach((patientId) => {
          // IndividualResult data gets reinstantiated in an object with a MongoDB connection
          
          const patientResultMongo =
            IndividualResult(this.individualResultsByMeasureId[measureId][patientId]
              .toObject());
          this.individualResultsByMeasureId[measureId][patientId] = patientResultMongo;
          if (patientResultMongo.state === 'running') {
            patientResultMongo.state = 'complete';
          }
          // Add necessary Cypress data to the extended_data tab
          if (!patientResultMongo.extendedData) {
            patientResultMongo.extendedData = {};
          }
          if (this.correlationId) {
            patientResultMongo.extendedData.correlation_id = this.correlationId;
          }
          if (this.effectiveDate) {
            patientResultMongo.extendedData.effective_date = this.effectiveDate;
          }
          patientResultMongo.save((err) => {
            if (err) throw Error(err);
          });
        });
      // TODO: Save aggregate results
      });
    }
    this.finished = true;
    // TODO: Return something needed specifically by Cypress
    return {
      Individual: this.individualResultsByMeasureId,
    };
  }
};
