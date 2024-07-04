import { Body, Controller, Get, Param, Post, Inject, Query, UnauthorizedException, DefaultValuePipe, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express'
import { UserService } from './user.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { EmailService } from '../email/email.service';
import { RedisService } from '../redis/redis.service';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { LoginUserVo} from './vo/login-user.vo';
import { RequireLogin, UserInfo } from 'src/custom.decorator';
import { UserDetailVo } from './vo/user-info.vo';
import { UpdateUserPasswordDto } from './dto/update-user-pwd.dto';
import { log } from 'console';
import { UpdateUserDto } from './dto/update-user.dto';
import { generateParseIntPipe } from 'src/utils';
import * as path from 'path';
import { storage } from 'src/file-storage';








@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // add tokenInfo to vo
  addVoToken(vo:LoginUserVo):LoginUserVo {
    vo.accessToken = this.jwtService.sign({
      userId: vo.userInfo.id,
      username: vo.userInfo.username,
      email: vo.userInfo.email,
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
      email: user.email,
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

  @Get('info')
  @RequireLogin()
  async info(@UserInfo('userId') userId: number) {
    const user = await this.userService.findDetailById(userId);

    const vo = new UserDetailVo();
    vo.id = user.id;
    vo.email = user.email;
    vo.username = user.username;
    vo.headPic = user.headPic;
    vo.phoneNumber = user.phoneNumber;
    vo.nickName = user.nickName;
    vo.createTime = user.createTime;
    vo.isFrozen = user.isFrozen;

    return vo 
  }

  @Post(['update_pwd', 'admin_update_pwd'])
  async updatePwd( @Body() pwdDto: UpdateUserPasswordDto) {
    return await this.userService.updatePwdById( pwdDto)
    // return 'success'
  }

  @Get('update_password/captcha')
  async updatePwdCaptcha(@Query('address') address: string) {
    const code = Math.random().toString().slice(2,8);

    await this.redisService.set(`update_pwd_captcha_${address}`, code, 5 * 60);

    await this.emailService.sendMail({
      to: address,
      subject: '修改密码验证码',
      html: `<p>你的修改密码验证码是 ${code}</p>`
    });
    return '发送成功';
  }

  @RequireLogin()
  @Get('update/captcha')
  async updateCaptcha(@UserInfo('email') address: string) {
      const code = Math.random().toString().slice(2,8);
      console.log('address', address);
      
      await this.redisService.set(`update_user_captcha_${address}`, code, 10 * 60);
  
      await this.emailService.sendMail({
        to: address,
        subject: '更改用户信息验证码',
        html: `<p>你的验证码是 ${code}</p>`
      });
      return '发送成功';
  }


  @Post(['update', 'admin/update'])
  @RequireLogin()
  async update(@UserInfo('userId') userId: number, @Body() updateUserDto: UpdateUserDto) {
    return await this.userService.update(userId, updateUserDto); 
  }

  @Get('freeze')
  @RequireLogin()
  async freeze(@Query('id') userId: number) {
    await this.userService.freezeUserById(userId)
    return 'success'
  }

  @Get('list')
  async list(
      @Query('pageNo', new DefaultValuePipe(1), generateParseIntPipe('pageNo')) pageNo: number,
      @Query('pageSize', new DefaultValuePipe(2), generateParseIntPipe('pageSize')) pageSize: number,
      @Query('username') username: string,
      @Query('nickName') nickName: string,
      @Query('email') email: string
  ) {
      return await this.userService.findUsers(username, nickName, email, pageNo, pageSize);
  }
 
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    dest: 'uploads',
    limits: {
      fileSize: 1024 * 1024 * 3
    },
    storage: storage,
    fileFilter(req, file, callback) {
      // type of file
      const extname = path.extname(file.originalname)
      if (['.png', '.jpg', '.gif','.jpeg'].includes(extname)){
        callback(null, true)
      } else {
        callback(new BadRequestException('只能上传图片'), false)
      }
    },
  }))
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    console.log('file', file);
    return file.path;
  }

}
