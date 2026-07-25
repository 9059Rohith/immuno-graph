import 'dotenv/config';

import { McpApp, Module } from '@nitrostack/core';

import { ConstraintModule } from './constraint/constraint.module.js';
import { EvidenceModule } from './evidence/evidence.module.js';
import { PredictionModule } from './prediction/prediction.module.js';
import { ReportModule } from './report/report.module.js';

const nodeEnv = process.env.NODE_ENV ?? 'development';
const transportType = (process.env.MCP_TRANSPORT_TYPE ??
  (nodeEnv === 'production' ? 'dual' : 'http')) as 'stdio' | 'http' | 'dual';
const httpHost =
  process.env.HOST ?? process.env.MCP_HOST ?? (nodeEnv === 'production' ? '0.0.0.0' : '127.0.0.1');
const httpPort = Number(process.env.PORT ?? process.env.MCP_PORT ?? 3001);

@McpApp({
  module: AppModule,
  server: {
    name: 'immunograph-mcp',
    version: '0.1.0',
  },
  transport: {
    type: transportType,
    http: {
      host: httpHost,
      port: httpPort,
      basePath: '/mcp',
    },
  },
})
@Module({
  name: 'immunograph',
  imports: [PredictionModule, EvidenceModule, ConstraintModule, ReportModule],
})
export class AppModule {}
