# Set up build
FROM node:lts@sha256:8eb45f4677c813ad08cef8522254640aa6a1800e75a9c213a0a651f6f3564189 AS build

WORKDIR /usr/src

COPY . ./

RUN npm ci --no-optional && \
    npm run skill && \
    rm -rf node_modules .git

# Set up runtime container
FROM atomist/skill:node14@sha256:1f5574256296251d381a78d1987b83723534b419409d54a1a12b5595e23fb47f

RUN apt-get update && \
    apt-get install -y curl=7.74.0-1ubuntu2 && \
    curl -LO https://storage.googleapis.com/container-diff/latest/container-diff-linux-amd64 && \
    chmod +x container-diff-linux-amd64 && \
    mv container-diff-linux-amd64 /usr/local/bin/container-diff && \
    apt-get remove -y curl && \
    apt-get autoremove -y && \
    apt-get clean -y && \
    rm -rf /var/cache/apt /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR "/skill"

COPY package.json package-lock.json ./

RUN npm ci --no-optional \
    && rm -rf /root/.npm

COPY --from=build /usr/src/ .

WORKDIR "/atm/home"

ENTRYPOINT ["node", "--no-deprecation", "--no-warnings", "--expose_gc", "--optimize_for_size", "--always_compact", "--max_old_space_size=512", "/skill/node_modules/.bin/atm-skill"]
CMD ["run"]
