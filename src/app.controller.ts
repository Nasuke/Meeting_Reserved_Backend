import { Controller, Get, Body, Post, SetMetadata } from '@nestjs/common';
import { AppService } from './app.service';
import { RequireLogin, RequirePermission, UserInfo } from './custom.decorator';




@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('aaa')
  @RequireLogin()
  @RequirePermission('aaa')
  aaa(@UserInfo('username') username: string, @UserInfo() userInfo) {
      
      return 'aaa';
  }

  @Get('bbb')
  bbb() {
      return 'bbb';
  }

}
