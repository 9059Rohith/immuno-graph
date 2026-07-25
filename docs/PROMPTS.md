# LLM Prompt Specification

## 1. LLM boundary

LLM use is optional. It may explain or summarize validated structured evidence. It may not predict biology, generate scores, change rules, select candidates, approve a run, or call scientific tools.

Every prompt has a version, input Zod schema, output Zod schema, token limit, and deterministic fallback.

## 2. Shared system prompt

**ID:** `immunograph-grounded-explainer-v1`

```text
You are the grounded explanation component of ImmunoGraph, a computational
epitope-prioritization decision-support system.

Use only the structured evidence supplied in the request. Do not add biological
facts, scores, mechanisms, safety claims, efficacy claims, experimental results,
or recommendations that are absent from the evidence.

Never describe a candidate as validated, safe, effective, clinically useful, or
proven. Say "predicted", "computationally prioritized", and "requires
experimental validation" where relevant.

Preserve every candidate ID, peptide, coordinate, allele, number, unit,
category, confidence label, connector source status, and rule ID exactly.
Do not resolve contradictions yourself. State that the evidence conflicts.

Do not reveal hidden reasoning or chain-of-thought. Return only the requested
JSON object matching the output schema.
```

## 3. Explain candidate

**Prompt ID:** `explain-candidate-v1`

### Input

```ts
{
  audience: 'RESEARCHER' | 'JUDGE';
  candidate: {
    id: string;
    track: 'MHCI' | 'MHCII' | 'BCELL';
    peptide: string;
    start: number;
    end: number;
    allele?: string;
    category: string;
    confidence: string;
    finalScore: number;
    rank: number;
  };
  scoreComponents: Array<{ name: string; value: number; weight: number }>;
  observations: Array<{
    method: string;
    methodVersion: string;
    sourceStatus: 'LIVE' | 'CACHED' | 'SYNTHETIC' | 'FIXTURE';
    rawScores: Record<string, number | string | null>;
    normalizedScores: Record<string, number>;
  }>;
  ruleOutcomes: Array<{
    ruleId: string;
    severity: 'HARD' | 'SOFT';
    outcome: 'PASS' | 'WARN' | 'FAIL' | 'NOT_EVALUATED';
    message: string;
  }>;
  deterministicExplanation: string;
}
```

### User template

```text
Explain the following already-computed candidate decision for the requested
audience. Do not recalculate or reinterpret values.

<evidence_json>
{{CANONICAL_JSON}}
</evidence_json>
```

### Output

```ts
{
  summary: string;
  supportingEvidence: string[];
  warnings: string[];
  provenanceNote: string;
  limitation: string;
}
```

Limits: summary 120 words; at most five supporting bullets and five warnings.

### Validation

- All IDs/numbers/units/rule IDs in output occur verbatim in input.
- No prohibited claim vocabulary.
- Category and confidence match.
- Fixture and synthetic demonstration provenance are disclosed.
- On failure, return `deterministicExplanation`.

## 4. Summarize run

**Prompt ID:** `summarize-run-v1`

### Input

Run ID/quality, protein metadata without full sequence, requested tracks, connector status matrix, candidate counts, approved candidate summaries, rejection-rule counts, warnings, profile versions, and deterministic summary.

### User template

```text
Create a concise research-workspace summary of this completed computational run.
Separate computational findings, data-source/provenance limitations, researcher
approval, and required next validation. Do not propose a wet-lab protocol.

<run_json>
{{CANONICAL_JSON}}
</run_json>
```

### Output

```ts
{
  overview: string;
  findings: string[];
  provenanceAndQuality: string[];
  limitations: string[];
  approvalSummary: string;
  requiredDisclaimer: string;
}
```

The required disclaimer must equal the supplied disclaimer exactly.

## 5. Answer evidence question

**Prompt ID:** `answer-evidence-question-v1`

This prompt is optional/post-MVP unless the UI includes evidence Q&A.

### Input

```ts
{
  question: string;
  allowedCandidateIds: string[];
  evidenceFacts: Array<{
    factId: string;
    subject: string;
    predicate: string;
    object: string;
    evidenceRefs: string[];
  }>;
}
```

### Instruction

```text
Answer only from evidenceFacts. Cite fact IDs in each answer sentence. If the
facts do not answer the question, return answered=false and state that the
recorded evidence is insufficient. Do not use outside knowledge.
```

### Output

```ts
{
  answered: boolean;
  answer: string;
  citedFactIds: string[];
}
```

## 6. Prohibited prompts

Do not implement prompts that ask an LLM to:

- predict MHC binding or B-cell epitopes;
- estimate population coverage;
- choose normalization or ranking weights;
- waive constraints;
- label a candidate safe/effective;
- approve a shortlist;
- invent missing evidence;
- generate wet-lab or clinical instructions;
- expose chain-of-thought.

## 7. Provider abstraction

```ts
interface ExplanationProvider {
  generate<TInput, TOutput>(request: {
    promptId: string;
    promptVersion: string;
    input: TInput;
    outputSchema: z.ZodType<TOutput>;
    signal: AbortSignal;
  }): Promise<TOutput>;
}
```

Provider/model name, version, prompt version, input hash, output hash, duration, and validation result are recorded. Prompt input content is not written to ordinary logs.

## 8. Deterministic fallback

Each prompt call has a precomputed deterministic alternative. LLM unavailability, timeout, refusal, invalid JSON, unsupported claim, or grounding mismatch returns the fallback with `generationModeUsed: DETERMINISTIC_FALLBACK`.

The workflow and report remain complete without an LLM.

## 9. Prompt tests

- exact numeric preservation;
- category/rule preservation;
- fixture disclosure;
- conflicting evidence stated, not resolved;
- insufficient evidence abstention;
- prompt-injection strings in project metadata ignored;
- prohibited claims rejected;
- invalid model JSON falls back;
- LLM disabled completes successfully.
