const MeasureSource = require('../../lib/models/measure_source.js');
const Measure = require('cqm-models').Measure;

describe('A MongoDB Measure Source', () => {
  const connectionInfo = 'mongodb://127.0.0.1:27017/js-ecqme-test';
  const measureSource = new MeasureSource(connectionInfo);
  const mes = new Measure({
    cms_id: 'CMS123',
  });

  beforeEach(() => {
    spyOn(measureSource.CQLMeasure, 'findById').and.returnValue(null, mes);
  });

  it('returns a measure given an ID (as a string)', () => {
    expect(measureSource.findMeasure('56337c006c5d1c6930000417')).toBe(mes);
    expect(measureSource.CQLMeasure.findById).toHaveBeenCalled();
  });
});
