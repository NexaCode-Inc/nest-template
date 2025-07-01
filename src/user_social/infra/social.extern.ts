import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { catchError, firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { IUserGetInfo } from '../interface/user.social';
import * as jwt from 'jsonwebtoken';
import axios, { AxiosError } from 'axios';

@Injectable()
export class SocialExtern {
  private logger = new Logger('SOCIAL');

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getUserByGoogleToken(token: string): Promise<IUserGetInfo> {
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
            this.logger.error(error);
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
            this.logger.error(error);
            throw new UnauthorizedException('USER_SOCIAL_LOGIN_FAIL');
          }),
        ),
    );

    const { kakao_account } = data;
    this.logger.log(JSON.stringify(data));
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
      const response = await axios.post('https://appleid.apple.com/auth/token', params);
      const data: any = response.data;
      this.logger.verbose(JSON.stringify(data));
      return data;
    } catch (e) {
      this.logger.error(e);
      throw e;
    }
  }

  async validateAppleToken(idToken: string): Promise<IUserGetInfo> {
    const applePublicKeys = await axios.get('https://appleid.apple.com/auth/keys');
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
