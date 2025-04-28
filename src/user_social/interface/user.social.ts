export type IUserSocial = {
  provider: string;
  providerId: string;
  displayName: string;
  email: string;
};

export type IUserSocialProvider = 'google' | 'kakao' | 'naver' | 'apple';

export type IUserGetInfo = {
  provider: string;
  name: string;
  email: string;
  phone?: string;
  birthDate?: string;
};

export interface AppleAuthResponse {
  access_token: string; // Apple에서 발급한 Access Token
  id_token: string; // 사용자 정보를 포함한 JWT
  refresh_token?: string; // Refresh Token (옵션)
  expires_in: number; // Access Token의 유효기간 (초 단위)
  token_type: string; // 토큰 타입 (대부분 'Bearer')
}

export interface AppleIdTokenPayload {
  iss: string; // 발행자 (Issuer) (예: "https://appleid.apple.com")
  aud: string; // 클라이언트 ID (예: "com.example.app")
  exp: number; // 토큰 만료 시간 (Unix timestamp)
  iat: number; // 토큰 발급 시간 (Unix timestamp)
  sub: string; // Apple에서 제공한 사용자의 고유 ID
  email?: string; // 사용자의 이메일 (옵션)
  email_verified?: 'true' | 'false'; // 이메일 검증 여부
  auth_time?: number; // 사용자가 인증한 시간
  nonce?: string; // 보안 강화 목적으로 사용되는 nonce
}

export interface AppleUser {
  id: string; // Apple 사용자의 고유 ID (sub)
  email?: string; // 사용자의 이메일
  name?: {
    firstName?: string; // 사용자의 이름 (첫 번째)
    lastName?: string; // 사용자의 성
  };
}
