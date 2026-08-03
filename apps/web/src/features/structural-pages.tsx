import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  Atom,
  Box,
  ChevronRight,
  CirclePlay,
  Cuboid,
  Database,
  LoaderCircle,
  Orbit,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiJson, apiRequest, apiUrl } from '@/lib/api-client';

const modelSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  source: z.string(),
  sourceReference: z.string().nullable(),
  format: z.string(),
  provider: z.string(),
  status: z.string(),
  createdAt: z.string(),
});
const modelsSchema = z.object({ items: z.array(modelSchema) });
const jobSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  engine: z.string(),
  score: z.number().nullable(),
  createdAt: z.string(),
  receptor: modelSchema,
  ligand: modelSchema,
});

export function StructuresPage() {
  const client = useQueryClient();
  const [selected, setSelected] = useState<z.infer<typeof modelSchema> | null>(null);
  const [source, setSource] = useState<'PDB' | 'ALPHAFOLD'>('PDB');
  const models = useQuery({
    queryKey: ['structures'],
    queryFn: () => apiRequest('/structures', modelsSchema),
  });
  const [structureDataUrl, setStructureDataUrl] = useState('');
  useEffect(() => {
    let cancelled = false;
    if (selected === null)
      return () => {
        cancelled = true;
      };
    void fetch(
      apiUrl(
        `/structures/${selected.id}/file${selected.status === 'DEMONSTRATION_ONLY' ? '?demo=1' : ''}`,
      ),
      { credentials: 'include' },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error(`Structure download failed (${response.status})`);
        return response.text();
      })
      .then((content) => {
        if (!cancelled) setStructureDataUrl(`data:text/plain;base64,${btoa(content)}`);
      })
      .catch(() => {
        if (!cancelled) setStructureDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);
  const create = useMutation({
    mutationFn: (body: unknown) =>
      apiRequest(
        '/structures/import-reference',
        z.object({ model: modelSchema }),
        apiJson('POST', body),
      ),
    onSuccess: async ({ model }) => {
      setSelected(model);
      await client.invalidateQueries({ queryKey: ['structures'] });
    },
  });
  const demo = useMutation({
    mutationFn: () =>
      apiRequest(
        '/demo/structural-lab',
        z.object({ models: z.array(modelSchema), demonstrationOnly: z.boolean() }),
        apiJson('POST', {}),
      ),
    onSuccess: async ({ models: seeded }) => {
      setSelected(seeded[0] ?? null);
      await client.invalidateQueries({ queryKey: ['structures'] });
    },
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    create.mutate({ name: data.get('name'), source, reference: data.get('reference') });
  };
  const fileUrl = structureDataUrl;
  return (
    <div className="page-enter space-y-6">
      <ExperimentalWorkflowNotice />
      <PageIntro
        icon={Cuboid}
        eyebrow="Structural biology"
        title="3D Structure Studio"
        description="Import structures or load a reproducible offline demonstration with private coordinate delivery."
      />
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-5">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Add structure</CardTitle>
              <CardDescription>
                Coordinates are stored in your private artifact volume.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={submit}>
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Select
                    value={source}
                    onValueChange={(value) => setSource(value as 'PDB' | 'ALPHAFOLD')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PDB">RCSB Protein Data Bank</SelectItem>
                      <SelectItem value="ALPHAFOLD">AlphaFold Database</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model-name">Model name</Label>
                  <Input
                    id="model-name"
                    name="name"
                    required
                    placeholder="Spike receptor complex"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model-ref">
                    {source === 'PDB' ? 'PDB ID' : 'UniProt accession'}
                  </Label>
                  <Input
                    id="model-ref"
                    name="reference"
                    required
                    placeholder={source === 'PDB' ? '6VXX' : 'P0DTC2'}
                  />
                </div>
                <Button className="w-full" disabled={create.isPending}>
                  {create.isPending ? <LoaderCircle className="animate-spin" /> : <Database />}{' '}
                  Import model
                </Button>
                {create.error && <p className="text-sm text-destructive">{create.error.message}</p>}
              </form>
              <Button
                className="mt-3 w-full"
                variant="outline"
                disabled={demo.isPending}
                onClick={() => demo.mutate()}
              >
                {demo.isPending ? <LoaderCircle className="animate-spin" /> : <Atom />} Load offline
                demo
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Model library</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {models.data?.items.map((model) => (
                <button className="model-row" key={model.id} onClick={() => setSelected(model)}>
                  <span>
                    <strong>{model.name}</strong>
                    <small>
                      {model.provider} · {model.sourceReference}
                    </small>
                  </span>
                  <ChevronRight />
                </button>
              ))}
              {models.data?.items.length === 0 && (
                <p className="text-sm text-muted-foreground">No structures imported yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
        <Card className="viewer-card">
          <CardHeader>
            <div>
              <CardTitle>Interactive molecular viewer</CardTitle>
              <CardDescription>
                {selected
                  ? `${selected.name} · ${selected.format.toUpperCase()}`
                  : 'Select a model from your library'}
              </CardDescription>
            </div>
            <span className="status-pill">
              <Orbit /> WebGL viewer
            </span>
          </CardHeader>
          <CardContent className="p-0">
            {selected && fileUrl ? (
              <iframe
                title={`3D model of ${selected.name}`}
                className="molecular-viewer"
                src={`https://molstar.org/viewer/?structure-url=${encodeURIComponent(fileUrl)}&structure-url-format=${selected.format}&hide-controls=0`}
              />
            ) : (
              <div className="viewer-empty">
                <Atom />
                <h3>{selected ? 'Preparing secure viewer' : 'Your structure appears here'}</h3>
                <p>
                  {selected
                    ? 'Creating a short-lived private coordinate link.'
                    : 'Import a PDB or AlphaFold model to inspect chains, residues, surfaces, and confidence.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function DockingPage() {
  const client = useQueryClient();
  const [receptor, setReceptor] = useState('');
  const [ligand, setLigand] = useState('');
  const models = useQuery({
    queryKey: ['structures'],
    queryFn: () => apiRequest('/structures', modelsSchema),
  });
  const jobs = useQuery({
    queryKey: ['docking'],
    queryFn: () => apiRequest('/docking/jobs', z.object({ items: z.array(jobSchema) })),
  });
  const run = useMutation({
    mutationFn: () =>
      apiRequest(
        '/docking/jobs',
        z.object({
          job: jobSchema.omit({ receptor: true, ligand: true }),
          demonstrationOnly: z.boolean().optional(),
        }),
        apiJson('POST', {
          receptorId: receptor,
          ligandId: ligand,
          parameters: { exhaustiveness: 8 },
        }),
      ),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['docking'] });
    },
  });
  return (
    <div className="page-enter space-y-6">
      <ExperimentalWorkflowNotice />
      <PageIntro
        icon={Box}
        eyebrow="Molecular docking"
        title="Docking Laboratory"
        description="Submit receptor–ligand jobs to your configured engine or run the clearly labeled offline demonstration."
      />
      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Configure a docking run</CardTitle>
            <CardDescription>
              Both inputs must be validated models in your structure library.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ModelSelect
              label="Receptor"
              value={receptor}
              onChange={setReceptor}
              models={models.data?.items ?? []}
            />
            <ModelSelect
              label="Ligand / peptide"
              value={ligand}
              onChange={setLigand}
              models={models.data?.items ?? []}
            />
            <div className="rounded-xl border bg-muted/50 p-4 text-sm">
              <strong>Engine contract</strong>
              <p className="mt-1 text-muted-foreground">
                Production sends coordinate files to DOCKING_PROVIDER_URL. Demo mode uses
                deterministic local output marked demonstration-only.
              </p>
            </div>
            <Button
              className="h-12 w-full"
              disabled={!receptor || !ligand || run.isPending}
              onClick={() => run.mutate()}
            >
              {run.isPending ? <LoaderCircle className="animate-spin" /> : <CirclePlay />} Run
              docking
            </Button>
            {run.error && <p className="text-sm text-destructive">{run.error.message}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Docking history</CardTitle>
            <CardDescription>Engine provenance and pose scores.</CardDescription>
          </CardHeader>
          <CardContent>
            {jobs.data?.items.length ? (
              <div className="space-y-3">
                {jobs.data.items.map((job) => (
                  <div className="docking-row" key={job.id}>
                    <span className={`job-dot ${job.status.toLowerCase()}`} />
                    <div>
                      <strong>
                        {job.receptor.name} × {job.ligand.name}
                      </strong>
                      <p>
                        {job.engine} · {new Date(job.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="ml-auto text-right">
                      <strong>{job.score ?? '—'}</strong>
                      <p>{job.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="viewer-empty min-h-64">
                <Box />
                <h3>No docking jobs yet</h3>
                <p>Your validated docking results will appear here.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ExperimentalWorkflowNotice() {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
      <strong>Experimental — outside the judged workflow.</strong> This lab is an optional extension
      and is not part of the validated epitope evidence journey.
    </div>
  );
}

function ModelSelect({
  label,
  value,
  onChange,
  models,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  models: z.infer<typeof modelSchema>[];
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={`Choose ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {models.map((model) => (
            <SelectItem key={model.id} value={model.id}>
              {model.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
function PageIntro({
  icon: Icon,
  eyebrow,
  title,
  description,
}: {
  icon: typeof Atom;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="hero-strip">
      <div className="hero-icon">
        <Icon />
      </div>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </header>
  );
}
