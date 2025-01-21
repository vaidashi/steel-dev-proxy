## Description

https://steel-dev.notion.site/Proxy-Server-Challenge-17c518e4524180e5982fd91333c36504

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
curl -u username:password http://localhost:3000/metrics
```
