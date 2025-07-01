import { BadRequestException, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from '../../entity/user.entity';
import { UserSocialLoginResDto } from '../api/user.social.res.dto';
import { SocialExtern } from '../infra/social.extern';
import { IUserGetInfo } from '../interface/user.social';
import { UserSocialLoginReqDto } from '../api/user.social.req.dto';
import { Repository } from 'typeorm';
import { ILoginUserInfo } from '../../auth/interface/login.user';
import { ILoginTokenValidator } from '../../auth/interface/login.token.validator';

@Injectable()
export class UserSocialService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    private socialExtern: SocialExtern,
    @Inject('ILoginTokenValidator')
    private loginTokenValidator: ILoginTokenValidator,
  ) {}

  async socialLogin(getBody: UserSocialLoginReqDto): Promise<UserSocialLoginResDto> {
    let socialUser: IUserGetInfo = {
      provider: getBody.provider,
      phone: undefined,
      birthDate: undefined,
      name: '',
      email: '',
    };

    if (getBody.provider === 'GOOGLE') {
      const data = await this.socialExtern.getUserByGoogleToken(getBody.token);
      socialUser = { provider: getBody.provider, email: data.email, name: data.name, phone: data.phone };
    } else if (getBody.provider === 'KAKAO') {
      const data = await this.socialExtern.getUserByKakaoAccessToken(getBody.token);
      socialUser = { provider: getBody.provider, email: data.email, name: data.name, phone: data.phone };
    } else if (getBody.provider === 'NAVER') {
      const data = await this.socialExtern.getUserByNaverToken(getBody.token);
      socialUser = { provider: getBody.provider, email: data.email, name: data.name, phone: data.phone };
    } else if (getBody.provider === 'APPLE') {
      const tokenData = await this.socialExtern.getAppleToken(getBody.token, getBody.os);
      const idToken = tokenData.id_token;

      const userData = await this.socialExtern.validateAppleToken(idToken);
      socialUser = { provider: userData.provider, email: userData.email, name: userData.name, phone: userData.phone };
    }

    if (!socialUser.email) {
      throw new InternalServerErrorException('user email error');
    }

    const user = await this.userRepository.findOne({
      where: {
        provider: socialUser.provider,
        email: socialUser.email,
      },
    });

    let loginUserInfo: ILoginUserInfo = {
      id: 0,
      name: '',
      email: '',
    };

    if (!user) {
      const dupEmailUser = await this.userRepository.findOne({
        where: {
          email: socialUser.email,
        },
      });

      if (dupEmailUser) {
        throw new BadRequestException('Already Signup email');
      }
      const createUser = new UserEntity();

      createUser.name = ``; // TODO name
      createUser.provider = socialUser.provider;
      createUser.email = socialUser.email;
      createUser.password = null;

      await this.userRepository.save(createUser);

      loginUserInfo = {
        id: createUser.id,
        name: createUser.name,
        email: createUser.email,
      };
    }

    if (loginUserInfo.id === 0) {
      throw new InternalServerErrorException('user is not created');
    }

    return this.loginTokenValidator.issuance(loginUserInfo);
  }
}
