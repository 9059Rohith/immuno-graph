import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type { DatabaseClient } from '@immunograph/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { ApiError } from './http.js';
import { requireAuthenticatedUser } from './auth.js';

const referenceSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    source: z.enum(['PDB', 'ALPHAFOLD']),
    reference: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{4,20}$/),
  })
  .strict();
const dockingSchema = z
  .object({
    receptorId: z.string().uuid(),
    ligandId: z.string().uuid(),
    parameters: z.record(z.unknown()).default({}),
  })
  .strict();
const MAX_STRUCTURE_BYTES = 25 * 1024 * 1024;
const viewerSecret = () =>
  process.env.VIEWER_TOKEN_SECRET ?? 'immunograph-development-viewer-secret';
const encode = (value: string) => Buffer.from(value).toString('base64url');
const viewerToken = (id: string) => {
  const payload = encode(JSON.stringify({ id, exp: Date.now() + 5 * 60_000 }));
  const signature = createHmac('sha256', viewerSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
};
const validViewerToken = (token: unknown, id: string) => {
  if (typeof token !== 'string') return false;
  const [payload, signature] = token.split('.');
  if (payload === undefined || signature === undefined) return false;
  const expected = createHmac('sha256', viewerSecret()).update(payload).digest();
  const supplied = Buffer.from(signature, 'base64url');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      id?: string;
      exp?: number;
    };
    return parsed.id === id && typeof parsed.exp === 'number' && parsed.exp > Date.now();
  } catch {
    return false;
  }
};
const DEMO_PDB = `HEADER    IMMUNOGRAPH DEMONSTRATION MODEL\nATOM      1  N   DEM A   1       0.000   0.000   0.000  1.00 90.00           N\nATOM      2  CA  DEM A   1       1.450   0.000   0.000  1.00 90.00           C\nATOM      3  C   DEM A   1       2.000   1.350   0.000  1.00 90.00           C\nEND\n`;
const publicModel = (model: {
  id: string;
  name: string;
  source: string;
  sourceReference: string | null;
  format: string;
  sha256: string;
  provider: string;
  providerVersion: string | null;
  status: string;
  createdAt: Date;
}) => ({
  id: model.id,
  name: model.name,
  source: model.source,
  sourceReference: model.sourceReference,
  format: model.format,
  sha256: model.sha256,
  provider: model.provider,
  providerVersion: model.providerVersion,
  status: model.status,
  createdAt: model.createdAt,
});

async function download(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(120_000),
    headers: { Accept: 'chemical/x-pdb,chemical/x-mmcif,text/plain' },
  });
  if (!response.ok)
    throw new ApiError(
      'STRUCTURE_PROVIDER_ERROR',
      502,
      `Structure provider returned HTTP ${response.status}.`,
      true,
    );
  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > MAX_STRUCTURE_BYTES)
    throw new ApiError('STRUCTURE_TOO_LARGE', 413, 'The structure exceeds the 25 MB limit.');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_STRUCTURE_BYTES)
    throw new ApiError(
      'INVALID_STRUCTURE',
      422,
      'The provider returned an empty or oversized structure.',
    );
  return bytes;
}

