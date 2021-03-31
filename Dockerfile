# Set up build
FROM node:lts@sha256:f6b9ff4caca9d4f0a331a882e560df242eb332b7bbbed2f426784de208fcd7bd AS build

WORKDIR /usr/src

COPY . ./

RUN npm ci --no-optional && \
    npm run compile && \
    rm -rf node_modules .git

# Set up runtime container
FROM atomist/skill:node14@sha256:a0fc4eb9fc3a103bb6db377245ee20eac6e48ccb08c7e40b1d2ea113900c06cd

RUN curl -LO https://storage.googleapis.com/container-diff/latest/container-diff-linux-amd64 && \
    chmod +x container-diff-linux-amd64 && \
    mv container-diff-linux-amd64 /usr/local/bin/container-diff

WORKDIR "/skill"

COPY package.json package-lock.json ./

RUN npm ci --no-optional \
    && rm -rf /root/.npm

COPY --from=build /usr/src/ .

WORKDIR "/atm/home"

ENTRYPOINT ["node", "--no-deprecation", "--no-warnings", "--expose_gc", "--optimize_for_size", "--always_compact", "--max_old_space_size=512", "/skill/node_modules/.bin/atm-skill"]
CMD ["run"]
