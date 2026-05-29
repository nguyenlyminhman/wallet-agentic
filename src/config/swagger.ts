import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function SwaggerConfig(app: INestApplication): void {
  const documentBuilder = new DocumentBuilder()
    .setTitle('WALLET AGENTIC AI SERVER')
    .setDescription('The API Documentations for WalletAgenticAI Service')
    .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'authorization',
        description: 'Enter JWT token (Bearer <token>)',
        in: 'header',
      })
      

  if (process.env.API_VERSION) {
    documentBuilder.setVersion(process.env.API_VERSION);
  }

  const document = SwaggerModule.createDocument(app, documentBuilder.build());
  SwaggerModule.setup('documentation', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
    customSiteTitle: 'WalletAgenticAI APIs Service',
    customfavIcon: '../img/favicon.ico',
    customCssUrl: '../css/swagger.css',
  });

  console.info(
    `Documentation: http://localhost:${process.env.PORT}/documentation`,
  );
}
