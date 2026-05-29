import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerConfig } from './config/swagger';
import { VersioningType } from '@nestjs/common';
import { join } from 'path';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(),
  );

  
  // 1. Static assets
  app.useStaticAssets(join(__dirname, '..', 'public'));

  // 2. Security & cookie middleware
  // cookies, helmet

  // 3. CORS
  app.enableCors({
    origin: '*', // tạm thời chưa có FE nên để *
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  // 4. Global prefix
  app.setGlobalPrefix('api');

  // 5. Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'v',  // /api/v1/
  });

  // 6. Global pipes 
  app.useGlobalPipes( );

  // 7. Global interceptors & filters


  // 8. Logger


  // 9. Swagger (sau cùng để nhận đủ metadata)
  
  SwaggerConfig(app);
  


  await app.listen(process.env.PORT || 3003);

  return app;
}
bootstrap();
