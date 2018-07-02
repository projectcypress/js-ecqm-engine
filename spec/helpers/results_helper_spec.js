const ResultsHelper = require('../../lib/helpers/results_helper.js');

describe('buildPopulationRelevanceMap', function() {
  it('marks NUMER, NUMEX, DENEXCEP not calculated if DENEX count matches DENOM', function() {
    const population_results = { IPP: 2, DENOM: 2, DENEX: 2, DENEXCEP: 0, NUMER: 0, NUMEX: 0 };
    const expected_relevance_map = { IPP: true, DENOM: true, DENEX: true, DENEXCEP: false, NUMER: false, NUMEX: false };
    const relevance_map = ResultsHelper.buildPopulationRelevanceMap(population_results);
    expect(relevance_map).toEqual(expected_relevance_map);
  });

  it('marks NUMER, NUMEX, DENEXCEP not calculated if DENEX count exceeds DENOM', function() {
    const population_results = { IPP: 3, DENOM: 2, DENEX: 3, DENEXCEP: 0, NUMER: 0, NUMEX: 0 };
    const expected_relevance_map = { IPP: true, DENOM: true, DENEX: true, DENEXCEP: false, NUMER: false, NUMEX: false };
    const relevance_map = ResultsHelper.buildPopulationRelevanceMap(population_results);
    expect(relevance_map).toEqual(expected_relevance_map);
  });

  it('marks NUMER, NUMEX calculated if DENEX count does not exceed DENOM', function() {
    const population_results = { IPP: 3, DENOM: 3, DENEX: 1, DENEXCEP: 0, NUMER: 2, NUMEX: 0 };
    const expected_relevance_map = { IPP: true, DENOM: true, DENEX: true, DENEXCEP: false, NUMER: true, NUMEX: true };
    const relevance_map = ResultsHelper.buildPopulationRelevanceMap(population_results);
    expect(relevance_map).toEqual(expected_relevance_map);
  });

  it('marks OBSERV calculated if MSRPOPLEX is less than MSRPOPL', function() {
    const population_results = {IPP: 3, MSRPOPL: 2, MSRPOPLEX: 1, values: [12]};
    const expected_relevance_map = { IPP: true, MSRPOPL: true, MSRPOPLEX: true, values: true };
    const relevance_map = ResultsHelper.buildPopulationRelevanceMap(population_results);
    expect(relevance_map).toEqual(expected_relevance_map);
  });

  it('marks OBSERV not calculated if MSRPOPLEX is same as MSRPOPL', function() {
    const population_results = {IPP: 3, MSRPOPL: 2, MSRPOPLEX: 2, values: [12]};
    const expected_relevance_map = { IPP: true, MSRPOPL: true, MSRPOPLEX: true, values: false };
    const relevance_map = ResultsHelper.buildPopulationRelevanceMap(population_results);
    expect(relevance_map).toEqual(expected_relevance_map);
  });

  it('marks OBSERV not calculated if MSRPOPLEX is greater than MSRPOPL', function() {
    const population_results = {IPP: 3, MSRPOPL: 2, MSRPOPLEX: 3, values: [12]};
    const expected_relevance_map = { IPP: true, MSRPOPL: true, MSRPOPLEX: true, values: false };
    const relevance_map = ResultsHelper.buildPopulationRelevanceMap(population_results);
    expect(relevance_map).toEqual(expected_relevance_map);
  });

  it('marks MSRPOPLEX not calculated if MSRPOPL is zero', function() {
    const population_results = {IPP: 3, MSRPOPL: 0, MSRPOPLEX: 0, values: []};
    const expected_relevance_map = { IPP: true, MSRPOPL: true, MSRPOPLEX: false, values: false };
    let relevance_map = ResultsHelper.buildPopulationRelevanceMap(population_results);
    expect(relevance_map).toEqual(expected_relevance_map);

    const initial_results = {IPP: 1, MSRPOPL: 0, MSRPOPLEX: 1};
    const expected_results = {IPP: true, MSRPOPL: true, MSRPOPLEX: false};
    relevance_map = ResultsHelper.buildPopulationRelevanceMap(initial_results);
    expect(relevance_map).toEqual(expected_results);
  });

  it('marks MSRPOPLEX calculated if MSRPOPL is 1', function() {
    let initial_results = {IPP: 1, MSRPOPL: 1, MSRPOPLEX: 1};
    let expected_results = {IPP: true, MSRPOPL: true, MSRPOPLEX: true};
    const relevance_map = ResultsHelper.buildPopulationRelevanceMap(initial_results);
    expect(relevance_map).toEqual(expected_results);

    initial_results = {IPP: 1, MSRPOPL: 1, MSRPOPLEX: 0};
    expected_results = {IPP: true, MSRPOPL: true, MSRPOPLEX: true};
    const population_relevance_map = ResultsHelper.buildPopulationRelevanceMap(initial_results);
    expect(population_relevance_map).toEqual(expected_results);
  });
});

describe('populationRelevanceForAllEpisodes', function() {
  it('correctly builds population_relevance for multiple episodes in all populations', function() {
    const episode_results = {
      episode1: {IPP: 1, DENOM: 1, DENEX: 0, DENEXCEP: 1, NUMER: 0, NUMEX: 0},
      episode2: {IPP: 1, DENOM: 1, DENEX: 0, DENEXCEP: 0, NUMER: 1, NUMEX: 1},
      episode3: {IPP: 1, DENOM: 1, DENEX: 1, DENEXCEP: 0, NUMER: 0, NUMEX: 0}
    };
    const expected_relevance_map = { IPP: true, DENOM: true, DENEX: true, DENEXCEP: true, NUMER: true, NUMEX: true };
    const relevance_map = ResultsHelper.populationRelevanceForAllEpisodes(episode_results);
    expect(relevance_map).toEqual(expected_relevance_map);
  });

  it('correctly builds population_relevance for multiple episodes in no populations', function() {
    const episode_results = {
      episode1: {IPP: 0, DENOM: 0, DENEX: 0, DENEXCEP: 0, NUMER: 0, NUMEX: 0},
      episode2: {IPP: 0, DENOM: 0, DENEX: 0, DENEXCEP: 0, NUMER: 0, NUMEX: 0},
      episode3: {IPP: 0, DENOM: 0, DENEX: 0, DENEXCEP: 0, NUMER: 0, NUMEX: 0}
    };
    // IPP will be relevant because nothing has rendered it irrelevant
    const expected_relevance_map = { IPP: true, DENOM: false, DENEX: false, DENEXCEP: false, NUMER: false, NUMEX: false };
    const relevance_map = ResultsHelper.populationRelevanceForAllEpisodes(episode_results);
    expect(relevance_map).toEqual(expected_relevance_map);
  });
});