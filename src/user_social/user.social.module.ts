import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../entity/user.entity';
import { UserSocialController } from './api/user.social.controller';
import { SocialExtern } from './infra/social.extern';
import { HttpModule } from '@nestjs/axios';
import { UserSocialService } from './application/user.social.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, HttpModule, TypeOrmModule.forFeature([UserEntity])],
  controllers: [UserSocialController],
  providers: [UserSocialService, SocialExtern],
})
export class UserSocialModule {}
