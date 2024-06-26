import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { RegisterUserDto } from './dto/register-user.dto';
import { RedisService } from 'src/redis/redis.service';
import { md5 } from 'src/utils';
import { log } from 'console';

@Injectable()
export class UserService {

  private logger = new Logger()

  // 操作user实体
  @InjectRepository(User)
  private userRepository:Repository<User>

  // 注入redis
  @Inject(RedisService)
  private redisService: RedisService

  async register(user:RegisterUserDto){
    
    // 先走redis邮箱验证
    const captcha = await this.redisService.get(`captcha_${user.email}`)
    
    if(!captcha){
      throw new HttpException('验证码已失效', HttpStatus.BAD_REQUEST)
    }

    if(captcha !== user.captcha){
      throw new HttpException('验证码错误', HttpStatus.BAD_REQUEST)
    }
    // 再走数据库验证
    const founderUser = await this.userRepository.findOneBy({
      username: user.username
    })
    // 查到则说明用户已经注册
    if(founderUser){
      throw new HttpException('用户已存在', HttpStatus.BAD_REQUEST)
    }

    // 没查到则实例化对象 并加密后存入
    const newUser = new User()
    newUser.username = user.username
    newUser.password = md5(user.password)
    newUser.email = user.email
    newUser.nickName = user.nickName

    try {
      await this.userRepository.save(newUser)
      return '注册成功'
    } catch (error) {
      this.logger.error(error, UserService)
      return '注册失败'
    }
  }
}

