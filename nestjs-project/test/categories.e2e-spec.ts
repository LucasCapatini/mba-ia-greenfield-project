import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { ValidationExceptionFilter } from '../src/common/filters/validation-exception.filter';
import { SeedCategories1792416144429 } from '../src/database/migrations/1792416144429-SeedCategories';

type CategoryBody = {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
};

describe('categories (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Reproduces main.ts — the testing module does not run it.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(
      new DomainExceptionFilter(),
      new ValidationExceptionFilter(),
    );
    await app.init();

    // The catalog comes from the data migration; the seed is idempotent.
    const queryRunner = app.get(DataSource).createQueryRunner();
    try {
      await new SeedCategories1792416144429().up(queryRunner);
    } finally {
      await queryRunner.release();
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /categories without a token returns the 10 categories in order', async () => {
    const res = await request(app.getHttpServer())
      .get('/categories')
      .expect(200);
    const body = res.body as CategoryBody[];

    expect(body).toHaveLength(10);
    expect(body.map((category) => category.slug)).toEqual([
      'music',
      'gaming',
      'education',
      'entertainment',
      'sports',
      'news',
      'technology',
      'travel',
      'cooking',
      'other',
    ]);
    expect(body.map((category) => category.sort_order)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(Object.keys(body[0]).sort()).toEqual([
      'id',
      'name',
      'slug',
      'sort_order',
    ]);
  });

  it('GET /categories allows 60 requests per minute per visitor, like the public listings', async () => {
    app.get<ThrottlerStorageService>(ThrottlerStorage).storage.clear();
    for (let i = 0; i < 60; i++) {
      await request(app.getHttpServer()).get('/categories').expect(200);
    }

    await request(app.getHttpServer()).get('/categories').expect(429);
  });
});
