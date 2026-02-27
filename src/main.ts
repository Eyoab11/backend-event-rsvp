import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  // Serve static files (for email images)
  // Files are copied from public/email-images to dist/email-images by nest-cli.json
  app.useStaticAssets(join(__dirname, '..', 'email-images'), {
    prefix: '/static/email-images/',
  });
  
  // Enable CORS for frontend and admin panel
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    process.env.ADMIN_URL || 'http://localhost:3001',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Enable global validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Set global prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3002;
  await app.listen(port);
  console.log(`🚀 Event RSVP Backend running on port ${port}`);
  console.log(`📡 CORS enabled for: ${allowedOrigins.join(', ')}`);
  console.log(`📁 Static files served at: /static/`);
}
bootstrap();
