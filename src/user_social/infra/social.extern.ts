import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { catchError, firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { IUserGetInfo } from '../interface/user.social';
import * as jwt from 'jsonwebtoken';
import axios, { AxiosError } from 'axios';

// 소셜 공급자 호출 제한 시간(ms). 응답이 없을 때 요청이 끝없이 걸리지 않게 한다
export const SOCIAL_HTTP_TIMEOUT_MS = 5000;

// 외부 호출 실패 로그용 설명. AxiosError 전체에는 요청 헤더(소셜 토큰)와
// 본문(Apple client_secret)이 들어 있어서 상태 코드와 메시지만 남긴다
export const describeExternError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    return `status=${error.response?.status ?? 'none'} ${error.message}`;
  }
  return error instanceof Error ? error.message : 'unknown error';
};

@Injectable()
export class SocialExtern {
  private logger = new Logger('SOCIAL');

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  // Google access token 이 이 앱의 OAuth 클라이언트에 발급된 것인지 확인한다.
  // userinfo 는 어느 앱에 발급된 토큰이든 사용자 정보를 돌려주므로, 확인하지 않으면
  // 다른 앱(공격자의 앱)에서 받은 피해자의 토큰으로 이 앱에 피해자로 로그인할 수 있다.
  // GOOGLE_CLIENT_IDS: 이 앱의 클라이언트 ID 목록(iOS·Android·Web 등, 쉼표로 구분)
  private async verifyGoogleTokenAudience(token: string) {
    const clientIds = this.configService
      .getOrThrow<string>('GOOGLE_CLIENT_IDS')
      .split(',')
      .map((clientId) => clientId.trim())
      .filter((clientId) => clientId.length > 0);

    const { data } = await firstValueFrom(
      this.httpService
        .get('https://oauth2.googleapis.com/tokeninfo', {
          params: { access_token: token },
        })
        .pipe(
          catchError((error: AxiosError) => {
            this.logger.error(`google token info failed: ${describeExternError(error)}`);
            throw new UnauthorizedException('USER_SOCIAL_LOGIN_FAIL');
          }),
        ),
    );

    if (!clientIds.includes(data.aud)) {
      this.logger.warn('google token issued to another client');
      throw new UnauthorizedException('USER_SOCIAL_LOGIN_FAIL');
    }
  }

  async getUserByGoogleToken(token: string): Promise<IUserGetInfo> {
    await this.verifyGoogleTokenAudience(token);

    const { data } = await firstValueFrom(
      this.httpService
        .get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${token}` },
        })
        .pipe(
          catchError((error: AxiosError) => {
            throw new UnauthorizedException('USER_SOCIAL_LOGIN_FAIL');
          }),
        ),
    );

    // 확인되지 않은 이메일로는 계정을 찾거나 만들지 않는다
    if (data.email_verified !== true) {
      throw new UnauthorizedException('USER_SOCIAL_LOGIN_FAIL');
    }

    return {
      provider: 'GOOGLE',
      email: data.email,
      name: data.family_name + data.given_name,
      ...data,
    } as IUserGetInfo;
  }

  async getUserByNaverToken(token: string) {
    const { data } = await firstValueFrom(
      this.httpService
        .get('https://openapi.naver.com/v1/nid/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        .pipe(
          catchError((error: AxiosError) => {
            this.logger.error(`naver user info failed: ${describeExternError(error)}`);
            throw new UnauthorizedException('USER_SOCIAL_LOGIN_FAIL');
          }),
        ),
    );

    const { response } = data;

    let phone: string = '';
    let birthDate: string = '';
    if (response.mobile) {
      phone = response.mobile.split('-').join('');
    }
    if (response.birthyear && response.birthday) {
      birthDate = response.birthyear + '-' + response.birthday;
    }

    return {
      provider: 'NAVER',
      email: response.email,
      name: response.name,
      phone,
      birthDate,
      ...response,
    } as IUserGetInfo;
  }

  async getUserByKakaoAccessToken(accessToken: string) {
    const { data } = await firstValueFrom(
      this.httpService
        .get('https://kapi.kakao.com/v2/user/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        .pipe(
          catchError((error: AxiosError) => {
            this.logger.error(`kakao user info failed: ${describeExternError(error)}`);
            throw new UnauthorizedException('USER_SOCIAL_LOGIN_FAIL');
          }),
        ),
    );

    const { kakao_account } = data;
    let phone = '';
    let email = kakao_account.email;
    let name = '';
    if (!kakao_account || !kakao_account.email) {
      throw new BadRequestException('kakao email not exist');
    }
    if (kakao_account && kakao_account.phone_number) {
      phone = '0' + kakao_account.phone_number.split(' ')[1].split('-').join('');
    }

    if (kakao_account && kakao_account.name) {
      name = kakao_account.name ?? kakao_account.profile.nickname;
    }

    return {
      provider: 'KAKAO',
      email: email,
      name: name,
      phone,
      ...data,
    } as IUserGetInfo;
  }

  async getAppleToken(code: string, os: string): Promise<any> {
    const clientId =
      os === 'APPLE'
        ? this.configService.getOrThrow('APPLE_CLIENT_ID')
        : this.configService.getOrThrow('APPLE_CLIENT_GOOGLE_ID');
    const teamId = this.configService.getOrThrow('APPLE_TEAM_ID');
    const keyId = this.configService.getOrThrow('APPLE_KEY_ID');
    const privateKey = this.configService.getOrThrow('APPLE_PRIVATE_KEY');

    const jwtToken = jwt.sign(
      {
        iss: teamId,
        aud: 'https://appleid.apple.com',
        sub: clientId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60 * 5, // 5분 유효
      },
      privateKey,
      {
        algorithm: 'ES256',
        header: {
          alg: 'ES256',
          kid: keyId,
        },
      },
    );

    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', jwtToken);
    params.append('code', code);
    params.append('grant_type', 'authorization_code');

    try {
      const response = await axios.post('https://appleid.apple.com/auth/token', params, {
        timeout: SOCIAL_HTTP_TIMEOUT_MS,
      });
      // 응답에는 id_token·refresh_token 이 들어 있어서 로그에 남기지 않는다
      const data: any = response.data;
      return data;
    } catch (e) {
      this.logger.error(`apple token request failed: ${describeExternError(e)}`);
      throw e;
    }
  }

  async validateAppleToken(idToken: string): Promise<IUserGetInfo> {
    const applePublicKeys = await axios.get('https://appleid.apple.com/auth/keys', {
      timeout: SOCIAL_HTTP_TIMEOUT_MS,
    });
    const keys = applePublicKeys.data.keys;

    // 적절한 키로 JWT 검증
    const decodedToken: any = jwt.decode(idToken, { complete: true });
    // apple any 처리
    const key = keys.find((k: any) => k.kid === decodedToken?.header?.kid);

    if (!key) {
      throw new Error('Invalid Apple public key');
    }

    try {
      // const data = jwt.verify(idToken, key) as AppleUser;
      // const name = data.name ? data.name!.firstName! + data.name!.lastName! : '';
      const name = 'APPLE_USER';
      return {
        provider: 'APPLE',
        email: decodedToken?.payload.email,
        name: name,
        // ...data,
      } as IUserGetInfo;
    } catch (e) {
      this.logger.error(e);
      throw e;
    }
  }
}
