import { ILoginToken } from './token';
import { ILoginUserInfo } from './login.user';

// access: API 호출용(가드가 받는다), refresh: 토큰 재발급용(재발급 API 가 받는다)
export type ILoginTokenType = 'access' | 'refresh';

export interface ILoginTokenValidator {
  issuance(userLogin: ILoginUserInfo): ILoginToken;
  validateByToken(token: string, tokenType: ILoginTokenType): ILoginUserInfo;
}
