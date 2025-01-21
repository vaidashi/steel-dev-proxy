import { NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics/metrics.service';
import * as http from 'http-proxy';
import * as dotenv from 'dotenv';
import * as net from 'net';

dotenv.config();

export function createProxyMiddleware(metricsService: MetricsService) {
    const proxy = http.createProxyServer({});

    proxy.on('error', (err, req, res) => {
        if (res && !res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
        }
        res.end('Internal server error');
    });

    return function (req: Request, res: Response, next: NextFunction) {
        const username = process.env.PROXY_USERNAME;
        const password = process.env.PROXY_PASSWORD;

        if (req.method === 'CONNECT') {
            next();
        }

        handleHttpRequest(req, res, metricsService, proxy, username, password);
    }
}

function parseProxyAuth(req: Request): { name: string, pass: string } | undefined {
    const authHeader = req.headers['proxy-authorization'] as string;

    if (!authHeader) {
        return undefined;
    }

    const match = authHeader.match(/^Basic (.+)$/);

    if (!match) {
        return undefined;
    }

    const creds = Buffer.from(match[1], 'base64').toString('utf-8');
    const [username, password] = creds.split(':');
    return { name: username, pass: password };
}

function handleHttpRequest(
    req: Request,
    res: Response,
    metricsService: MetricsService,
    proxy: http.Proxy,
    username: string,
    password: string,
) {
    const creds = parseProxyAuth(req);

    if (!creds || creds.name !== username || creds.pass !== password) {
        res.statusCode = 407;
        res.setHeader('Proxy-Authenticate', 'Basic realm="proxy"');
        res.end('Access denied: Proxy Authentication Required');

        return;
    }

    const targetUrl = req.url;
    let url: URL;

    try {
        url = new URL(targetUrl);
    } catch (err) {
        res.statusCode = 400;
        res.end('Invalid URL');
        return;
    }

    metricsService.incrementSiteVisits(url.hostname);

    req.url = url.pathname + url.search;
    const protocol = url.protocol;

    let totalBytes = 0;
    let originalWrite = res.write;
    let originalEnd = res.end;

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

    proxy.web(
        req,
        res,
        { target: protocol + '//' + url.host, changeOrigin: true },
        (err) => {
            console.error('Proxy error:', err);
        }
    );
}

export function handleHttpsConnect(
    req: Request,
    clientSocket: net.Socket,
    head: Buffer,
    metricsService: MetricsService,
    username: string,
    password: string) {
    const creds = parseProxyAuth(req);

    if (!creds || creds.name !== username || creds.pass !== password) {
        clientSocket.write(
            'HTTP/1.1 407 Proxy Authentication Required\r\n' +
            'Proxy-Authenticate: Basic realm="proxy"\r\n' +
            '\r\n',
        );
        clientSocket.destroy();
        return;
    }

    const [hostname, port] = req.url.split(':');
    const targetPort = parseInt(port) || 443;
    const serverSocket = net.connect(targetPort, hostname);

    serverSocket.on('connect', () => {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');

        if (head && head.length) {
            serverSocket.write(head);
        }

        attachDataHandlers(clientSocket, serverSocket, metricsService);

        clientSocket.pipe(serverSocket);
        serverSocket.pipe(clientSocket);
        metricsService.incrementSiteVisits(hostname);
    });

    serverSocket.on('error', (err) => {
        console.error('Server socket error:', err.message);
        clientSocket.destroy();
    });

    clientSocket.on('error', (err) => {
        console.error('Client socket error:', err.message);
        serverSocket.destroy();
    });
}

function attachDataHandlers(clientSocket: net.Socket, serverSocket: net.Socket, metricsService: MetricsService) {
    clientSocket.on('data', (chunk: Buffer) => {
        console.log('bytesFromClient', chunk.length);
        metricsService.incrementBandwidth(chunk.length);
    });

    serverSocket.on('data', (chunk: Buffer) => {
        console.log('bytesFromServer', chunk.length);
        metricsService.incrementBandwidth(chunk.length);
    });
}