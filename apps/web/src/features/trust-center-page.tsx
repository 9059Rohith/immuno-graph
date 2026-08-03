import type { TrustCheck } from '@immunograph/shared';
import { ArrowRight, CheckCircle2, CircleAlert, CircleSlash2, Fingerprint } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { ErrorState, LoadingState } from '@/components/page-state';
import { SourceStatusBadge } from '@/components/source-status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useTrustSummary } from './data-hooks';

const statusPresentation: Record<
  TrustCheck['status'],
  { icon: typeof CheckCircle2; variant: 'live' | 'destructive' | 'outline' }
> = {
  PASS: { icon: CheckCircle2, variant: 'live' },
  FAIL: { icon: CircleAlert, variant: 'destructive' },
  UNAVAILABLE: { icon: CircleSlash2, variant: 'outline' },
};

function Hash({ children }: { children: string }) {
  return (
    <code className="block max-w-full select-all overflow-x-auto rounded-md bg-muted px-2 py-1 font-mono text-xs">
      {children}
    </code>
  );
}

export function TrustCenterPage() {
  const runId = useParams().runId ?? '';
  const query = useTrustSummary(runId);
  if (query.isLoading) return <LoadingState label="Loading scientific trust evidence" />;
  if (query.isError)
    return <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />;
  if (!query.data) return null;
  const summary = query.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Deterministic audit view
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Scientific Trust Center</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Inspect the exact records behind this run. Every check points to stored evidence and
            remains unavailable when the workflow has not produced it.
          </p>
        </div>
        <Button asChild>
          <Link to={`/runs/${runId}/reports`}>
            Continue to reports <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>

      <Alert className="border-fixture-border bg-fixture">
        <CircleAlert aria-hidden="true" />
        <AlertTitle>{summary.disclaimer}</AlertTitle>
        <AlertDescription>
          This page verifies software behavior and recorded provenance. It does not validate a
          biological prediction or establish clinical fitness.
        </AlertDescription>
      </Alert>

      <section aria-labelledby="trust-checks-heading" className="space-y-3">
        <div>
          <h2 id="trust-checks-heading" className="text-xl font-semibold">
            Open checks
          </h2>
          <p className="text-sm text-muted-foreground">
            No aggregate score: each claim is independently inspectable.
          </p>
        </div>
        <div className="divide-y rounded-xl border bg-card">
          {summary.checks.map((check) => {
            const presentation = statusPresentation[check.status];
            const Icon = presentation.icon;
            return (
              <article className="grid gap-3 p-4 md:grid-cols-[220px_1fr_auto]" key={check.id}>
                <h3 className="font-semibold">{check.label}</h3>
                <div>
                  <p className="text-sm">{check.detail}</p>
                  <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
                    {check.evidence.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <Badge className="self-start" variant={presentation.variant}>
                  <Icon aria-hidden="true" /> {check.status}
                </Badge>
              </article>
            );
          })}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Immutable run identity</CardTitle>
            <CardDescription>
              Revision {summary.run.revision} · {summary.run.status} ·{' '}
              {summary.run.executionMode ?? summary.run.requestedExecutionMode ?? 'not executed'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Configuration SHA-256</p>
              <Hash>{summary.run.configurationHash}</Hash>
            </div>
            {summary.fixtureManifest ? (
              <>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Fixture manifest SHA-256
                  </p>
                  <Hash>{summary.fixtureManifest.sha256}</Hash>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Dengue entry SHA-256
                  </p>
                  <Hash>{summary.fixtureManifest.entrySha256}</Hash>
                </div>
                <p className="text-xs text-muted-foreground">
                  {summary.fixtureManifest.version} · approved synthetic fixture · scientificUse =
                  false
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Fixture manifest evidence unavailable.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Source provenance</CardTitle>
            <CardDescription>Connector execution records by explicit source state.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source state</TableHead>
                  <TableHead className="text-right">Executions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.sourceCounts.map((source) => (
                  <TableRow key={source.status}>
                    <TableCell>
                      <SourceStatusBadge status={source.status} />
                    </TableCell>
                    <TableCell className="text-right font-mono">{source.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workflow hash chain</CardTitle>
          <CardDescription>Recorded stage inputs and outputs, including retry attempts.</CardDescription>
        </CardHeader>
        <CardContent>
          {summary.stages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No stage hashes exist until the approved run starts.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Input hash</TableHead>
                  <TableHead>Output hash</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.stages.map((stage) => (
                  <TableRow key={`${stage.stageKey}-${stage.attempt}`}>
                    <TableCell className="font-medium">
                      {stage.stageKey} <span className="text-muted-foreground">#{stage.attempt}</span>
                    </TableCell>
                    <TableCell>{stage.status}</TableCell>
                    <TableCell><Hash>{stage.inputHash}</Hash></TableCell>
                    <TableCell>
                      {stage.outputHash ? <Hash>{stage.outputHash}</Hash> : 'Unavailable'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Approval snapshots</CardTitle>
            <CardDescription>Human decisions bound to immutable snapshot hashes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.approvals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No approvals recorded yet.</p>
            ) : (
              summary.approvals.map((approval) => (
                <div className="space-y-2 rounded-lg border p-3" key={approval.id}>
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-sm">{approval.type}</strong>
                    <Badge variant={approval.status === 'APPROVED' ? 'live' : 'outline'}>
                      {approval.status}
                    </Badge>
                  </div>
                  <Hash>{approval.snapshotHash}</Hash>
                  <p className="text-xs text-muted-foreground">{approval.recordedAt}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Generated artifact hashes</CardTitle>
            <CardDescription>Downloadable outputs are content-addressed with SHA-256.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.artifacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No artifact hashes yet. Complete approval and generate a report.
              </p>
            ) : (
              summary.artifacts.map((artifact) => (
                <div className="space-y-2 rounded-lg border p-3" key={artifact.id}>
                  <div className="flex items-center gap-2">
                    <Fingerprint aria-hidden="true" className="size-4 text-primary" />
                    <strong className="text-sm">
                      {artifact.type} · {artifact.format}
                    </strong>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {artifact.byteSize.toLocaleString()} bytes
                    </span>
                  </div>
                  <Hash>{artifact.sha256}</Hash>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Evaluated from repository records at {summary.evaluatedAt}.
      </p>
    </div>
  );
}
