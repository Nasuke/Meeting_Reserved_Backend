import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';
import { Permission } from './user/entities/permission.entity';
import { Request } from 'express';
import { UnLoginException } from './unlogin.filter';

interface JwtUserData {
  userId: number;
  username: string;
  roles: string[];
  permissions: Permission[]
}

declare module 'express' {
  interface Request {
    user: JwtUserData
  }
}

@Injectable()
export class LoginGuard implements CanActivate {

  @Inject()
  private reflector: Reflector

  @Inject(JwtService)
  private jwtService: JwtService

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {

    const request:Request = context.switchToHttp().getRequest()

    // return this first non-null value
    const requireLogin = this.reflector.getAllAndOverride('require-login', [
      context.getClass(),
      context.getHandler()
    ])

    if(!requireLogin) {
      return true
    }

    const authoration = request.headers['authorization']

    if(!authoration) {
      throw new UnLoginException()
    }

    try {
      const token = authoration.split(' ')[1]
      const data = this.jwtService.verify<JwtUserData>(token)

      request.user = {
        userId: data.userId,
        username: data.username,
        roles: data.roles,
        permissions: data.permissions
      }
    } catch (error) {
      throw new UnauthorizedException('token已失效')
    }

    return true;
  }
}
