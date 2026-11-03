import { generateKeyPairSync } from 'crypto';
import { inspect } from 'util';
import { HttpService } from '@nestjs/axios';
import { Logger, UnauthorizedException } from '@nestjs/common';
import axios, { AxiosError, AxiosHeaders, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { mock, MockProxy, mockReset } from 'jest-mock-extended';
import { of, throwError } from 'rxjs';
import { MockConfigService } from '../../common/test/config.service';
import { describeExternError, SOCIAL_HTTP_TIMEOUT_MS, SocialExtern } from './social.extern';

// 요청 헤더·본문에 비밀 값이 든 AxiosError (axios 가 실패할 때 만드는 모양)
const givenAxiosError = (secret: string, status: number) => {
  const config = {
    headers: new AxiosHeaders({ Authorization: `Bearer ${secret}` }),
    data: `client_secret=${secret}`,
  } as InternalAxiosRequestConfig;
  return new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST', config, undefined, {
    status,
    statusText: '',
    headers: {},
    config,
    data: {},
  });
};

// Nest ConsoleLogger 는 문자열이 아닌 로그 값을 util.inspect 로 출력한다 — 실제로 찍히는 내용
const printed = (value: unknown) => (typeof value === 'string' ? value : inspect(value));

describe('SocialExtern 소셜 공급자 호출 테스트', () => {
  const httpService: MockProxy<HttpService> = mock<HttpService>();
  const configService: MockProxy<MockConfigService> = mock<MockConfigService>();
  const sut = new SocialExtern(httpService, configService);

  let errorSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;
  let verboseSpy: jest.SpyInstance;

  beforeEach(() => {
    mockReset(httpService);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    verboseSpy = jest.spyOn(Logger.prototype, 'verbose').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('describeExternError 는 상태와 메시지만 남기고 헤더·본문의 비밀 값은 남기지 않은 경우', () => {
    const result = describeExternError(givenAxiosError('SECRET_VALUE', 401));

    expect(result).toBe('status=401 Request failed with status code 401');
    expect(result).not.toContain('SECRET_VALUE');
  });

  it('네이버 호출이 실패하면 토큰 없이 실패 로그를 남기고 401 인 경우', async () => {
    httpService.get.mockReturnValue(throwError(() => givenAxiosError('NAVER_TOKEN', 401)));

    await expect(sut.getUserByNaverToken('NAVER_TOKEN')).rejects.toThrow(UnauthorizedException);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(printed(errorSpy.mock.calls[0][0])).not.toContain('NAVER_TOKEN');
  });

  it('카카오 호출이 성공해도 사용자 프로필 전체를 로그에 남기지 않은 경우', async () => {
    const givenResponse = {
      data: { kakao_account: { email: 'test@kakao.com', phone_number: '+82 10-1234-5678' } },
    } as AxiosResponse;
    httpService.get.mockReturnValue(of(givenResponse));

    const result = await sut.getUserByKakaoAccessToken('KAKAO_TOKEN');

    expect(result.email).toBe('test@kakao.com');
    expect(logSpy).not.toHaveBeenCalled();
  });

  describe('Apple', () => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });

    beforeEach(() => {
      configService.getOrThrow.calledWith('APPLE_CLIENT_ID').mockReturnValue('com.example.app');
      configService.getOrThrow.calledWith('APPLE_TEAM_ID').mockReturnValue('TEAM');
      configService.getOrThrow.calledWith('APPLE_KEY_ID').mockReturnValue('KEY');
      configService.getOrThrow
        .calledWith('APPLE_PRIVATE_KEY')
        .mockReturnValue(privateKey.export({ type: 'pkcs8', format: 'pem' }).toString());
    });

    it('토큰 요청에 제한 시간을 걸고 응답의 토큰을 로그에 남기지 않은 경우', async () => {
      const postSpy = jest
        .spyOn(axios, 'post')
        .mockResolvedValue({ data: { id_token: 'ID_TOKEN', refresh_token: 'REFRESH_TOKEN' } });

      const result = await sut.getAppleToken('CODE', 'APPLE');

      expect(result.id_token).toBe('ID_TOKEN');
      expect(postSpy).toHaveBeenCalledWith('https://appleid.apple.com/auth/token', expect.any(URLSearchParams), {
        timeout: SOCIAL_HTTP_TIMEOUT_MS,
      });
      expect(verboseSpy).not.toHaveBeenCalled();
    });

    it('토큰 요청이 실패하면 client_secret 없이 실패 로그를 남긴 경우', async () => {
      jest.spyOn(axios, 'post').mockRejectedValue(givenAxiosError('CLIENT_SECRET_JWT', 400));

      await expect(sut.getAppleToken('CODE', 'APPLE')).rejects.toBeInstanceOf(AxiosError);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(printed(errorSpy.mock.calls[0][0])).not.toContain('CLIENT_SECRET_JWT');
    });

    it('공개 키 요청에 제한 시간을 건 경우', async () => {
      const getSpy = jest.spyOn(axios, 'get').mockResolvedValue({ data: { keys: [] } });

      await expect(sut.validateAppleToken('not-a-jwt')).rejects.toThrow('Invalid Apple public key');

      expect(getSpy).toHaveBeenCalledWith('https://appleid.apple.com/auth/keys', { timeout: SOCIAL_HTTP_TIMEOUT_MS });
    });
  });
});
