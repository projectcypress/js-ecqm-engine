const MeasureSchema = require('cqm-models').MeasureSchema;
const mongoose = require('mongoose');

module.exports = class MongoDBMeasureSource {
  constructor(connectionInfo) {
    mongoose.connect(connectionInfo);

    this.CQLMeasure = mongoose.model('Measure', MeasureSchema);
    this.measure = null;
  }

  /**
   * This method searches for a measure given its ObjectId; if it finds it, it sets the measure property and runs callbacks, if any
   * @param { string | mongoose.Types.ObjectId } measureId - The measure ObjectId (unique MongoDB identifier) to search by. If a string is passed in, it will be converted to an ObjectId
   * @param {function} callback - A function to run after searching for the measure
   * @returns {Measure | Error } - the Measure found, or an Error
   */
  findMeasure(measureId, callback = null) {
    const self = this;
    let measureIdObj = null;

    if (typeof measureId === 'string') {
      measureIdObj = mongoose.Types.ObjectId(measureId);
    } else if (measureId instanceof mongoose.Types.ObjectId) {
      measureIdObj = measureId;
    }

    if (measureIdObj === null) return Error('measureId must be string or ObjectId');

    this.CQLMeasure.findById(measureIdObj, (err, measure) => {
      if (err) return Error(err);

      self.measure = measure;

      if (callback != null) {
        callback(self);
      }
      return null;
    });

    return this.measure;
  }

  /**
   * This method searches for a measure given the user who owns it, and the hqmf set ID;
   * if it finds it, it sets the measure property and runs callbacks, if any
   * @param {string | mongoose.Types.ObjectId } userId - the user ObjectId (unique MongoDB identifier) to search by. If a string is passed in, it will be converted to an ObjectId
   * @param {string} hqmfSetId - the HQMF set ID (measure-version neutral UUID, assigned by the MAT)
   * @param {function} callback - a function to be run after searching for the measure
   * @returns {Measure | Error } - the Measure found, or an Error
   */
  findMeasureByUser(userId, hqmfSetId, callback = null) {
    const self = this;

    this.CQLMeasure.findOne({ user_id: userId, hqmf_set_id: hqmfSetId }, (err, measure) => {
      if (err) return Error(err);

      self.measure = measure;

      if (callback != null) {
        callback(self);
      }
      return null;
    });

    return this.measure;
  }
};
