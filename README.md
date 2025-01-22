## Description

Proxy server using NestJS that tracks bandwidth usage and site analytics; specifically site vists. 

1. Install [npm](https://www.npmjs.com/)
1. Create a .env and set the following, or any other values and adjust testing commands below.

```.env
PROXY_USERNAME="username"
PROXY_PASSWORD="password"
```

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```
---
### Test

#### For HTTP
```
curl -x http://localhost:3000 --proxy-user username:password -L https://www.example.com
```

#### For HTTPS
```bash
curl -x http://localhost:3000 --proxy-user username:password -L https://www.google.com
```

#### For /metrics
```bash
curl http://localhost:3000/metrics
```

Upon server shutdown, a summary of metrics will be outputted to the console, listing total bandwidth and top visited sites in sorted order. 

```bash
-------------Metrics Summary---------------
Total Bandwidth: 49.08 KB
Top Sites:
1. www.google.com - 2 visits
2. www.example.com - 1 visits

```