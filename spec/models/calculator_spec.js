const Calculator = require('../../lib/models/calculator.js');
const QDMPatientSchema = require('cqm-models').PatientSchema;
const PatientSource = require('../../lib/models/patient_source.js');
const Mongoose = require('mongoose');
const getJSONFixture = require('../support/spec_helper.js').getJSONFixture;

describe('Calculator', function() {
  describe('episode of care based relevance map', function() {
    it('is correct for patient with no episodes', function() {
      const valueSetsByOid = getJSONFixture('measures/CMS107v6/value_sets.json');
      const measure = getJSONFixture('measures/CMS107v6/CMS107v6.json');
      const patients = [];
      patients.push(getJSONFixture('patients/CMS107v6/IPPFail_LOS=121Days.json'));
      const QDMPatient = Mongoose.model('QDMPatient', QDMPatientSchema);
      const qdmPatients = patients.map(patient => new QDMPatient(patient));
      const qdmPatientsSource = new PatientSource(qdmPatients);
      const calculationResults = Calculator.calculate(measure, qdmPatientsSource, valueSetsByOid);
      const result = Object.values(calculationResults[Object.keys(calculationResults)[0]])[0];

      // No results will be in the episode_results
      expect(result['episode_results']).toEqual({});
      // The IPP should be the only relevant population
      expect(result['population_relevance']).toEqual({ IPP: true, DENOM: false, DENEX: false, NUMER: false });
    });

    it('is correct for patient with episodes', function() {
      const valueSetsByOid = getJSONFixture('measures/CMS107v6/value_sets.json');
      const measure = getJSONFixture('measures/CMS107v6/CMS107v6.json');
      const patients = [];
      patients.push(getJSONFixture('patients/CMS107v6/DENEXPass_CMOduringED.json'));
      const QDMPatient = Mongoose.model('QDMPatient', QDMPatientSchema);
      const qdmPatients = patients.map(patient => new QDMPatient(patient));
      const qdmPatientsSource = new PatientSource(qdmPatients);
      const calculationResults = Calculator.calculate(measure, qdmPatientsSource, valueSetsByOid);
      const result = Object.values(calculationResults[Object.keys(calculationResults)[0]])[0];

      // There will be a single result in the episode_results
      expect(Object.values(result['episode_results'])[0]).toEqual({ IPP: 1, DENOM: 1, DENEX: 1, NUMER: 0 });

      // NUMER should be the only non-relevant population
      expect(result['population_relevance']).toEqual({ IPP: true, DENOM: true, DENEX: true, NUMER: false });
    });
  });

  describe('patient based relevance map', function() {
    it('is correct', function() {
      const valueSetsByOid = getJSONFixture('measures/CMS735v0/value_sets.json');
      const measure = getJSONFixture('measures/CMS735v0/CMS735v0.json');
      const patients = [];
      patients.push(getJSONFixture('patients/CMS735v0/first_last.json'));
      const QDMPatient = Mongoose.model('QDMPatient', QDMPatientSchema);
      const qdmPatients = patients.map(patient => new QDMPatient(patient));
      const qdmPatientsSource = new PatientSource(qdmPatients);
      const calculationResults = Calculator.calculate(measure, qdmPatientsSource, valueSetsByOid);
      const result = Object.values(calculationResults[Object.keys(calculationResults)[0]])[0];

      // There will not be episode_results on the result object
      expect(result['episode_results']).toBeUndefined();
      // The IPP should be the only relevant population
      expect(result['population_relevance']).toEqual({ IPP: true, DENOM: false, DENEX: false, NUMER: false, DENEXCEP: false});
    });
  });

  // describe('execution engine using passed in timezone offset', function() {
  //   it('is correct', function() {
  //     const valueSetsByOid = getJSONFixture('measures/CMS760v0/value_sets.json');
  //     const measure = getJSONFixture('measures/CMS760v0/CMS760v0.json');
  //     const patients = [];
  //     patients.push(getJSONFixture('patients/CMS760v0/Correct_Timezone.json'));
  //     const QDMPatient = Mongoose.model('QDMPatient', QDMPatientSchema);
  //     const qdmPatients = patients.map(patient => new QDMPatient(patient));
  //     const qdmPatientsSource = new PatientSource(qdmPatients);
  //     const calculationResults = Calculator.calculate(measure, qdmPatientsSource, valueSetsByOid);
  //     const result = Object.values(calculationResults[Object.keys(calculationResults)[0]])[0];

  //     // The IPP should fail
  //     expect(result.IPP).toEqual(0);
  //   });
  // });

  it('multiple population measure correctly', function() {
    const valueSetsByOid = getJSONFixture('measures/CMS160v6/value_sets.json');
    const measure = getJSONFixture('measures/CMS160v6/CMS160v6.json');
    const expiredDenex = getJSONFixture('patients/CMS160v6/Expired_DENEX.json');
    const passNumer2 = getJSONFixture('patients/CMS160v6/Pass_NUM2.json');
    const patients = [];
    patients.push(expiredDenex);
    patients.push(passNumer2);
    QDMPatient = Mongoose.model('QDMPatient', QDMPatientSchema);
    qdmPatients = patients.map(patient => new QDMPatient(patient));
    qdmPatientsSource = new PatientSource(qdmPatients);
    calculationResults = Calculator.calculate(measure, qdmPatientsSource, valueSetsByOid);
    expiredDenexResults = calculationResults[Object.keys(calculationResults)[0]];
    passNumer2Results = calculationResults[Object.keys(calculationResults)[1]];

    // Patient expiredDenexResults Population Set 1
    expect(expiredDenexResults['PopulationCriteria1'].IPP).toBe(1);
    expect(expiredDenexResults['PopulationCriteria1'].DENOM).toBe(1);
    expect(expiredDenexResults['PopulationCriteria1'].DENEX).toBe(1);
    expect(expiredDenexResults['PopulationCriteria1'].NUMER).toBe(0);
    // Patient expiredDenexResults Population Set 2
    expect(expiredDenexResults['PopulationCriteria2'].IPP).toBe(0);
    expect(expiredDenexResults['PopulationCriteria2'].DENOM).toBe(0);
    expect(expiredDenexResults['PopulationCriteria2'].DENEX).toBe(0);
    expect(expiredDenexResults['PopulationCriteria2'].NUMER).toBe(0);
    // Patient expiredDenexResults Population Set 3
    expect(expiredDenexResults['PopulationCriteria3'].IPP).toBe(0);
    expect(expiredDenexResults['PopulationCriteria3'].DENOM).toBe(0);
    expect(expiredDenexResults['PopulationCriteria3'].DENEX).toBe(0);
    expect(expiredDenexResults['PopulationCriteria3'].NUMER).toBe(0);

    // Patient passNumer2Results Population Set 1
    expect(passNumer2Results['PopulationCriteria1'].IPP).toBe(0);
    expect(passNumer2Results['PopulationCriteria1'].DENOM).toBe(0);
    expect(passNumer2Results['PopulationCriteria1'].DENEX).toBe(0);
    expect(passNumer2Results['PopulationCriteria1'].NUMER).toBe(0);
    // Patient passNumer2Results Population Set 2
    expect(passNumer2Results['PopulationCriteria2'].IPP).toBe(1);
    expect(passNumer2Results['PopulationCriteria2'].DENOM).toBe(1);
    expect(passNumer2Results['PopulationCriteria2'].DENEX).toBe(0);
    expect(passNumer2Results['PopulationCriteria2'].NUMER).toBe(1);
    // Patient passNumer2Results Population Set 3
    expect(passNumer2Results['PopulationCriteria3'].IPP).toBe(0);
    expect(passNumer2Results['PopulationCriteria3'].DENOM).toBe(0);
    expect(passNumer2Results['PopulationCriteria3'].DENEX).toBe(0);
    expect(passNumer2Results['PopulationCriteria3'].NUMER).toBe(0);
  });

  it('single population EOC measure correctly', function() {
    const valueSetsByOid = getJSONFixture('measures/CMS177v6/value_sets.json');
    const measure = getJSONFixture('measures/CMS177v6/CMS177v6.json');
    const failIPP = getJSONFixture('patients/CMS177v6/Fail_IPP.json');
    const passNumer = getJSONFixture('patients/CMS177v6/Pass_Numer.json');
    const patients = [];
    patients.push(failIPP);
    patients.push(passNumer);
    QDMPatient = Mongoose.model('QDMPatient', QDMPatientSchema);
    qdmPatients = patients.map(patient => new QDMPatient(patient));
    qdmPatientsSource = new PatientSource(qdmPatients);
    calculationResults = Calculator.calculate(measure, qdmPatientsSource, valueSetsByOid);
    failIPPResults = calculationResults[Object.keys(calculationResults)[0]];
    passNumerResults = calculationResults[Object.keys(calculationResults)[1]];

    // Patient failIPP Population Set 1
    expect(failIPPResults['PopulationCriteria1'].IPP).toBe(0);
    expect(failIPPResults['PopulationCriteria1'].DENOM).toBe(0);
    expect(failIPPResults['PopulationCriteria1'].NUMER).toBe(0);

    // Patient passNumer Population Set 1
    expect(passNumerResults['PopulationCriteria1'].IPP).toBe(1);
    expect(passNumerResults['PopulationCriteria1'].DENOM).toBe(1);
    expect(passNumerResults['PopulationCriteria1'].NUMER).toBe(1);
  });
});
