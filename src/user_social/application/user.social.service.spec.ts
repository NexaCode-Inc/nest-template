import { mock, MockProxy, mockReset } from 'vitest-mock-extended';
import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { UserSocialService } from './user.social.service';
import { SocialExtern } from '../infra/social.extern';
import { ILoginTokenValidator } from '../../auth/interface/login.token.validator';
import { ILoginToken } from '../../auth/interface/token';
import { UserEntity } from '../../entity/user.entity';
import { UserEntityTest } from '../../../test/user.entity.test';

describe('user social login service Test', () => {
  const userRepository: MockProxy<Repository<UserEntity>> = mock<Repository<UserEntity>>();
  const socialExtern: MockProxy<SocialExtern> = mock<SocialExtern>();
  const loginTokenValidator: MockProxy<ILoginTokenValidator> = mock<ILoginTokenValidator>();

  const sut = new UserSocialService(userRepository, socialExtern, loginTokenValidator);

  const givenToken: ILoginToken = {
    accessToken: { value: 'access', expiredAt: '2024-09-16 00:00:00' },
    refreshToken: { value: 'refresh', expiredAt: '2024-09-16 00:00:00' },
  };

  beforeEach(() => {
    mockReset(userRepository);
    mockReset(socialExtern);
    mockReset(loginTokenValidator);
    socialExtern.getUserByGoogleToken.mockResolvedValue({
      provider: 'GOOGLE',
      email: 'test@gmail.com',
      name: 'name',
    });
    loginTokenValidator.issuance.mockReturnValue(givenToken);
  });

  describe('socialLogin 소셜 로그인 테스트', () => {
    it('이미 가입한 소셜 사용자가 다시 로그인하면 저장된 사용자로 토큰이 발급된 경우', async () => {
      userRepository.findOne.mockResolvedValue({
        ...UserEntityTest(),
        id: 7,
        provider: 'GOOGLE',
        email: 'test@gmail.com',
        name: 'saved name',
      });

      const result = await sut.socialLogin({ provider: 'GOOGLE', token: 'GOOGLE_TOKEN', os: 'GOOGLE' });

      expect(result).toBe(givenToken);
      expect(loginTokenValidator.issuance).toHaveBeenCalledWith({ id: 7, name: 'saved name', email: 'test@gmail.com' });
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('처음 로그인한 소셜 사용자는 계정이 만들어지고 토큰이 발급된 경우', async () => {
      userRepository.findOne.mockResolvedValue(null);
      userRepository.save.mockImplementation(async (entity) => {
        (entity as UserEntity).id = 8;
        return entity as UserEntity;
      });

      const result = await sut.socialLogin({ provider: 'GOOGLE', token: 'GOOGLE_TOKEN', os: 'GOOGLE' });

      expect(result).toBe(givenToken);
      expect(userRepository.save).toHaveBeenCalledTimes(1);
      expect(loginTokenValidator.issuance).toHaveBeenCalledWith({ id: 8, name: '', email: 'test@gmail.com' });
    });

    it('같은 이메일로 다른 방식(이메일 가입 등)으로 가입한 사용자가 있는 경우', async () => {
      userRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
        ...UserEntityTest(),
        id: 9,
        provider: null,
        email: 'test@gmail.com',
      });

      await expect(sut.socialLogin({ provider: 'GOOGLE', token: 'GOOGLE_TOKEN', os: 'GOOGLE' })).rejects.toThrow(
        BadRequestException,
      );
      expect(loginTokenValidator.issuance).not.toHaveBeenCalled();
    });
  });
});
