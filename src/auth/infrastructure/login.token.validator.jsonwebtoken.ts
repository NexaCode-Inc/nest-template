import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtPayload, sign, TokenExpiredError, verify } from 'jsonwebtoken';
import { addSeconds, format } from 'date-fns';
import { ILoginToken } from '../interface/token';
import { ILoginTokenType, ILoginTokenValidator } from '../interface/login.token.validator';
import { ConfigService } from '@nestjs/config';
import { ILoginUserInfo } from '../interface/login.user';
import { DateFormatStr } from '../../common/domain/date.format.str';

@Injectable()
export class LoginTokenValidatorJsonwebtoken implements ILoginTokenValidator {
  constructor(private configService: ConfigService) {}

  private transformUserInfo(payload: JwtPayload): ILoginUserInfo {
    return {
      id: payload.id,
      name: payload.name,
      email: payload.email,
    };
  }

  // 토큰에 담는 값. type 으로 access 와 refresh 를 구분한다
  private toPayload(loginUser: ILoginUserInfo, tokenType: ILoginTokenType) {
    return {
      id: loginUser.id,
      name: loginUser.name,
      email: loginUser.email,
      type: tokenType,
    };
  }

  // 토큰 발급
  issuance(loginUser: ILoginUserInfo): ILoginToken {
    const now = new Date();
    const secretJwtKey: string = this.configService.getOrThrow('TOKEN_SECRET_KEY');

    const accessTokenExpireSecond = +this.configService.getOrThrow('ACCESS_TOKEN_EXPIRE_SECOND');
    const refreshTokenExpireSecond = +this.configService.getOrThrow('REFRESH_TOKEN_EXPIRE_SECOND');

    const accessTokenExpire = addSeconds(now, accessTokenExpireSecond);
    const refreshTokenExpire = addSeconds(now, refreshTokenExpireSecond);

    const accessToken = sign(this.toPayload(loginUser, 'access'), secretJwtKey, {
      expiresIn: accessTokenExpireSecond,
    });
    const refreshToken = sign(this.toPayload(loginUser, 'refresh'), secretJwtKey, {
      expiresIn: refreshTokenExpireSecond,
    });

    return {
      accessToken: {
        value: accessToken,
        expiredAt: format(accessTokenExpire, DateFormatStr),
      },
      refreshToken: {
        value: refreshToken,
        expiredAt: format(refreshTokenExpire, DateFormatStr),
      },
    };
  }

  // 토큰 유효성과 종류(tokenType)를 함께 검증한다.
  // refresh 토큰으로 API 를 부르거나 access 토큰으로 재발급받지 못하게 한다
  validateByToken(token: string, tokenType: ILoginTokenType) {
    const secretJwtKey: string = this.configService.getOrThrow('TOKEN_SECRET_KEY');

    try {
      const tokenDecoded = verify(token, secretJwtKey, { complete: true });
      const payload = tokenDecoded.payload as JwtPayload;

      if (payload.type !== tokenType) {
        throw new UnauthorizedException('토큰 에러');
      }

      return this.transformUserInfo(payload);
    } catch (e) {
      if (e) {
        if (e instanceof TokenExpiredError) {
          throw new UnauthorizedException('토큰만료');
        }
        throw new UnauthorizedException('토큰 에러');
      }
      throw new Error(e);
    }
  }
}
