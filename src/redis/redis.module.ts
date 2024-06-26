import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { createClient } from 'redis';

// 全局模块 只需AppModule里引用
@Global()
@Module({
  providers: [RedisService,
    {
      provide: 'REDIS_CLIENT',
      async useFactory(){
        const client = createClient({
          socket:{
            host: 'localhost',
            port: 6379
          },
          database: 1
        })
        await client.connect()
        return client
      }
    }
  ],
  exports: [RedisService]

})
export class RedisModule {}
