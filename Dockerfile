# Set up build
FROM node:lts@sha256:5715da764b8ef8c1eb44b8f6503599cce3603e82ec0a8c5e9c7f62c72c31ca70 AS build

WORKDIR /usr/src

COPY . ./

RUN npm ci --no-optional --also=dev \ 
 && npm run skill \
 && rm -rf node_modules .git

# Set up runtime container
FROM atomist/skill:node14@sha256:3e2d6fee4b26213eeb7caf3c8910b2b0a98bbc50c5997851d979c92c6af9458a

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

WORKDIR "/atm/home"

ENTRYPOINT ["node", "--no-deprecation", "--no-warnings", "--expose_gc", "--optimize_for_size", "--always_compact", "--max_old_space_size=512", "/skill/node_modules/.bin/atm-skill"]
CMD ["run"]
