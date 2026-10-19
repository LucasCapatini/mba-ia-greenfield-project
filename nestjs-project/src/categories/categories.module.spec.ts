import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ALL_ENTITIES,
  createTestDataSource,
} from '../test/create-test-data-source';
import { CategoriesController } from './categories.controller';
import { CategoriesModule } from './categories.module';
import { CategoriesService } from './categories.service';

describe('CategoriesModule', () => {
  it('should compile with TypeOrmModule.forFeature([Category]), the service and the controller', async () => {
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(createTestDataSource(ALL_ENTITIES).options),
        CategoriesModule,
      ],
    }).compile();

    expect(module.get(CategoriesService)).toBeInstanceOf(CategoriesService);
    expect(module.get(CategoriesController)).toBeInstanceOf(
      CategoriesController,
    );
    await module.close();
  }, 30000);
});
