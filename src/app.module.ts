import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MetricsService } from './metrics/metrics.service';
import { MetricsController } from './metrics/metrics.controller';
import { createProxyMiddleware } from './proxy.middleware';

@Module({
  controllers: [AppController, MetricsController],
  providers: [AppService, MetricsService],
  exports: [MetricsService],
})

export class AppModule implements NestModule {
  constructor(private metricsService: MetricsService) {}

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(createProxyMiddleware(this.metricsService))
      .exclude('/metrics')
      .forRoutes('*');
  }
}
