FROM node:10.0-slim

RUN npm install yarn --global

ENV NODE_ENV production

COPY . /usr/src/app

WORKDIR /usr/src/app

RUN yarn install

RUN chmod 755 bin/rabbit_worker.js

CMD [ "bin/rabbit_worker.js"]