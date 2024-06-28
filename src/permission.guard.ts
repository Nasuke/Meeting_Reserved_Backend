import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable } from 'rxjs';




@Injectable()
export class PermissionGuard implements CanActivate {


  @Inject(Reflector)
  private reflector: Reflector

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {

    const request:Request = context.switchToHttp().getRequest()

    if(!request.user) {
      // throw new UnauthorizedException('用户未登录')
      return true
    }

    const permissions = request.user.permissions

    const requirePermissions = this.reflector.getAllAndOverride<string[]>('require-permissions', [
      context.getClass(),
      context.getHandler()
    ])

    if(!requirePermissions) {
      return true
    }

    for(let i = 0; i < requirePermissions.length; i++) {  
      const curPermission = requirePermissions[i]
      const found = permissions.find(permission => permission.code === curPermission)
      if(!found) {
        throw new UnauthorizedException('没有访问该接口权限')
      }
    }

    return true;
  }
}
