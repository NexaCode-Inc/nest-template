import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerMiddleware } from './common/api/logger.middleware';
import { AuthModule } from './auth/auth.module';
import { MulterModule } from '@nestjs/platform-express';
import { UserSocialModule } from './user_social/user.social.module';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ClsModule } from 'nestjs-cls';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    // @Transactional() 의 트랜잭션은 요청마다의 CLS 맥락에 담긴다.
    // 트랜잭션에 묶일 저장소는 TransactionHost 의 tx(EntityManager)에서 꺼낸다 — @InjectRepository 로 받은 저장소는 묶이지 않는다
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
      plugins: [
        new ClsPluginTransactional({
          adapter: new TransactionalAdapterTypeOrm({ dataSourceToken: getDataSourceToken() }),
        }),
      ],
    }),
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        dest: configService.getOrThrow('UPLOAD_IMAGE_FILE_PATH'),
      }),
    }),
    AuthModule,
    UserSocialModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
