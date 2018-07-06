/**
 * The CQL calculator. This calls the cql-execution framework and formats the results as neccesary.
 */
const _ = require('lodash');
const CqmModels = require('cqm-models');
const cql = require('cqm-models').CQL;
const Measure = require('cqm-models').Measure();
const ResultsHelpers = require('../helpers/results_helpers');
const CalculatorHelpers = require('../helpers/calculator_helpers');

module.exports = class Calculator {
  /**
   * Generate a calculation result for a population / patient pair; this always returns a result immediately,
   * but may return a blank result object if there was a problem. Currently we do not do CQL calculations in
   * deferred manner like we did for QDM calcuations.
   * @param {Measure} measure - The measure population to calculate on.
   * @param {PatientSource} patientSource - The patientSource to run calculations on.
   * @param {Hash} valueSetsByOid - all ValueSets relevant to the measure, hashes match thouse in the value sets ar
   * @param {Hash} options - contains options for measure calculation, particularly relevant is effective_date
   */
  static calculate(measure, patientSource, valueSetsByOid, options) {
    if (options == null) {
      options = {};
    }

    // We store both the calculation result and the calculation code based on keys derived from the arguments
    const resultsByPatient = {};

    // Grab start and end of Measurement Period
    let start;
    let end;
    // Override default measure_period with effective_date if available
    if (options && options.effective_date != null) {
      start = CalculatorHelpers.getConvertedTime(options.effective_date);
      if (options.effective_date_end != null) {
        end = CalculatorHelpers.getConvertedTime(options.effective_date_end);
      } else {
        end = CalculatorHelpers.getConvertedTimeEndOfYear(options.effective_date);
      }
    } else {
      start = CalculatorHelpers.getConvertedTime(measure.measure_period.low.value);
      end = CalculatorHelpers.getConvertedTime(measure.measure_period.high.value);
    }

    const startCql = cql.DateTime.fromDate(start, 0); // No timezone offset for start
    const endCql = cql.DateTime.fromDate(end, 0); // No timezone offset for stop

    // Construct CQL params
    const params = { 'Measurement Period': new cql.Interval(startCql, endCql) };

    // Create the execution DateTime that we pass into the engine
    const executionDateTime = cql.DateTime.fromDate(new Date(), '0');

    // Grab ELM JSON from measure, use clone so that the function added from observations does not get added over and over again
    // Set all value set versions to 'undefined' so the execution engine does not grab the specified version in the ELM
    const elm = CalculatorHelpers.setValueSetVersionsToUndefined(_.clone(measure.elm));

    // Find the main library (the library that is the "measure") and
    // grab the version to pass into the execution engine
    let mainLibraryVersion = '';
    let mainLibraryIndex = 0;
    for (let index = 0; index < elm.length; index += 1) {
      const elmLibrary = elm[index];
      if (elmLibrary.library.identifier.id === measure.main_cql_library) {
        mainLibraryVersion = elmLibrary.library.identifier.version;
        mainLibraryIndex = index;
      }
    }

    const observations = measure.observations;
    const observationDefs = [];
    let generatedELMJSON;
    if (observations) {
      observations.forEach(obs => {
        generatedELMJSON = CalculatorHelpers.generateELMJSONFunction(obs.function_name, obs.parameter);
        // Save the name of the generated define statement, so we can check
        // its result later in the CQL calculation process. These added
        // define statements are called 'EcqmeFunction_' followed by the
        // name of the function - see the 'generateELMJSONFunction' function.
        observationDefs.push(`EcqmeFunction_${obs.function_name}`);
        // Check to see if the gneratedELMJSON function is already in the definitions
        // Added a check to support old ELM representation and new Array representation.
        elm[mainLibraryIndex].library.statements.def.push(generatedELMJSON);
      });
    }

    // Grab the correct version of value sets to pass into the exectuion engine.
    const measureValueSets = CalculatorHelpers.valueSetsForCodeService(valueSetsByOid, measure.value_set_oids);

    // Calculate results for each CQL statement
    const resultsRaw = Calculator.executeEngine(
      elm,
      patientSource,
      measureValueSets,
      measure.main_cql_library,
      mainLibraryVersion,
      executionDateTime,
      params
    );

    Object.keys(resultsRaw.patientResults).forEach(patientId => {
      var populationResults;
      var episodeResults;
      // Parse CQL statement results into population values
      for (const [populationIndex, population] of measure.populations.entries()) {
        [populationResults, episodeResults] = Array.from(
          CalculatorHelpers.createPopulationValues(
            measure,
            population,
            resultsRaw,
            patientId,
            observationDefs,
            populationIndex
          )
        );
        if (populationResults) {
          var result = CqmModels.IndividualResult();
          result.set(populationResults);
          if (episodeResults != null) {
            // In episode of care based measures, episodeResults contains the population results
            // for EACH episode.
            result.episode_results = episodeResults;
            if (Object.keys(episodeResults).length > 0) {
              /* In episode of care based measures, episode_results contains the population results
               * for EACH episode, so we need to build population_relevance based on a combonation
               * of the episode_results. IE: If DENEX is irrelevant for one episode but relevant for
               * another, the logic view should not highlight it as irrelevant
               */
              var populationRelevance = ResultsHelpers.populationRelevanceForAllEpisodes(episodeResults);
            } else {
              // Use the patient based relevance if there are no episodes. This will properly set IPP or STRAT to true.
              var populationRelevance = ResultsHelpers.buildPopulationRelevanceMap(populationResults);
            }
          } else {
            // Calculate relevance for patient based measure
            var populationRelevance = ResultsHelpers.buildPopulationRelevanceMap(populationResults);
          }

          // Build statement relevance mappings
          var statementRelevance = ResultsHelpers.buildStatementRelevanceMap(
            populationRelevance,
            measure,
            population,
            populationIndex
          );

          result['population_relevance'] = populationRelevance;
          result['statement_relevance'] = statementRelevance;

          result.set(
            ResultsHelpers.buildStatementAndClauseResults(measure, resultsRaw.localIdPatientResultsMap[patientId], statementRelevance, !!options.doPretty)
          );

          // Populate result with info
          result.patient = patientId;
          result.measure = measure._id;
          result.state = 'complete';

          // Add result of population set, hashed by population set idc
          if (!resultsByPatient[patientId]) {
            resultsByPatient[patientId] = {};
          }
          resultsByPatient[patientId][population.id] = result;
        }
      }
    });
    return resultsByPatient;
  }

  static executeEngine(elm, patientSource, valueSets, libraryName, version, executionDateTime, parameters = {}) {
    let lib;
    let rep;
    if (Array.isArray(elm)) {
      if (elm.length > 1) {
        rep = new cql.Repository(elm);
        lib = rep.resolve(libraryName, version);
      } else {
        lib = new cql.Library(elm[0]);
      }
    } else {
      lib = new cql.Library(elm);
    }
    const codeService = new cql.CodeService(valueSets);
    const executor = new cql.Executor(lib, codeService, parameters);
    return executor.exec(patientSource, executionDateTime);
  }
};
