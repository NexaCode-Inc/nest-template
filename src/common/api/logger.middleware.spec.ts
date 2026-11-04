import { EventEmitter } from 'events';
import { Logger } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { LoggerMiddleware, maskSensitiveBody } from './logger.middleware';

describe('LoggerMiddleware 요청 로그 테스트', () => {
  describe('maskSensitiveBody 민감 정보 가리기', () => {
    it('비밀번호·토큰·비밀키·인증 코드 값을 가린 경우', () => {
      const result = maskSensitiveBody({
        email: 'test@gmail.com',
        password: 'plain-password',
        newPassword: 'new-password',
        token: 'refresh-token',
        accessToken: 'access-token',
        id_token: 'id-token',
        client_secret: 'secret',
        code: 'auth-code',
        zipCode: '12345',
      });

      expect(result).toEqual({
        email: 'test@gmail.com',
        password: '***',
        newPassword: '***',
        token: '***',
        accessToken: '***',
        id_token: '***',
        client_secret: '***',
        code: '***',
        zipCode: '12345',
      });
    });

    it('중첩된 객체와 배열 안의 값도 가리고 원본은 바꾸지 않은 경우', () => {
      const givenBody = { users: [{ name: 'a', password: 'p1' }], auth: { refreshToken: 'r1' } };

      const result = maskSensitiveBody(givenBody);

      expect(result).toEqual({ users: [{ name: 'a', password: '***' }], auth: { refreshToken: '***' } });
      expect(givenBody.users[0].password).toBe('p1');
      expect(givenBody.auth.refreshToken).toBe('r1');
    });

    it('객체가 아닌 본문은 그대로 둔 경우', () => {
      expect(maskSensitiveBody(undefined)).toBeUndefined();
      expect(maskSensitiveBody(null)).toBeNull();
      expect(maskSensitiveBody('text')).toBe('text');
    });
  });

  describe('use 요청이 끝나면 로그 한 줄', () => {
    it('로그인 요청의 비밀번호가 로그에 남지 않은 경우', () => {
      const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
      const sut = new LoggerMiddleware();
      const req = {
        ip: '127.0.0.1',
        method: 'POST',
        originalUrl: '/user/login-email-password',
        body: { email: 'test@gmail.com', password: 'plain-password' },
        get: () => 'jest',
      } as unknown as Request;
      const res = Object.assign(new EventEmitter(), { statusCode: 200, locals: {} }) as unknown as Response;
      const next: NextFunction = vi.fn();

      sut.use(req, res, next);
      res.emit('finish');

      expect(next).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledTimes(1);
      const message = logSpy.mock.calls[0][0] as string;
      expect(message).toContain('"email":"test@gmail.com"');
      expect(message).toContain('"password":"***"');
      expect(message).not.toContain('plain-password');
      logSpy.mockRestore();
    });
  });
});
