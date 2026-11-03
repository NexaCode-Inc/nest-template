import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

// 로그에 값을 남기지 않을 본문 키. 소문자로 바꿔 비교한다.
// 이름에 포함되면 가린다: password·newPassword, token·accessToken·id_token, client_secret, authorization
const sensitiveKeyParts = ['password', 'token', 'secret', 'authorization'];
// 이름이 정확히 같을 때만 가린다: 소셜 로그인 인증 코드 (zipCode 같은 키는 가리지 않는다)
const sensitiveExactKeys = ['code'];

const isSensitiveKey = (key: string) => {
  const lowerKey = key.toLowerCase();
  return sensitiveExactKeys.includes(lowerKey) || sensitiveKeyParts.some((part) => lowerKey.includes(part));
};

// 요청 본문에서 민감한 키의 값을 '***' 로 바꾼 사본을 만든다. 원본 본문은 바꾸지 않는다.
export const maskSensitiveBody = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => maskSensitiveBody(item));
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, isSensitiveKey(key) ? '***' : maskSensitiveBody(item)]),
    );
  }
  return value;
};

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP', { timestamp: true });

  private blacklist: string[] = [];

  private except(originalUrl: string) {
    return this.blacklist.includes(originalUrl);
    // return false 개발시 전체 로그 보기
  }

  use(req: Request, res: Response, next: NextFunction) {
    const { ip, method, originalUrl, body } = req;
    const userAgent = req.get('user-agent') || '';
    const now = Date.now();

    res.on('finish', () => {
      const {
        statusCode,
        locals: { errorCode },
      } = res;

      const newBody = this.except(originalUrl) ? {} : maskSensitiveBody(body);

      let message = `${method} ${originalUrl} ${ip} ${userAgent} ${statusCode} ${JSON.stringify(newBody)} ${Date.now() - now}ms`;
      message = errorCode ? message + ` ${errorCode}` : message;

      this.logger.log(message);
    });
    next();
  }
}
