import { Injectable, NestMiddleware } from '@nestjs/common';
import e, { NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics/metrics.service';
import * as http from 'http-proxy';
import * as auth from 'basic-auth';
import * as dotenv from 'dotenv';
import * as net from 'net';

dotenv.config();

@Injectable()
export class ProxyMiddleware implements NestMiddleware {
    private proxy: http.Proxy;
    private username: string = process.env.PROXY_USERNAME;
    private password: string = process.env.PROXY_PASSWORD;

    constructor(private metricsSerivce: MetricsService) {
        this.proxy = http.createProxyServer({});

        this.proxy.on('eror', (err, req, res) => {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Proxy server error');
        });
    };

    async use(req: Request, res: Response, next: NextFunction) {
        if (req.method === 'CONNECT') {
            // Handle HTTPS proxying
            await this.handleHttpsConnect(req, res);
            return;
        }

        if (req.baseUrl === '/metrics') {
            console.log('Skipping authentication for /metrics endpoint');
            return next();
        }

        await this.handleHttpRequest(req, res);
    }

    private async handleHttpRequest(req: Request, res: Response) {
        const creds = auth(req);

        if (!creds || creds.name !== this.username || creds.pass !== this.password) {
            res.statusCode = 401;
            res.setHeader('WWW-Authenticate', 'Basic realm="proxy"');
            res.end('Access denied');
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

        let totalBytes = 0;
        let originalWrite = res.write;
        let originalEnd = res.end;
        const metricsService = this.metricsSerivce;

        res.write = (chunk, ...args) => {
            if (chunk) {
              totalBytes += Buffer.byteLength(chunk);
            }
            return originalWrite.apply(res, [chunk, ...args]);
        };

        res.end = (chunk, ...args) => {
            if (chunk) {
              totalBytes += Buffer.byteLength(chunk);
            }
            metricsService.incrementBandwidth(totalBytes);
            return originalEnd.apply(res, [chunk, ...args]);
        };

        this.proxy.web(
            req, 
            res,
            { target: protocol + '//' + url.host, changeOrigin: true },
            (err) => {
                console.error('Proxy error:', err);
                res.status(500).end('Internal server error');
            }
        );
    }

    private async handleHttpsConnect(req: Request, res: Response) {
        const creds = auth(req);
        
        if (!creds || creds.name !== this.username || creds.pass !== this.password) {
            res.statusCode = 407;
            res.setHeader('WWW-Authenticate', 'Basic realm="proxy"');
            res.end('Proxy Authentication Required');
            return;
        }

        const [hostname, port] = req.url.split(':');

        const socket = net.connect(parseInt(port) || 443, hostname, () => {
            res.writeHead(200, 'Connection Established');
            res.flushHeaders();

            socket.pipe(res.socket as net.Socket);
            (res.socket as net.Socket).pipe(socket);
        });

        socket.on('error', (err) => {
            console.error('Socket error:', err);
            res.writeHead(500);
            res.end('Internal server error');
        });

        let bytesFromServer = 0;
        let bytesFromClient = 0;

        socket.on('data', (chunk: Buffer) => {
            bytesFromServer += chunk.length;
        });

        (res.socket as net.Socket).on('data', (chunk: Buffer) => {
            bytesFromClient += chunk.length;
        });

        socket.on('end', () => {
            const totalBytes = bytesFromClient + bytesFromServer;
            this.metricsSerivce.incrementBandwidth(totalBytes);

            this.metricsSerivce.incrementSiteVisits(hostname);
        });
    }
}