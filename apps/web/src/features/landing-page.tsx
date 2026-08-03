import {
  ArrowRight,
  BadgeCheck,
  Braces,
  Check,
  CircleDotDashed,
  Clock3,
  Dna,
  FileCheck2,
  GitBranch,
  LoaderCircle,
  Network,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import heroImage from '@/assets/judge-evidence-hero.webp';
import { Button } from '@/components/ui/button';
import { useJudgeMode } from '@/features/judge-mode';

const proofPoints = [
  ['Deterministic fixture', CircleDotDashed],
  ['Immutable profile hashes', Braces],
  ['Human approval gates', BadgeCheck],
  ['Exportable provenance', FileCheck2],
] as const;

const workflow = [
  {
    number: '01',
    title: 'Constrain the question',
    description:
      'A curated synthetic FASTA and fixed profile make the judged run safe and repeatable.',
  },
  {
    number: '02',
    title: 'Orchestrate specialist tools',
    description:
      'The domain agent coordinates MHC-I, MHC-II, B-cell, coverage, and ranking stages.',
  },
  {
    number: '03',
    title: 'Inspect every decision',
    description:
      'Candidates remain connected to source status, constraints, scores, and approvals.',
  },
] as const;

export function LandingPage() {
  const judge = useJudgeMode();
  return (
    <main className="judge-landing">
      <nav className="judge-nav" aria-label="Primary navigation">
        <Link className="judge-brand" to="/">
          <span>
            <Network aria-hidden="true" />
          </span>
          ImmunoGraph
        </Link>
        <div className="judge-nav-links">
          <a href="#workflow">Workflow</a>
          <a href="#trust-model">Trust model</a>
          <Link to="/workspace">Research workspace</Link>
        </div>
      </nav>

      <section className="judge-hero" aria-labelledby="judge-title">
        <img className="judge-hero-image" src={heroImage} alt="" aria-hidden="true" />
        <div className="judge-hero-scrim" />
        <div className="judge-hero-content">
          <p className="judge-track">
            <Sparkles aria-hidden="true" /> Track 4 — Domain Agents
          </p>
          <h1 id="judge-title">Auditable epitope prioritization, from sequence to evidence.</h1>
          <p className="judge-lede">
            ImmunoGraph is a human-governed computational immunology agent that turns a protein
            sequence into a ranked, traceable shortlist—without hiding the sources, constraints, or
            approval decisions behind the answer.
          </p>
          <div className="judge-actions">
            <Button
              className="judge-primary-action"
              size="lg"
              disabled={judge.pending}
              onClick={() => void judge.startJudgeDemo()}
            >
              {judge.pending ? <LoaderCircle className="animate-spin" /> : <Dna />}
              {judge.pending ? 'Preparing workspace…' : 'Launch judge demo'}
              {!judge.pending && <ArrowRight />}
            </Button>
            <a className="judge-secondary-action" href="#trust-model">
              See the trust model
            </a>
          </div>
          {judge.error !== null && (
            <p className="judge-error" role="alert">
              {judge.error}
            </p>
          )}
          <p className="judge-disclaimer">
            <ShieldCheck aria-hidden="true" /> Synthetic demonstration only. Not experimental,
            clinical, efficacy, or pathogen-reference evidence. No account required.
          </p>
        </div>
      </section>

      <section className="judge-proof" aria-label="Technical proof points">
        {proofPoints.map(([label, Icon]) => (
          <div key={label}>
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </div>
        ))}
      </section>

      <section className="judge-section" id="workflow">
        <div className="judge-section-heading">
          <p className="judge-kicker">One agent. Multiple scientific checkpoints.</p>
          <h2>A workflow judges can understand in under three minutes.</h2>
          <p>
            Each stage leaves inspectable state instead of collapsing the process into one opaque
            score.
          </p>
        </div>
        <div className="judge-workflow-grid">
          {workflow.map((step) => (
            <article key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="judge-trust" id="trust-model">
        <div>
          <p className="judge-kicker">Evidence before confidence</p>
          <h2>Designed to show why a result exists—not just what ranked first.</h2>
          <p>
            The judge demo is isolated for 24 hours, locked to reviewed synthetic fixtures, and
            preserves the workflow trace needed to reproduce every recommendation.
          </p>
        </div>
        <ul>
          <li>
            <Check aria-hidden="true" />
            <span>
              <strong>Source-aware</strong> Live, cached, fixture, and failed evidence never look
              identical.
            </span>
          </li>
          <li>
            <Check aria-hidden="true" />
            <span>
              <strong>Human-governed</strong> Configuration and shortlist approval are explicit
              gates.
            </span>
          </li>
          <li>
            <Check aria-hidden="true" />
            <span>
              <strong>Time-bounded</strong> <Clock3 aria-hidden="true" /> Public demo workspaces
              expire automatically.
            </span>
          </li>
          <li>
            <Check aria-hidden="true" />
            <span>
              <strong>Reproducible</strong> <GitBranch aria-hidden="true" /> Profiles, hashes,
              events, and artifacts travel together.
            </span>
          </li>
        </ul>
      </section>

      <footer className="judge-footer">
        <span>ImmunoGraph · Computational demonstration</span>
        <button disabled={judge.pending} onClick={() => void judge.startJudgeDemo()}>
          Open the judge workspace <ArrowRight aria-hidden="true" />
        </button>
      </footer>
    </main>
  );
}
