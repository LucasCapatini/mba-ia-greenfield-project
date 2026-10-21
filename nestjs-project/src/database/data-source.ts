import 'dotenv/config';
import { join } from 'path';
import { DataSource } from 'typeorm';
import databaseConfig from '../config/database.config';

/**
 * Where the CLI finds migrations and entities, by the extension of this very file: `.ts` when
 * run by ts-node in dev (`src/**`), `.js` in the compiled image (`dist/**`) — production has no
 * `src/` nor ts-node (home-search-production/TD-11, `npm run migration:run:prod`).
 */
export function dataSourcePaths(directory: string, file: string) {
  const extension = file.endsWith('.ts') ? 'ts' : 'js';
  return {
    migrations: [join(directory, 'migrations', `*.${extension}`)],
    entities: [join(directory, '..', '**', `*.entity.${extension}`)],
  };
}

const dbConfig = databaseConfig();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: dbConfig.host,
  port: dbConfig.port,
  username: dbConfig.username,
  password: dbConfig.password,
  database: dbConfig.name,
  synchronize: false,
  ...dataSourcePaths(__dirname, __filename),
});