export function registerStructuralBiologyRoutes(
  app: FastifyInstance,
  database: DatabaseClient,
  artifactRoot: string,
): void {
  const root = resolve(artifactRoot, 'structures');
  app.get('/api/v1/structures', async (request) => {
    await requireAuthenticatedUser(database, request);
    const items = await database.structureModel.findMany({ orderBy: { createdAt: 'desc' } });
    return { requestId: String(request.id), data: { items: items.map(publicModel) } };
  });
  app.post('/api/v1/demo/structural-lab', async (request, reply) => {
    await requireAuthenticatedUser(database, request);
    if (process.env.DEMO_MODE === 'false')
      throw new ApiError('DEMO_MODE_DISABLED', 403, 'Enable DEMO_MODE to load demonstration data.');
    const existing = await database.structureModel.findMany({
      where: { source: 'DEMO' },
      orderBy: { createdAt: 'asc' },
    });
    if (existing.length >= 2)
      return reply.status(200).send({
        requestId: String(request.id),
        data: { models: existing.map(publicModel), demonstrationOnly: true },
      });
    const rootHash = createHash('sha256').update(DEMO_PDB).digest('hex');
    await mkdir(root, { recursive: true });
    const models = [];
    for (const [index, name] of ['Demo receptor', 'Demo ligand'].entries()) {
      const id = randomUUID();
      const path = join(root, `${id}.pdb`);
      await writeFile(path, DEMO_PDB, { flag: 'wx' });
      models.push(
        await database.structureModel.create({
          data: {
            id,
            name,
            source: 'DEMO',
            sourceReference: `demo-${index + 1}`,
            format: 'pdb',
            artifactPath: path,
            sha256: rootHash,
            provider: 'ImmunoGraph demo',
            providerVersion: 'demo-v1',
            status: 'DEMONSTRATION_ONLY',
          },
        }),
      );
    }
    return reply.status(201).send({
      requestId: String(request.id),
      data: { models: models.map(publicModel), demonstrationOnly: true },
    });
  });
  app.post('/api/v1/structures/import-reference', async (request, reply) => {
    await requireAuthenticatedUser(database, request);
    const parsed = referenceSchema.safeParse(request.body);
    if (!parsed.success)
      throw new ApiError('VALIDATION_ERROR', 400, 'Provide a valid PDB or AlphaFold reference.');
    const reference = parsed.data.reference.toUpperCase();
    const format = parsed.data.source === 'PDB' ? 'mmcif' : 'pdb';
    const url =
      parsed.data.source === 'PDB'
        ? `https://files.rcsb.org/download/${reference}.cif`
        : `https://alphafold.ebi.ac.uk/files/AF-${reference}-F1-model_v4.pdb`;
    const bytes = await download(url);
    await mkdir(root, { recursive: true });
    const id = randomUUID();
    const path = join(root, `${id}.${format === 'mmcif' ? 'cif' : 'pdb'}`);
    await writeFile(path, bytes, { flag: 'wx' });
    const model = await database.structureModel.create({
      data: {
        id,
        name: parsed.data.name,
        source: parsed.data.source,
        sourceReference: reference,
        format,
        artifactPath: path,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        provider: parsed.data.source === 'PDB' ? 'RCSB PDB' : 'AlphaFold DB',
        providerVersion: parsed.data.source === 'ALPHAFOLD' ? 'model_v4' : null,
        status: 'READY',
      },
    });
    return reply
      .status(201)
      .send({ requestId: String(request.id), data: { model: publicModel(model) } });
  });
  app.get('/api/v1/structures/:id/file', async (request, reply) => {
    const id = z
      .string()
      .uuid()
      .safeParse((request.params as { id?: unknown }).id);
    if (!id.success) throw new ApiError('VALIDATION_ERROR', 400, 'Invalid structure identifier.');
    const query = request.query as { viewerToken?: unknown; demo?: unknown };
    if (!validViewerToken(query.viewerToken, id.data) && query.demo !== '1')
      await requireAuthenticatedUser(database, request);
    const model = await database.structureModel.findUnique({ where: { id: id.data } });
    if (model === null) throw new ApiError('STRUCTURE_NOT_FOUND', 404, 'Structure was not found.');
    if (query.demo === '1' && model.status !== 'DEMONSTRATION_ONLY')
      await requireAuthenticatedUser(database, request);
    const bytes = await readFile(model.artifactPath);
    return reply
      .header('Access-Control-Allow-Origin', 'https://molstar.org')
      .header('Access-Control-Allow-Methods', 'GET, OPTIONS')
      .header('Access-Control-Allow-Headers', 'Range')
      .header('Cross-Origin-Resource-Policy', 'cross-origin')
      .type(model.format === 'pdb' ? 'chemical/x-pdb' : 'chemical/x-mmcif')
      .send(bytes);
  });
  app.options('/api/v1/structures/:id/file', async (_request, reply) =>
    reply
      .status(204)
      .header('Access-Control-Allow-Origin', 'https://molstar.org')
      .header('Access-Control-Allow-Methods', 'GET, OPTIONS')
      .header('Access-Control-Allow-Headers', 'Range')
      .send(),
  );
  app.get('/api/v1/structures/:id/viewer-token', async (request) => {
    await requireAuthenticatedUser(database, request);
    const id = z
      .string()
      .uuid()
      .safeParse((request.params as { id?: unknown }).id);
    if (!id.success) throw new ApiError('VALIDATION_ERROR', 400, 'Invalid structure identifier.');
    const model = await database.structureModel.findUnique({
      where: { id: id.data },
      select: { id: true },
    });
    if (model === null) throw new ApiError('STRUCTURE_NOT_FOUND', 404, 'Structure was not found.');
    return {
      requestId: String(request.id),
      data: { token: viewerToken(id.data), expiresInSeconds: 300 },
    };
  });
  app.get('/api/v1/docking/jobs', async (request) => {
    await requireAuthenticatedUser(database, request);
    const items = await database.dockingJob.findMany({
      orderBy: { createdAt: 'desc' },
      include: { receptor: true, ligand: true },
    });
    return {
      requestId: String(request.id),
      data: {
        items: items.map((job) => ({
          ...job,
          receptor: publicModel(job.receptor),
          ligand: publicModel(job.ligand),
        })),
      },
    };
  });
  app.post('/api/v1/docking/jobs', async (request, reply) => {
    await requireAuthenticatedUser(database, request);
    const parsed = dockingSchema.safeParse(request.body);
    if (!parsed.success)
      throw new ApiError('VALIDATION_ERROR', 400, 'Choose valid receptor and ligand structures.');
    const providerUrl = process.env.DOCKING_PROVIDER_URL;
    if (
      (providerUrl === undefined || providerUrl.trim() === '') &&
      process.env.DEMO_MODE !== 'false'
    ) {
      const [receptor, ligand] = await Promise.all([
        database.structureModel.findUnique({ where: { id: parsed.data.receptorId } }),
        database.structureModel.findUnique({ where: { id: parsed.data.ligandId } }),
      ]);
      if (receptor === null || ligand === null)
        throw new ApiError(
          'STRUCTURE_NOT_FOUND',
          404,
          'The receptor or ligand structure was not found.',
        );
      const job = await database.dockingJob.create({
        data: {
          receptorId: receptor.id,
          ligandId: ligand.id,
          engine: 'demo-docking',
          engineVersion: 'demo-v1',
          status: 'SUCCEEDED',
          parametersJson: JSON.stringify({ ...parsed.data.parameters, demonstrationOnly: true }),
          score: -4.2,
          poseArtifactPath: ligand.artifactPath,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      });
      return reply.status(201).send({
        requestId: String(request.id),
        data: {
          job: { ...job, receptor: publicModel(receptor), ligand: publicModel(ligand) },
          demonstrationOnly: true,
        },
      });
    }
    if (providerUrl === undefined || providerUrl.trim() === '')
      throw new ApiError(
        'DOCKING_ENGINE_NOT_CONFIGURED',
        503,
        'Configure DOCKING_PROVIDER_URL to run docking jobs.',
      );
    const [receptor, ligand] = await Promise.all([
      database.structureModel.findUnique({ where: { id: parsed.data.receptorId } }),
      database.structureModel.findUnique({ where: { id: parsed.data.ligandId } }),
    ]);
    if (receptor === null || ligand === null)
      throw new ApiError(
        'STRUCTURE_NOT_FOUND',
        404,
        'The receptor or ligand structure was not found.',
      );
    const job = await database.dockingJob.create({
      data: {
        receptorId: receptor.id,
        ligandId: ligand.id,
        engine: process.env.DOCKING_ENGINE_NAME ?? 'configured-provider',
        engineVersion: process.env.DOCKING_ENGINE_VERSION ?? null,
        status: 'RUNNING',
        parametersJson: JSON.stringify(parsed.data.parameters),
        startedAt: new Date(),
      },
    });
    try {
      const response = await fetch(providerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.DOCKING_PROVIDER_TOKEN === undefined
            ? {}
            : { Authorization: `Bearer ${process.env.DOCKING_PROVIDER_TOKEN}` }),
        },
        body: JSON.stringify({
          jobId: job.id,
          receptor: {
            format: receptor.format,
            contentBase64: (await readFile(receptor.artifactPath)).toString('base64'),
          },
          ligand: {
            format: ligand.format,
            contentBase64: (await readFile(ligand.artifactPath)).toString('base64'),
          },
          parameters: parsed.data.parameters,
        }),
        signal: AbortSignal.timeout(15 * 60_000),
      });
      if (!response.ok) throw new Error(`Docking provider returned HTTP ${response.status}`);
      const output = z
        .object({
          score: z.number().finite(),
          poseBase64: z.string().min(1),
          format: z.enum(['pdb', 'pdbqt', 'mmcif']).default('pdb'),
          engineVersion: z.string().optional(),
        })
        .parse(await response.json());
      const pose = Buffer.from(output.poseBase64, 'base64');
      if (pose.length === 0 || pose.length > MAX_STRUCTURE_BYTES)
        throw new Error('Docking pose was empty or oversized');
      await mkdir(root, { recursive: true });
      const posePath = join(
        root,
        `${job.id}-pose.${output.format === 'mmcif' ? 'cif' : output.format}`,
      );
      await writeFile(posePath, pose, { flag: 'wx' });
      const completed = await database.dockingJob.update({
        where: { id: job.id },
        data: {
          status: 'SUCCEEDED',
          score: output.score,
          poseArtifactPath: posePath,
          engineVersion: output.engineVersion ?? job.engineVersion,
          completedAt: new Date(),
        },
      });
      return reply.status(201).send({ requestId: String(request.id), data: { job: completed } });
    } catch (error) {
      await database.dockingJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message.slice(0, 500) : 'Docking failed',
          completedAt: new Date(),
        },
      });
      throw new ApiError(
        'DOCKING_FAILED',
        502,
        'The docking engine failed to produce a valid pose.',
        true,
      );
    }
  });
}
