import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { SqlLogger } from '../common/api/sql.logger';
import { SnakeNamingStrategy } from './snake-naming.strategy';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('DATABASE_HOST'),
        port: +configService.get('DATABASE_PORT'),
        username: configService.get('DATABASE_USERNAME'),
        password: configService.get('DATABASE_PASSWORD'),
        database: configService.get('DATABASE_DATABASE'),
        timezone: 'local',
        namingStrategy: new SnakeNamingStrategy(),
        logger: new SqlLogger(),
        logging: configService.get('DATABASE_LOGGING') === 'true',
        synchronize: configService.get('DATABASE_SYNCHRONIZE') === 'true',
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      }),
      // 트랜잭션은 app.module.ts 의 ClsModule(@nestjs-cls/transactional)이 이 DataSource 로 연다
    }),
  ],
})
export class DatabaseModule {}
