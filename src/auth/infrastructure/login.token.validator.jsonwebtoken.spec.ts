import { UnauthorizedException } from '@nestjs/common';
import { sign } from 'jsonwebtoken';
import { ILoginUserInfo } from '../interface/login.user';
import { LoginTokenValidatorJsonwebtoken } from './login.token.validator.jsonwebtoken';
import { mock, MockProxy } from 'vitest-mock-extended';
import { MockConfigService } from '../../common/test/config.service';

describe('login token validator With jsonwebtoken 테스트', () => {
  const configService: MockProxy<MockConfigService> = mock<MockConfigService>();

  const sut = new LoginTokenValidatorJsonwebtoken(configService);

  const givenLoginUser: ILoginUserInfo = {
    id: 1,
    email: 'test@test.com',
    name: 'name',
  };

  beforeEach(() => {
    configService.getOrThrow.calledWith('TOKEN_SECRET_KEY').mockReturnValue('SECRET');
    configService.getOrThrow.calledWith('ACCESS_TOKEN_EXPIRE_SECOND').mockReturnValue('3600');
    configService.getOrThrow.calledWith('REFRESH_TOKEN_EXPIRE_SECOND').mockReturnValue('36000');
  });

  it('issuance 토큰 발급 테스트', () => {
    const result = sut.issuance(givenLoginUser);

    const now = new Date();
    expect(result.accessToken).toBeDefined();
    expect(new Date(result.accessToken.expiredAt).getTime()).toBeGreaterThan(now.getTime());
    expect(result.refreshToken).toBeDefined();
    expect(new Date(result.refreshToken.expiredAt).getTime()).toBeGreaterThan(now.getTime());
  });

  describe('validateByToken 토큰 종류 검증', () => {
    it('access 토큰을 access 로, refresh 토큰을 refresh 로 검증하면 사용자 정보가 나온 경우', () => {
      const result = sut.issuance(givenLoginUser);

      expect(sut.validateByToken(result.accessToken.value, 'access')).toEqual(givenLoginUser);
      expect(sut.validateByToken(result.refreshToken.value, 'refresh')).toEqual(givenLoginUser);
    });

    it('refresh 토큰을 access 로 쓰면 거부된 경우 (refresh 토큰으로 API 호출 불가)', () => {
      const result = sut.issuance(givenLoginUser);

      expect(() => sut.validateByToken(result.refreshToken.value, 'access')).toThrow(UnauthorizedException);
    });

    it('access 토큰을 refresh 로 쓰면 거부된 경우 (access 토큰으로 재발급 불가)', () => {
      const result = sut.issuance(givenLoginUser);

      expect(() => sut.validateByToken(result.accessToken.value, 'refresh')).toThrow(UnauthorizedException);
    });

    it('종류 표시가 없는 토큰은 거부된 경우', () => {
      const givenToken = sign({ id: 1, email: 'test@test.com', name: 'name' }, 'SECRET', { expiresIn: 3600 });

      expect(() => sut.validateByToken(givenToken, 'access')).toThrow(UnauthorizedException);
      expect(() => sut.validateByToken(givenToken, 'refresh')).toThrow(UnauthorizedException);
    });

    it('다른 비밀키로 서명된 토큰은 거부된 경우', () => {
      const givenToken = sign({ id: 1, email: 'test@test.com', name: 'name', type: 'access' }, 'OTHER', {
        expiresIn: 3600,
      });

      expect(() => sut.validateByToken(givenToken, 'access')).toThrow(UnauthorizedException);
    });

    it('만료된 토큰은 토큰만료로 거부된 경우', () => {
      const givenToken = sign({ id: 1, email: 'test@test.com', name: 'name', type: 'access' }, 'SECRET', {
        expiresIn: -10,
      });

      expect(() => sut.validateByToken(givenToken, 'access')).toThrow(new UnauthorizedException('토큰만료'));
    });
  });
});
