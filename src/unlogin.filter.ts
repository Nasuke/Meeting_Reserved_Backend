import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

export class UnLoginException extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'UnLoginException';
  }
}

@Catch(UnLoginException)
export class UnloginFilter<T> implements ExceptionFilter {
  catch(exception: UnLoginException, host: ArgumentsHost) {

    const response = host.switchToHttp().getResponse<Response>();

    response.json({
      code: HttpStatus.UNAUTHORIZED,
      message: 'fail',
      data: exception.message || '用户还没有登录~'
    }).end();

  }
}
