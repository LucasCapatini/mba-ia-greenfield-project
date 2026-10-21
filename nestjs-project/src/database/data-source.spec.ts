import { join } from 'path';
import { dataSourcePaths } from './data-source';

describe('dataSourcePaths', () => {
  it('points the dev CLI (ts-node, .ts) at src', () => {
    const dir = join('/app', 'src', 'database');

    expect(dataSourcePaths(dir, join(dir, 'data-source.ts'))).toEqual({
      migrations: [join('/app', 'src', 'database', 'migrations', '*.ts')],
      entities: [join('/app', 'src', '**', '*.entity.ts')],
    });
  });

  it('points the compiled image (.js) at dist — no src nor ts-node in production', () => {
    const dir = join('/app', 'dist', 'database');

    expect(dataSourcePaths(dir, join(dir, 'data-source.js'))).toEqual({
      migrations: [join('/app', 'dist', 'database', 'migrations', '*.js')],
      entities: [join('/app', 'dist', '**', '*.entity.js')],
    });
  });
});
