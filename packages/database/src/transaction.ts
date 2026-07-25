import type { PrismaClient } from '@prisma/client';

import { createRepositories, type Repositories } from './repositories.js';

export interface TransactionManager {
  run<T>(work: (repositories: Repositories) => Promise<T>): Promise<T>;
}

export class PrismaTransactionManager implements TransactionManager {
  constructor(private readonly client: PrismaClient) {}

  run<T>(work: (repositories: Repositories) => Promise<T>): Promise<T> {
    return this.client.$transaction((transaction) => work(createRepositories(transaction)));
  }
}
