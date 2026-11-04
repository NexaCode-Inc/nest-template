import { Global, Inject, Injectable, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ClsModule, ClsService } from 'nestjs-cls';
import { ClsPluginTransactional, Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';

// DB 없이 트랜잭션 배선을 확인한다: app.module.ts 와 같은 방식(ClsPluginTransactional + TypeORM 어댑터)으로 등록하고,
// DataSource 자리에 가짜를 넣는다. 어댑터는 트랜잭션 안에서는 dataSource.transaction(격리수준, 콜백)의 EntityManager 를,
// 밖에서는 dataSource.manager 를 쓴다.
const defaultManager = { name: 'default-manager' };
const transactionManager = { name: 'transaction-manager' };
const fakeDataSource = {
  manager: defaultManager,
  transaction: vi.fn(async (_isolationLevel: unknown, work: (manager: unknown) => Promise<unknown>) =>
    work(transactionManager),
  ),
};

@Global()
@Module({
  providers: [{ provide: getDataSourceToken(), useValue: fakeDataSource }],
  exports: [getDataSourceToken()],
})
class FakeDataSourceModule {}

@Injectable()
class SampleService {
  constructor(
    @Inject(TransactionHost)
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  currentManager() {
    return this.txHost.tx;
  }

  @Transactional()
  async managerInsideTransaction() {
    return this.txHost.tx;
  }

  @Transactional()
  async failInsideTransaction() {
    throw new Error('rollback me');
  }
}

describe('트랜잭션 배선 (@nestjs-cls/transactional + TypeORM 어댑터)', () => {
  let moduleRef: TestingModule;
  let sut: SampleService;
  let cls: ClsService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        FakeDataSourceModule,
        ClsModule.forRoot({
          global: true,
          plugins: [
            new ClsPluginTransactional({
              adapter: new TransactionalAdapterTypeOrm({ dataSourceToken: getDataSourceToken() }),
            }),
          ],
        }),
      ],
      providers: [SampleService],
    }).compile();
    await moduleRef.init();
    sut = moduleRef.get(SampleService);
    cls = moduleRef.get(ClsService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(() => {
    fakeDataSource.transaction.mockClear();
  });

  // 앱에서는 ClsModule 의 middleware 가 요청마다 CLS 맥락을 연다. 시험에서는 cls.run 으로 연다
  it('@Transactional() 밖에서는 기본 EntityManager 를 쓴 경우', async () => {
    const manager = await cls.run(async () => sut.currentManager());

    expect(manager).toBe(defaultManager);
    expect(fakeDataSource.transaction).not.toHaveBeenCalled();
  });

  it('@Transactional() 안에서는 트랜잭션의 EntityManager 를 쓴 경우', async () => {
    const manager = await cls.run(async () => sut.managerInsideTransaction());

    expect(manager).toBe(transactionManager);
    expect(fakeDataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it('@Transactional() 안에서 오류가 나면 트랜잭션으로 전달된 경우 (TypeORM 은 이때 롤백한다)', async () => {
    await expect(cls.run(async () => sut.failInsideTransaction())).rejects.toThrow('rollback me');

    expect(fakeDataSource.transaction).toHaveBeenCalledTimes(1);
  });
});
