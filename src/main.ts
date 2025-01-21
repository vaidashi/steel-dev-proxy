import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MetricsService } from './metrics/metrics.service';
import { handleHttpsConnect } from './proxy.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const metricsSerivce = app.get(MetricsService);
  const server = app.getHttpServer();

  server.on('connect', (req, clientSocket, head) => {
    const username = process.env.PROXY_USERNAME;
    const password = process.env.PROXY_PASSWORD;

    handleHttpsConnect(req, clientSocket, head, metricsSerivce, username, password);
  });

  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
  console.log(`Listening on port ${process.env.PORT ?? 3000}`);
}


bootstrap();
