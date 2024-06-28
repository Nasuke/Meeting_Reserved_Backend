import { Body, Controller, Get, Param, Post, Inject, Query, UnauthorizedException } from '@nestjs/common';
import { UserService } from './user.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { EmailService } from '../email/email.service';
import { RedisService } from '../redis/redis.service';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { LoginUserVo, UserInfo } from './vo/login-user.vo';






@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // add tokenInfo to vo
  addVoToken(vo:LoginUserVo):LoginUserVo {
    vo.accessToken = this.jwtService.sign({
      userId: vo.userInfo.id,
      username: vo.userInfo.username,
      roles: vo.userInfo.roles,
      permissions: vo.userInfo.permissions
    }, {
      expiresIn: this.configService.get('jwt_access_token_expires_time') || '30m'
    });

    vo.refreshToken = this.jwtService.sign({
      userId: vo.userInfo.id
    }, {
      expiresIn: this.configService.get('jwt_refresh_token_expres_time') || '7d'
    });

    return vo
  }
  /**
   * @param user 
   * @returns [token, refreshToken]
   */
  generateToken(user: any){
    const access_token = this.jwtService.sign({
      userId: user.id,
      username: user.username,
      roles: user.roles,
      permissions: user.permissions
    }, {
      expiresIn: this.configService.get('jwt_access_token_expires_time') || '30m'
    });

    const refresh_token = this.jwtService.sign({
      userId: user.id
    }, {
      expiresIn: this.configService.get('jwt_refresh_token_expres_time') || '7d'
    });

    return [access_token, refresh_token]
  }

  @Inject(EmailService)
  private emailService: EmailService;

  @Inject(RedisService)
  private redisService: RedisService;

  @Inject(JwtService)
  private jwtService: JwtService;

  @Inject(ConfigService)
  private configService: ConfigService;

  // 注册
  @Post('register')
  async register(@Body() registerUser:RegisterUserDto) {
    return await this.userService.register(registerUser)
  }

  // 邮箱发送验证码 
  @Get('register-captcha')
  async captcha(@Query('address') address: string) {
    const code = Math.random().toString().slice(2,8);

    await this.redisService.set(`captcha_${address}`, code, 5 * 60);

    await this.emailService.sendMail({
      to: address,
      subject: '注册验证码',
      html: `<p>你的注册验证码是 ${code}</p>`
    });
    return '发送成功';
  }

  // 初始化操作
  @Get('init-data')
  async initData(){
    await this.userService.initData()
    return 'init successed'
  }

  // normal login
  @Post('login')
  async login(@Body() loginInfo: LoginUserDto) {
    let vo = await this.userService.login(loginInfo, false)
    // generate sign token
    vo = this.addVoToken(vo)

    return vo
  }

  // admin login
  @Post('admin-login')
  async adminLogin(@Body() loginInfo: LoginUserDto) {
    let vo = await this.userService.login(loginInfo, true)
    // generate sign token
    vo = this.addVoToken(vo)

    return vo
  }

  @Get('refresh')
  async refresh(@Query('refreshToken') refreshToken: string) {
    try {
      // verify the token and get userInfo
      const data = this.jwtService.verify(refreshToken);

      const user = await this.userService.findUserById(data.userId, false);
      // verify new token 
      const [access_token, refresh_token] = this.generateToken(user)

      return {
        access_token,
        refresh_token
      }
    } catch(e) {
      throw new UnauthorizedException('token 已失效，请重新登录');
    }
  }

  @Get('admin-refresh')
  async adminRefresh(@Query('refreshToken') refreshToken: string) {
    try {
      const data = this.jwtService.verify(refreshToken);

      const user = await this.userService.findUserById(data.userId, true);

      const [access_token, refresh_token] = this.generateToken(user)

      return {
        access_token,
        refresh_token
      }
    } catch(e) {
      throw new UnauthorizedException('token 已失效，请重新登录');
    }
  }

}
