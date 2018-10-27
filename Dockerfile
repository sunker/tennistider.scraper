FROM mhart/alpine-node:9
WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn install && \
    yarn cache clean
    

COPY . .

CMD ["node", "app.js"]


# FROM mhart/alpine-node:9

# WORKDIR /app

# COPY package.json yarn.lock ./

# RUN yarn install && \
#     yarn cache clean
    

# COPY . .

# CMD ["node", "app.js"]









# FROM node:latest
# RUN mkdir /tmp/phantomjs \
#     && curl -L https://bitbucket.org/ariya/phantomjs/downloads/phantomjs-2.1.1-linux-x86_64.tar.bz2 \
#            | tar -xj --strip-components=1 -C /tmp/phantomjs \
#     && mv /tmp/phantomjs/bin/phantomjs /usr/bin \
#     && rm -rf /tmp/phantomjs