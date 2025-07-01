import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Post } from '@nestjs/common';
import { UserSocialLoginResDto } from './user.social.res.dto';
import { UserSocialService } from '../application/user.social.service';
import { UserSocialLoginReqDto } from './user.social.req.dto';

@ApiTags('user-social')
@Controller('')
export class UserSocialController {
  constructor(private userSocialService: UserSocialService) {}

  @ApiOperation({
    summary: '유저 소셜 로그인 API',
    description:
      '소셜 로그인 및 첫 로그인시 회원가입을 진행합니다.<br>' +
      'Provider 에 따라 각 소셜 토큰을 인증 한 후에 나우 스윙 앱에서 사용할 수 있는 토큰을 발행합니다.<br>',
  })
  @ApiOkResponse({
    type: UserSocialLoginResDto,
    description: '성공적으로 로그인한 경우',
  })
  // ==========================================================
  @Post('/user/social/login')
  async socialLogin(@Body() getBody: UserSocialLoginReqDto) {
    return this.userSocialService.socialLogin(getBody);
  }
}
