import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UserSocialLoginReqDto {
  @ApiProperty({
    type: String,
    description: 'social 에서 전달하는 token',
  })
  // =================================
  @IsNotEmpty()
  @IsString()
  readonly token: string;

  @ApiProperty({
    type: String,
    description: 'OAuth 제공사 ex) GOOGLE, APPLE',
  })
  @IsIn(['GOOGLE', 'APPLE'])
  readonly provider: string;

  @ApiProperty({
    type: String,
    description: '요청 핸드폰 os ex) GOOGLE, APPLE',
  })
  @IsOptional()
  @IsIn(['GOOGLE', 'APPLE'])
  os: string;
}
