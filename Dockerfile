# Set up build
FROM node:lts@sha256:0c558991de47e614588a61f9cc90afdcf034c6fc641d3ab650c9570a98b37605 AS build

WORKDIR /usr/src

COPY . ./

RUN npm ci --no-optional --also=dev \ 
 && npm run skill \
 && rm -rf node_modules .git

# Set up runtime container
FROM atomist/skill:node14@sha256:28c020197bcbf2e4155136705ded591d8c34f90db41cc045ffa28bef077cf745

RUN apt-get update && apt-get install -y \
    curl=7.74.0-1ubuntu2 \
 && curl -LO https://storage.googleapis.com/container-diff/latest/container-diff-linux-amd64 \
 && chmod +x container-diff-linux-amd64 \
 && mv container-diff-linux-amd64 /usr/local/bin/container-diff \
 && apt-get remove -y curl \
 && apt-get autoremove -y \
 && apt-get clean -y \
 && rm -rf /var/cache/apt /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR "/skill"

COPY package.json package-lock.json ./

RUN npm ci --no-optional \
 && rm -rf /root/.npm

COPY --from=build /usr/src/ .

ENTRYPOINT ["node", "--no-deprecation", "--no-warnings", "--expose_gc", "--optimize_for_size", "--always_compact", "--max_old_space_size=512", "/skill/node_modules/.bin/atm-skill"]
CMD ["run"]
