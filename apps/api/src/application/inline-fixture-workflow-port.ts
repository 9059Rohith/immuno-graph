import {
  candidateIdentity,
  canonicalJson,
  canonicalJsonSha256,
  type CanonicalJsonValue,
} from '@immunograph/algorithms';
import {
  loadFixtureRegistry,
  matchFixture,
  type LoadedFixtureCase,
  type Repositories,
  type TransactionManager,
} from '@immunograph/database';

import { DependencyUnavailableError } from './errors.js';
import { parseStoredRunConfiguration } from './json.js';
import type { WorkflowExecutionPort } from './ports.js';
import { WORKFLOW_STAGE_DEFINITIONS } from './workflow-definition.js';

const fixturePolicies = new Set([
  'CACHE_THEN_LIVE_THEN_FIXTURE',
  'LIVE_THEN_CACHE_THEN_FIXTURE',
  'FIXTURE_ONLY',
]);

function json(value: unknown): string {
  return canonicalJson(JSON.parse(JSON.stringify(value)) as CanonicalJsonValue);
}

export class InlineFixtureWorkflowPort implements WorkflowExecutionPort {
  constructor(
    private readonly repositories: Repositories,
    private readonly transactions: TransactionManager,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async assertAvailable(): Promise<void> {
    await loadFixtureRegistry();
  }

  async start(command: { runId: string; requestId: string }): Promise<void> {
    const [run, registry] = await Promise.all([
      this.repositories.runs.findById(command.runId),
      loadFixtureRegistry(),
    ]);
    if (run === null) throw new DependencyUnavailableError('fixture workflow run');
    const protein = await this.repositories.proteins.findById(run.proteinInputId);
    if (protein === null) throw new DependencyUnavailableError('fixture workflow protein');
    const configuration = parseStoredRunConfiguration(run.configurationJson).request;
    if (!fixturePolicies.has(configuration.fallbackPolicy)) {
      throw new DependencyUnavailableError('fixture-permitting fallback policy');
    }
    const fixture = registry.cases.find(
      (candidate) =>
        candidate.proteinSha256 === protein.sha256 && candidate.reviewStatus === 'APPROVED',
    );
    if (fixture === undefined) throw new DependencyUnavailableError('exact approved fixture');

    const requiredSelectors = [
      configuration.analysis.mhci.enabled
        ? {
            proteinSha256: protein.sha256,
            track: 'MHCI' as const,
            methods: configuration.analysis.mhci.methods.map((method) => ({
              method,
              version: '2023.09',
            })),
            alleles: configuration.analysis.mhci.alleles,
            peptideLengths: configuration.analysis.mhci.peptideLengths,
          }
        : null,
      configuration.analysis.mhcii.enabled
        ? {
            proteinSha256: protein.sha256,
            track: 'MHCII' as const,
            methods: configuration.analysis.mhcii.methods.map((method) => ({
              method,
              version: '2023.09',
            })),
            alleles: configuration.analysis.mhcii.alleles,
            peptideLengths: configuration.analysis.mhcii.peptideLengths,
          }
        : null,
      configuration.analysis.bcell.enabled
        ? {
            proteinSha256: protein.sha256,
            track: 'BCELL' as const,
            methods: configuration.analysis.bcell.methods.map((method) => ({
              method: method.toLowerCase(),
              version: 'synthetic-fixture-v1',
            })),
            alleles: [],
            peptideLengths: [],
          }
        : null,
    ].filter((selector) => selector !== null);
    for (const selector of requiredSelectors) {
      const exact = matchFixture(registry, {
        ...selector,
        parametersHash: canonicalJsonSha256({}),
        outputSchemaVersion: 'prediction-observation.v1',
        runProfile: {
          ruleProfileVersion: configuration.ruleProfileVersion,
          rankingProfileVersion: configuration.rankingProfileVersion,
        },
      });
      if (exact?.fixtureId !== fixture.fixtureId) {
        throw new DependencyUnavailableError('exact approved fixture configuration');
      }
    }
    if (
      configuration.populations.length > 0 &&
      !sameStrings(configuration.populations, fixture.expectedCandidates.coverage.populationIds)
    ) {
      throw new DependencyUnavailableError('exact synthetic population fixture');
    }

    await this.persistFixture(
      command.runId,
      protein.sha256,
      fixture,
      configuration,
      command.requestId,
    );
  }

  cancel(): Promise<void> {
    return Promise.resolve();
  }

  retry(): Promise<void> {
    return Promise.reject(new DependencyUnavailableError('fixture stage retry'));
  }

  private async persistFixture(
    runId: string,
    proteinHash: string,
    fixture: LoadedFixtureCase,
    configuration: ReturnType<typeof parseStoredRunConfiguration>['request'],
    requestId: string,
  ): Promise<void> {
    const at = this.clock();
    await this.transactions.run(async (repositories) => {
      const stageByKey = new Map<string, Awaited<ReturnType<typeof repositories.stages.create>>>();
      for (const definition of WORKFLOW_STAGE_DEFINITIONS) {
        const trackEnabled =
          definition.track === undefined || requiredTrack(configuration, definition.track);
        const awaitingApproval = definition.key === 'shortlist_approval';
        const stage = await repositories.stages.create({
          runId,
          stageKey: definition.key,
          attempt: 1,
          status: awaitingApproval ? 'PENDING' : trackEnabled ? 'SUCCEEDED' : 'SKIPPED',
          dependencyKeysJson: json(definition.dependencies),
          inputHash: canonicalJsonSha256({
            runId,
            fixtureId: fixture.fixtureId,
            stageKey: definition.key,
          }),
          ...(awaitingApproval ? {} : { outputHash: fixture.replayHash }),
          progress: awaitingApproval ? 0 : 1,
          ...(awaitingApproval ? {} : { startedAt: at, completedAt: at }),
        });
        stageByKey.set(definition.key, stage);
      }
      const executionByTrack = new Map<
        string,
        Awaited<ReturnType<typeof repositories.predictorExecutions.create>>
      >();
      const methods = new Map<string, { method: string; version: string }>();
      for (const selector of fixture.selectors) {
        if (requiredTrack(configuration, selector.track)) {
          const selected = selector.methods[0]!;
          methods.set(selector.track, selected);
          const execution = await repositories.predictorExecutions.create({
            runId,
            stageId: stageByKey.get(
              selector.track === 'MHCI'
                ? 'predict_mhci'
                : selector.track === 'MHCII'
                  ? 'predict_mhcii'
                  : 'predict_bcell',
            )!.id,
            connectorId: selector.track === 'BCELL' ? 'graphbepi' : 'iedb',
            connectorVersion: 'mvp-v1.0',
            method: selected.method,
            methodVersion: selected.version,
            status: 'SUCCEEDED',
            sourceStatus: 'FIXTURE',
            parametersJson: json({ sourceKind: 'SYNTHETIC', scientificUse: false }),
            inputHash: canonicalJsonSha256(selector as unknown as CanonicalJsonValue),
            outputHash: fixture.contentHash,
            fixtureId: fixture.fixtureId,
            attemptCount: 1,
            startedAt: at,
            completedAt: at,
          });
          executionByTrack.set(selector.track, execution);
        }
      }

      const candidateByFixtureId = new Map<
        string,
        Awaited<ReturnType<typeof repositories.candidates.create>>
      >();
      const predictionByFixtureId = new Map<
        string,
        Awaited<ReturnType<typeof repositories.observations.create>>
      >();
      for (const observation of fixture.expectedCandidates.observations) {
        if (!requiredTrack(configuration, observation.candidateType)) continue;
        const candidate = await repositories.candidates.create({
          runId,
          candidateKey: candidateIdentity({
            id: observation.candidateRef,
            proteinHash,
            candidateType: observation.candidateType,
            start: observation.start,
            end: observation.end,
            peptide: observation.peptide,
            allele: observation.allele,
            observationRefs: [observation.observationId],
          }),
          candidateType: observation.candidateType,
          peptide: observation.peptide,
          start: observation.start,
          end: observation.end,
          length: observation.length,
          allele: observation.allele,
        });
        candidateByFixtureId.set(observation.candidateRef, candidate);
        const execution = executionByTrack.get(observation.candidateType)!;
        const prediction = await repositories.observations.create({
          runId,
          candidateId: candidate.id,
          predictorExecutionId: execution.id,
          rawScoresJson: json({
            value: observation.rawScore,
            percentileRank: observation.percentileRank,
            ...observation.rawFields,
          }),
          unitsJson: json({
            rawScore: 'synthetic_unit_interval',
            percentileRank: 'synthetic_rank',
          }),
          inputHash: canonicalJsonSha256({ candidateKey: candidate.candidateKey }),
          outputHash: canonicalJsonSha256(observation as unknown as CanonicalJsonValue),
          observedAt: at,
        });
        predictionByFixtureId.set(observation.candidateRef, prediction);
        await repositories.normalizedObservations.create({
          runId,
          candidateId: candidate.id,
          predictionObservationId: prediction.id,
          field: 'rawScore',
          rawValue: observation.rawScore,
          normalizedValue: observation.rawScore,
          profileVersion: 'v1',
          transformationJson: json({ kind: 'IDENTITY', syntheticFixture: true }),
        });
      }

      if (requiredTrack(configuration, 'BCELL')) {
        const region = fixture.expectedCandidates.bcell.regions[0]!;
        const fixtureId = fixture.expectedReport.rankings.find(
          ({ track }) => track === 'BCELL',
        )!.candidateId;
        const peptide = fixture.fasta.sequence.slice(region.start - 1, region.end);
        const candidate = await repositories.candidates.create({
          runId,
          candidateKey: candidateIdentity({
            id: fixtureId,
            proteinHash,
            candidateType: 'BCELL',
            start: region.start,
            end: region.end,
            peptide,
            observationRefs: [fixtureId],
          }),
          candidateType: 'BCELL',
          peptide,
          start: region.start,
          end: region.end,
          length: region.end - region.start + 1,
        });
        candidateByFixtureId.set(fixtureId, candidate);
        const execution = executionByTrack.get('BCELL')!;
        const prediction = await repositories.observations.create({
          runId,
          candidateId: candidate.id,
          predictorExecutionId: execution.id,
          rawScoresJson: json({
            value: region.score,
            ...fixture.expectedCandidates.bcell.rawMethodFields,
          }),
          unitsJson: json({ score: 'synthetic_unit_interval' }),
          inputHash: canonicalJsonSha256({ candidateKey: candidate.candidateKey }),
          outputHash: canonicalJsonSha256(region),
          observedAt: at,
        });
        predictionByFixtureId.set(fixtureId, prediction);
        await repositories.normalizedObservations.create({
          runId,
          candidateId: candidate.id,
          predictionObservationId: prediction.id,
          field: 'regionScore',
          rawValue: region.score,
          normalizedValue: region.score,
          profileVersion: 'v1',
          transformationJson: json({ kind: 'IDENTITY', syntheticFixture: true }),
        });
      }

      const summaryByFixtureId = new Map<
        string,
        Awaited<ReturnType<typeof repositories.evidenceSummaries.create>>
      >();
      const constraintByFixtureId = new Map<
        string,
        Awaited<ReturnType<typeof repositories.constraintOutcomes.create>>
      >();
      const rankingByFixtureId = new Map<
        string,
        Awaited<ReturnType<typeof repositories.rankingResults.create>>
      >();
      const coverageByFixtureId = new Map<
        string,
        Array<Awaited<ReturnType<typeof repositories.populationCoverageResults.create>>>
      >();
      for (const ranking of fixture.expectedReport.rankings) {
        const candidate = candidateByFixtureId.get(ranking.candidateId);
        if (candidate === undefined) continue;
        const binding = ranking.componentScores.binding ?? ranking.componentScores.graphBepi;
        const summary = await repositories.evidenceSummaries.create({
          runId,
          candidateId: candidate.id,
          snapshotHash: fixture.replayHash,
          bindingQuality: binding,
          weightedMean: binding,
          variance: 0,
          agreement: ranking.componentScores.consensus ?? 1,
          completeness: ranking.componentScores.completeness ?? 1,
          consensus: ranking.componentScores.consensus ?? binding,
          detailsJson: json({
            topReasons: ['Deterministic synthetic fixture replay', 'Exact configuration match'],
            sourceKind: 'SYNTHETIC',
            scientificUse: false,
          }),
        });
        summaryByFixtureId.set(ranking.candidateId, summary);
        const constraint = await repositories.constraintOutcomes.create({
          runId,
          candidateId: candidate.id,
          snapshotHash: fixture.replayHash,
          ruleId: 'FIXTURE-EXACT-MATCH',
          ruleVersion: 'mvp-v1.0',
          severity: 'HARD',
          outcome: 'PASS',
          message: 'Approved synthetic fixture exactly matched the run configuration.',
          evidenceRefsJson: json([fixture.fixtureId]),
        });
        constraintByFixtureId.set(ranking.candidateId, constraint);
        const rankingRecord = await repositories.rankingResults.create({
          runId,
          candidateId: candidate.id,
          snapshotHash: fixture.replayHash,
          profileVersion: configuration.rankingProfileVersion,
          track: ranking.track,
          componentScoresJson: json(ranking.componentScores),
          penaltiesJson: json({ fixturePenalty: 0 }),
          finalScore: ranking.finalScore,
          category: ranking.category,
          confidence: 0.6,
          rank: ranking.rank,
        });
        rankingByFixtureId.set(ranking.candidateId, rankingRecord);
        if (ranking.track !== 'BCELL') {
          const coverageRecords = [];
          for (const populationId of fixture.expectedCandidates.coverage.populationIds) {
            coverageRecords.push(
              await repositories.populationCoverageResults.create({
                runId,
                populationId,
                classMode: fixture.expectedCandidates.coverage.classMode,
                purpose: 'CANDIDATE_RANKING',
                candidateIdsJson: json([candidate.id]),
                projectedCoverage: fixture.expectedCandidates.coverage.projectedCoverage,
                averageHits: Number(fixture.expectedCandidates.coverage.metrics.averageHits ?? 0),
                provenanceJson: json({
                  sourceStatus: 'FIXTURE',
                  method: 'synthetic-population-coverage',
                  fixtureId: fixture.fixtureId,
                  scientificUse: false,
                }),
                snapshotHash: fixture.replayHash,
              }),
            );
          }
          coverageByFixtureId.set(ranking.candidateId, coverageRecords);
        }
      }
      await persistEvidenceGraph({
        repositories,
        runId,
        fixture,
        candidateByFixtureId,
        predictionByFixtureId,
        executionByTrack,
        summaryByFixtureId,
        constraintByFixtureId,
        rankingByFixtureId,
        coverageByFixtureId,
      });
      await repositories.events.appendNext({
        runId,
        stageId: stageByKey.get('final_ranking')!.id,
        eventType: 'candidate.summary_ready',
        level: 'INFO',
        message: 'Synthetic fixture candidates and rankings are ready.',
        payloadJson: json({ runId, fixtureId: fixture.fixtureId, requestId }),
      });
      await repositories.runs.transitionControl(runId, ['RUNNING'], {
        status: 'AWAITING_SHORTLIST_APPROVAL',
        quality: 'FIXTURE_ONLY',
        executionMode: 'FIXTURE',
        replayHash: fixture.replayHash,
      });
    });
  }
}

interface EvidenceGraphCandidate {
  id: string;
  candidateType: string;
  peptide: string;
  start: number;
  end: number;
  allele: string | null;
}

interface EvidenceGraphExecution {
  id: string;
  connectorId: string;
  method: string;
  methodVersion: string;
  sourceStatus: string;
}

interface EvidenceGraphConstraint {
  id: string;
  ruleId: string;
  outcome: string;
}

interface EvidenceGraphRanking {
  id: string;
  category: string;
  finalScore: number;
  rank: number;
}

interface EvidenceGraphCoverage {
  id: string;
  populationId: string;
  projectedCoverage: number;
}

async function persistEvidenceGraph(input: {
  repositories: Pick<Repositories, 'graphNodes' | 'graphEdges'>;
  runId: string;
  fixture: LoadedFixtureCase;
  candidateByFixtureId: ReadonlyMap<string, EvidenceGraphCandidate>;
  predictionByFixtureId: ReadonlyMap<string, { id: string }>;
  executionByTrack: ReadonlyMap<string, EvidenceGraphExecution>;
  summaryByFixtureId: ReadonlyMap<string, { id: string }>;
  constraintByFixtureId: ReadonlyMap<string, EvidenceGraphConstraint>;
  rankingByFixtureId: ReadonlyMap<string, EvidenceGraphRanking>;
  coverageByFixtureId: ReadonlyMap<string, readonly EvidenceGraphCoverage[]>;
}): Promise<void> {
  const nodes = new Map<string, { id: string }>();
  const addNode = async (
    key: string,
    nodeType: string,
    entityId: string,
    label: string,
    position: { x: number; y: number },
    properties: Record<string, unknown> = {},
  ) => {
    const existing = nodes.get(key);
    if (existing !== undefined) return existing;
    const created = await input.repositories.graphNodes.create({
      runId: input.runId,
      nodeType,
      entityId,
      label,
      propertiesJson: json({
        position,
        subtitle: null,
        status: null,
        sourceStatus: null,
        warningCode: null,
        detailLines: [],
        ...properties,
      }),
    });
    nodes.set(key, created);
    return created;
  };
  const addEdge = async (
    source: { id: string },
    target: { id: string },
    edgeType: string,
    label: string,
  ) => {
    await input.repositories.graphEdges.create({
      runId: input.runId,
      edgeType,
      sourceNodeId: source.id,
      targetNodeId: target.id,
      propertiesJson: json({
        label,
        provenance: `Synthetic fixture ${input.fixture.fixtureId}`,
      }),
    });
  };

  const rankings = input.fixture.expectedReport.rankings.filter(({ candidateId }) =>
    input.candidateByFixtureId.has(candidateId),
  );
  const protein = await addNode(
    'protein',
    'PROTEIN',
    input.fixture.proteinSha256,
    input.fixture.metadata.proteinName,
    { x: 0, y: Math.max(120, ((rankings.length - 1) * 320) / 2) },
    {
      subtitle: 'Synthetic input protein',
      status: 'FIXTURE',
      detailLines: [
        `${input.fixture.fasta.sequence.length} residues`,
        'Not pathogen reference data',
      ],
    },
  );
  const toolByTrack = new Map<string, { id: string }>();
  for (const [track, execution] of input.executionByTrack) {
    const lane = Math.max(
      0,
      rankings.findIndex((ranking) => ranking.track === track),
    );
    const toolKey = `tool:${execution.connectorId}:${execution.method}:${execution.methodVersion}`;
    const tool = await addNode(
      toolKey,
      'TOOL_VERSION',
      `${execution.connectorId}:${execution.method}:${execution.methodVersion}`,
      execution.method,
      { x: 900, y: lane * 320 },
      {
        subtitle: `${execution.connectorId} · ${execution.methodVersion}`,
        status: 'SUCCEEDED',
        sourceStatus: 'FIXTURE',
        detailLines: ['Synthetic provider-shaped fixture output'],
      },
    );
    toolByTrack.set(track, tool);
  }

  for (const [lane, fixtureRanking] of rankings.entries()) {
    const candidate = input.candidateByFixtureId.get(fixtureRanking.candidateId)!;
    const candidateNode = await addNode(
      `candidate:${candidate.id}`,
      'CANDIDATE',
      candidate.id,
      candidate.peptide,
      { x: 280, y: lane * 320 + 100 },
      {
        subtitle: `${candidate.candidateType} · ${candidate.start}–${candidate.end}`,
        status: fixtureRanking.category,
        sourceStatus: 'FIXTURE',
        detailLines: [candidate.allele ?? 'Allele-independent region'],
      },
    );
    await addEdge(protein, candidateNode, 'HAS_CANDIDATE', 'has candidate');

    const prediction = input.predictionByFixtureId.get(fixtureRanking.candidateId)!;
    const observationNode = await addNode(
      `observation:${prediction.id}`,
      'PREDICTION_OBSERVATION',
      prediction.id,
      'Prediction observation',
      { x: 590, y: lane * 320 },
      {
        subtitle: fixtureRanking.track,
        status: 'RECORDED',
        sourceStatus: 'FIXTURE',
        detailLines: ['Raw and normalized values available'],
      },
    );
    await addEdge(candidateNode, observationNode, 'OBSERVED_BY', 'observed by');
    const toolNode = toolByTrack.get(fixtureRanking.track)!;
    await addEdge(observationNode, toolNode, 'PRODUCED_BY', 'produced by');

    if (candidate.allele !== null) {
      const alleleNode = await addNode(
        `allele:${candidate.allele}`,
        'HLA_ALLELE',
        candidate.allele,
        candidate.allele,
        { x: 900, y: lane * 320 + 95 },
        { subtitle: `${candidate.candidateType} restriction`, detailLines: ['Configured allele'] },
      );
      await addEdge(candidateNode, alleleNode, 'RESTRICTED_TO', 'restricted to');
    }

    const summary = input.summaryByFixtureId.get(fixtureRanking.candidateId)!;
    const summaryNode = await addNode(
      `summary:${summary.id}`,
      'EVIDENCE_SUMMARY',
      summary.id,
      'Evidence summary',
      { x: 590, y: lane * 320 + 115 },
      {
        subtitle: 'Consensus and completeness',
        status: 'COMPLETE',
        sourceStatus: 'FIXTURE',
        detailLines: ['Deterministic summary snapshot'],
      },
    );
    await addEdge(candidateNode, summaryNode, 'HAS_SUMMARY', 'has summary');

    const constraint = input.constraintByFixtureId.get(fixtureRanking.candidateId)!;
    const ruleNode = await addNode(
      `rule:${constraint.ruleId}`,
      'CONSTRAINT_RULE',
      constraint.ruleId,
      'Exact fixture match',
      { x: 590, y: lane * 320 + 230 },
      {
        subtitle: constraint.ruleId,
        status: constraint.outcome,
        detailLines: ['Hard constraint'],
      },
    );
    await addEdge(candidateNode, ruleNode, 'EVALUATED_BY', 'evaluated by');

    const ranking = input.rankingByFixtureId.get(fixtureRanking.candidateId)!;
    const rankingNode = await addNode(
      `ranking:${ranking.id}`,
      'RANKING_RESULT',
      ranking.id,
      `${ranking.category} · rank ${ranking.rank}`,
      { x: 900, y: lane * 320 + 200 },
      {
        subtitle: `Final score ${ranking.finalScore.toFixed(2)}`,
        status: ranking.category,
        sourceStatus: 'FIXTURE',
        detailLines: ['Track-specific deterministic ranking'],
      },
    );
    await addEdge(candidateNode, rankingNode, 'RANKED_AS', 'ranked as');

    for (const [coverageIndex, coverage] of (
      input.coverageByFixtureId.get(fixtureRanking.candidateId) ?? []
    ).entries()) {
      const coverageNode = await addNode(
        `coverage:${coverage.id}`,
        'COVERAGE_RESULT',
        coverage.id,
        coverage.populationId,
        { x: 1210, y: lane * 320 + coverageIndex * 110 + 70 },
        {
          subtitle: `Estimated coverage ${(coverage.projectedCoverage * 100).toFixed(0)}%`,
          status: 'ESTIMATED',
          sourceStatus: 'FIXTURE',
          detailLines: ['Synthetic population fixture'],
        },
      );
      await addEdge(
        candidateNode,
        coverageNode,
        'INCLUDED_IN_COVERAGE_SET',
        'included in coverage',
      );
    }
  }
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return [...left].sort().join('|') === [...right].sort().join('|');
}

function requiredTrack(
  configuration: ReturnType<typeof parseStoredRunConfiguration>['request'],
  track: 'MHCI' | 'MHCII' | 'BCELL',
): boolean {
  return track === 'MHCI'
    ? configuration.analysis.mhci.enabled
    : track === 'MHCII'
      ? configuration.analysis.mhcii.enabled
      : configuration.analysis.bcell.enabled;
}
