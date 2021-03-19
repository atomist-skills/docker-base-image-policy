# Set up build
FROM node:lts@sha256:fe842f5b828c121514d62cbe0ace0927aec4f3130297180c3343e54e7ae97362 AS build

WORKDIR /usr/src

COPY . ./

RUN npm ci --no-optional && \
    npm run compile && \
    rm -rf node_modules .git

FROM node:lts@sha256:fe842f5b828c121514d62cbe0ace0927aec4f3130297180c3343e54e7ae97362

WORKDIR "/skill"

COPY package.json package-lock.json ./

RUN npm ci --no-optional \
    && npm cache clean --force

COPY --from=build /usr/src/ .

WORKDIR "/atm/home"

ENV NODE_NO_WARNINGS 1

ENTRYPOINT ["node", "--no-deprecation", "--no-warnings", "--expose_gc", "--optimize_for_size", "--always_compact", "--max_old_space_size=512", "/skill/node_modules/.bin/atm-skill"]
CMD ["run"]
