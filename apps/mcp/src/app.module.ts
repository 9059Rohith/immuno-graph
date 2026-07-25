import 'dotenv/config';

import { McpApp, Module } from '@nitrostack/core';

import { ConstraintModule } from './constraint/constraint.module.js';
import { EvidenceModule } from './evidence/evidence.module.js';
import { PredictionModule } from './prediction/prediction.module.js';
import { ReportModule } from './report/report.module.js';

@McpApp({
  module: AppModule,
  server: {
    name: 'immunograph-mcp',
    version: '0.1.0',
  },
  transport: {
    type: 'http',
    http: {
      host: process.env.MCP_HOST ?? '127.0.0.1',
      port: Number(process.env.MCP_PORT ?? 3001),
      basePath: '/mcp',
    },
  },
})
@Module({
  name: 'immunograph',
  imports: [PredictionModule, EvidenceModule, ConstraintModule, ReportModule],
})
export class AppModule {}
