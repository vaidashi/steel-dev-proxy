import { Injectable, NestMiddleware } from '@nestjs/common';
import e, { NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics/metrics.service';
import * as http from 'http-proxy';
import * as auth from 'basic-auth';

@Injectable()
export class ProxyMiddleware implements NestMiddleware {
    private proxy: http.Proxy;
    private username: string = process.env.PROXY_USERNAME;
    private password: string = process.env.PROXY_PASSWORD;

    constructor(private metricsSerivce: MetricsService) {
        this.proxy = http.createProxyServer({});

        this.proxy.on('eror', (err, req, res) => {
            console.error('Proxy error:', err);
            res.statusCode = 500;
            res.end('Proxy server error');
        });

        this.proxy.on('proxyRes', (proxyRes, req: Request, res: Response) => {
            let bytesTransferred = 0;

            proxyRes.on('data', (data: Buffer) => {
                bytesTransferred += data.length;
            });
            proxyRes.on('end', () => {
                this.metricsSerivce.incrementBandwidth(bytesTransferred);
            })
        });
    };

    async use(req: Request, res: Response, next: NextFunction) {
        if (req.path === '/metrics') {
            next();
            return;
        }

        const creds = auth(req);

        if (!creds || creds.name !== this.username || creds.pass !== this.password) {
            res.set('WWW-Authenticate', 'Basic');
            res.status(401).end('Authentication required.');
            return;
        }

        const targetUrl = req.url;

        let url: URL;

        try {
            url = new URL(targetUrl);
        } catch (err) {
            res.status(400).end('Invalid URL');
            return;
        }

        this.metricsSerivce.incrementSiteVisits(url.hostname);

        req.url = url.pathname + url.search;
        const protocol = url.protocol;

        this.proxy.web(
            req, 
            res,
            { target: protocol + '//' + url.host, changeOrigin: true },
            (err) => {
                console.error('Proxy error:', err);
                res.status(500).end('Internal server error');
            }
        )
    }
}