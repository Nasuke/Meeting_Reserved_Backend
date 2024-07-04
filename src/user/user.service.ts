import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Like, Repository } from 'typeorm';
import { RegisterUserDto } from './dto/register-user.dto';
import { RedisService } from 'src/redis/redis.service';
import { md5 } from 'src/utils';
import { log } from 'console';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { LoginUserDto } from './dto/login-user.dto';
import { LoginUserVo } from './vo/login-user.vo';
import { UpdateUserPasswordDto } from './dto/update-user-pwd.dto';
import { UpdateUserDto } from './dto/update-user.dto';


@Injectable()
export class UserService {

  private logger = new Logger()

  // 注入user
  @InjectRepository(User)
  private userRepository:Repository<User>
  // 注入role
  @InjectRepository(Role)
  private roleRepository:Repository<Role>
  // 注入Permission
  @InjectRepository(Permission)
  private permissionRepository:Repository<Permission>
  // 注入redis
  @Inject(RedisService)
  private redisService: RedisService


  // 注册操作
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

  /**
   * 生成环境初始化数据
   */
  async initData() {
    const user1 = new User();
    user1.username = "qia";
    user1.password = md5("111");
    user1.email = "3379244200@qq.com";
    user1.isAdmin = true;
    user1.nickName = 'qiab';
    user1.phoneNumber = '13233323333';

    const user2 = new User();
    user2.username = 'oyw';
    user2.password = md5("222");
    user2.email = "2624003776@qq.com";
    user2.nickName = 'oy';

    const role1 = new Role();
    role1.name = '管理员';

    const role2 = new Role();
    role2.name = '普通用户';

    const permission1 = new Permission();
    permission1.code = 'ccc';
    permission1.description = '访问 ccc 接口';

    const permission2 = new Permission();
    permission2.code = 'ddd';
    permission2.description = '访问 ddd 接口';

    user1.roles = [role1];
    user2.roles = [role2];

    role1.permissions = [permission1, permission2];
    role2.permissions = [permission1];

    await this.permissionRepository.save([permission1, permission2])
    await this.roleRepository.save([role1, role2])
    await this.userRepository.save([user1, user2])
  }

  /**
   * 
   * @param loginUser 
   * @param isAdmin 
   */
  async login(loginUser: LoginUserDto, isAdmin: boolean){

    // join query
    const user = await this.userRepository.findOne({
      where: {
        username: loginUser.username,
        isAdmin
      },
      relations: ['roles', 'roles.permissions']
    })

    if(!user){
      throw new HttpException('用户不存在', HttpStatus.BAD_REQUEST)
    }

    if(user.password !== md5(loginUser.password)){
      throw new HttpException('密码错误', HttpStatus.BAD_REQUEST)
    }
    // vo - wrap the userInfo
    const vo = new LoginUserVo()
    
    vo.userInfo = {
      id: user.id,
      username: user.username,
      nickName: user.nickName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      headPic: user.headPic,
      createTime: user.createTime.getTime(),
      isFrozen: user.isFrozen,
      isAdmin: user.isAdmin,
      roles: user.roles.map(item => item.name),
      permissions: user.roles.reduce((arr, item) => {
          item.permissions.forEach(permission => {
              if(arr.indexOf(permission) === -1) {
                  arr.push(permission);
              }
          })
          return arr;
      }, [])
    }

    return vo
  }

  /**
   * @param userId 
   * @param isAdmin 
   */
  async findUserById(userId: number, isAdmin: boolean) {
    const user =  await this.userRepository.findOne({
        where: {
            id: userId,
            isAdmin
        },
        relations: [ 'roles', 'roles.permissions']
    });

    return {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin,
        email: user.email,
        roles: user.roles.map(item => item.name),
        permissions: user.roles.reduce((arr, item) => {
            item.permissions.forEach(permission => {
                if(arr.indexOf(permission) === -1) {
                    arr.push(permission);
                }
            })
            return arr;
        }, [])
    }
  }

  /**
   * @param userId 
   */
  async findDetailById(userId: number) {
    const user = await this.userRepository.findOne({
      where:{
        id: userId
      }
    })
    return user
  }

  /**
   * @param userId 
   * @param pwdDto 
   * @returns 
   */
  async updatePwdById(pwdDto: UpdateUserPasswordDto) {
    const captcha = await this.redisService.get(`update_pwd_captcha_${pwdDto.email}`)

    if(!captcha){
      throw new HttpException('验证码已失效', HttpStatus.BAD_REQUEST)
    }

    if(captcha !== pwdDto.captcha){
      throw new HttpException('验证码错误', HttpStatus.BAD_REQUEST)
    }

    const foundUser = await this.userRepository.findOneBy({
      username: pwdDto.username
    })

    if(foundUser.email !== pwdDto.email){
      throw new HttpException('邮箱不正确', HttpStatus.BAD_REQUEST)
    }

    foundUser.password = md5(pwdDto.password)

    try {
      await this.userRepository.save(foundUser)
      return '密码修改成功'
    } catch (e) {
      this.logger.error(e, UserService)
      return '修改密码失败'
    }
  }
  /**
   * @param userId 
   * @param updateUserDto 
   * @returns 
   */
  async update(userId: number, updateUserDto: UpdateUserDto) {
    const captcha = await this.redisService.get(`update_user_captcha_${updateUserDto.email}`);

    if(!captcha) {
        throw new HttpException('验证码已失效', HttpStatus.BAD_REQUEST);
    }

    if(updateUserDto.captcha !== captcha) {
        throw new HttpException('验证码不正确', HttpStatus.BAD_REQUEST);
    }

    const foundUser = await this.userRepository.findOneBy({
      id: userId
    });

    if(updateUserDto.nickName) {
        foundUser.nickName = updateUserDto.nickName;
    }
    if(updateUserDto.headPic) {
        foundUser.headPic = updateUserDto.headPic;
    }

    try {
      await this.userRepository.save(foundUser);
      return '用户信息修改成功';
    } catch(e) {
      this.logger.error(e, UserService);
      return '用户信息修改成功';
    }
}

  async freezeUserById(userId: number) {
    const foundUser = await this.userRepository.findOneBy({
      id: userId
    })

    foundUser.isFrozen = !foundUser.isFrozen

    try {
      await this.userRepository.save(foundUser)
      return '冻结/解冻成功'
    } catch (e) {
      this.logger.error(e, UserService)
      return '冻结/解冻失败'
  }
}

async findUsers(username: string, nickName: string, email: string, pageNo: number, pageSize: number) {
  const skipCount = (pageNo - 1) * pageSize;

  const condition: Record<string, any> = {};

  if(username) {
      condition.username = Like(`%${username}%`);   
  }
  if(nickName) {
      condition.nickName = Like(`%${nickName}%`); 
  }
  if(email) {
      condition.email = Like(`%${email}%`); 
  }

  const [users, totalCount] = await this.userRepository.findAndCount({
      select: ['id', 'username', 'nickName', 'email', 'phoneNumber', 'isFrozen', 'headPic', 'createTime'],
      skip: skipCount,
      take: pageSize,
      where: condition
  });

  return {
      users,
      totalCount
  }
}



}

