const MeasureSource = require('../../lib/models/measure_source.js');
const Measure = require('cqm-models').Measure;
const Mongoose = require('mongoose');

describe('A MongoDB Measure Source', () => {
  const connectionInfo = 'mongodb://127.0.0.1:27017/js-ecqme-test';
  const measureSource = new MeasureSource(connectionInfo);
  const mes = new Measure({
    cms_id: 'CMS123',
  });

  describe('Finding a measure given an ID', () => {
    beforeEach(() => {
      spyOn(measureSource.CQLMeasure, 'findById').and.returnValue([null, mes]);
    });

    it('returns a measure given an ID (as a string)', () => {
      expect(measureSource.findMeasure('56337c006c5d1c6930000417')).toBe(mes);
      expect(measureSource.CQLMeasure.findById).toHaveBeenCalled();
    });

    it('returns a measure given an ID (as an ObjectId)', () => {
      expect(measureSource.findMeasure(Mongoose.Types.ObjectId('56337c006c5d1c6930000417')))
        .toBe(mes);
      expect(measureSource.CQLMeasure.findById).toHaveBeenCalled();
    });

    it('returns an error if you don\'t pass an ID', () => {
      expect(measureSource.findMeasure(null).message)
        .toEqual('measureId must be string or ObjectId');
      expect(measureSource.CQLMeasure.findById).not.toHaveBeenCalled();
    });
  });

  describe('Finding a measure given a User ID and HQMF Set ID', () => {
    beforeEach(() => {
      spyOn(measureSource.CQLMeasure, 'findOne').and.callFake((query) => {
        if (query.user_id instanceof Mongoose.Types.ObjectId &&
          typeof query.hqmf_set_id === 'string') {
          return [null, mes];
        }
        return TypeError('Incorrect Type Passed');
      });
    });

    it('returns a measure given a user ID (as a string) and an HQMF ID', () => {
      expect(measureSource.findMeasureByUser(
        '56337c006c5d1c6930000417',
        '1234-abcd-1234-abcd'
      )).toBe(mes);
      expect(measureSource.CQLMeasure.findOne).toHaveBeenCalled();
    });

    it('returns a measure given a user ID (as an ObjectId) and an HQMF ID', () => {
      expect(measureSource.findMeasureByUser(
        Mongoose.Types.ObjectId('56337c006c5d1c6930000417'),
        '1234-abcd-1234-abcd'
      )).toBe(mes);
      expect(measureSource.CQLMeasure.findOne).toHaveBeenCalled();
    });

    it('returns an error if you don\'t pass a user ID', () => {
      expect(measureSource.findMeasureByUser(null, '1234-abcd-1234-abcd').message)
        .toEqual('userId must be string or ObjectId');
      expect(measureSource.CQLMeasure.findOne).not.toHaveBeenCalled();
    });

    it('returns an error if you don\'t pass an HQMF set ID', () => {
      expect(measureSource.findMeasureByUser('56337c006c5d1c6930000417', null).message)
        .toEqual('hqmfSetId must be string');
      expect(measureSource.CQLMeasure.findOne).not.toHaveBeenCalled();
    });
  });
});
