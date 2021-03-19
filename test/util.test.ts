/*
 * Copyright © 2021 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as assert from "assert";

import { replaceFroms, replaceLastFrom } from "../lib/util";

describe("util", () => {
	describe("replaceFroms", () => {
		it("should replace all in simple dockerfile", () => {
			const dockerfile = `FROM ubuntu:focal`;
			const replacedDockerfile = replaceFroms(dockerfile, [
				"ubuntu:rolling",
			]);
			assert.strictEqual(replacedDockerfile, "FROM ubuntu:rolling");
		});
		it("should replace all in complex dockerfile", () => {
			const dockerfile = `FROM clojure:openjdk-11-lein-slim-buster AS builder

ARG MVN_ARTIFACTORYMAVENREPOSITORY_USER
ARG MVN_ARTIFACTORYMAVENREPOSITORY_PWD

RUN mkdir /build

WORKDIR /build

COPY project.clj /build
COPY src /build/src
COPY resources /build/resources

RUN lein metajar

FROM gcr.io/atomist-container-registry/java-atomist:openjdk11@sha256:123456 \\
 AS runtime

MAINTAINER Jim Clark <jim@atomist.com>

RUN mkdir -p /usr/src/app \\\\
    && mkdir -p /usr/src/app/bin \\\\
    && mkdir -p /usr/src/app/lib

WORKDIR /usr/src/app

COPY --from=builder /build/target/lib /usr/src/app/lib

COPY --from=builder /build/target/view-service.jar /usr/src/app/

CMD ["-Djava.net.preferIPv4Stack=true", "-jar", "/usr/src/app/view-service.jar"]

ENV APP_NAME=view

EXPOSE 8080
`;
			const replacedDockerfile = replaceFroms(dockerfile, [
				"clojure@sha256:12345",
				"gcr.io/atomist-container-registry/java-atomist@sha256:123456",
			]);
			assert.strictEqual(
				replacedDockerfile,
				`FROM clojure@sha256:12345 AS builder

ARG MVN_ARTIFACTORYMAVENREPOSITORY_USER
ARG MVN_ARTIFACTORYMAVENREPOSITORY_PWD

RUN mkdir /build

WORKDIR /build

COPY project.clj /build
COPY src /build/src
COPY resources /build/resources

RUN lein metajar

FROM gcr.io/atomist-container-registry/java-atomist@sha256:123456 \\
 AS runtime

MAINTAINER Jim Clark <jim@atomist.com>

RUN mkdir -p /usr/src/app \\\\
    && mkdir -p /usr/src/app/bin \\\\
    && mkdir -p /usr/src/app/lib

WORKDIR /usr/src/app

COPY --from=builder /build/target/lib /usr/src/app/lib

COPY --from=builder /build/target/view-service.jar /usr/src/app/

CMD ["-Djava.net.preferIPv4Stack=true", "-jar", "/usr/src/app/view-service.jar"]

ENV APP_NAME=view

EXPOSE 8080
`,
			);
		});
	});

	describe("replaceFrom", () => {
		it("should replace single from", () => {
			const dockerfile = `FROM ubuntu:focal`;
			const replaceDockerfile = replaceLastFrom(
				dockerfile,
				"ubuntu:rolling",
				"rolling",
			);
			assert.strictEqual(
				replaceDockerfile,
				"FROM ubuntu:rolling\nLABEL com.atomist.follow-tag=rolling",
			);
		});
		it("should replace from", () => {
			const dockerfile = `FROM ubuntu:focal\nRUN echo test\nFROM ubuntu:focal@sha256:343225252424242\nPORT 8080`;
			const replaceDockerfile = replaceLastFrom(
				dockerfile,
				"ubuntu:rolling",
				"rolling",
			);
			assert.strictEqual(
				replaceDockerfile,
				"FROM ubuntu:focal\nRUN echo test\nFROM ubuntu:rolling\nLABEL com.atomist.follow-tag=rolling\nPORT 8080",
			);
		});
		it("should replace from in complex file", () => {
			const dockerfile = `FROM clojure:openjdk-11-lein-slim-buster AS builder

ARG MVN_ARTIFACTORYMAVENREPOSITORY_USER
ARG MVN_ARTIFACTORYMAVENREPOSITORY_PWD

RUN mkdir /build

WORKDIR /build

COPY project.clj /build
COPY src /build/src
COPY resources /build/resources

RUN lein metajar

FROM gcr.io/atomist-container-registry/java-atomist:openjdk11@sha256:123456 AS runtime

MAINTAINER Jim Clark <jim@atomist.com>

RUN mkdir -p /usr/src/app \\
    && mkdir -p /usr/src/app/bin \\
    && mkdir -p /usr/src/app/lib

WORKDIR /usr/src/app

COPY --from=builder /build/target/lib /usr/src/app/lib

COPY --from=builder /build/target/view-service.jar /usr/src/app/

CMD ["-Djava.net.preferIPv4Stack=true", "-jar", "/usr/src/app/view-service.jar"]

ENV APP_NAME=view

EXPOSE 8080
`;
			const replaceDockerfile = replaceLastFrom(
				dockerfile,
				"gcr.io/atomist-container-registry/java-atomist@sha256:e951674a5535c507d29f28c29f444b993d9b1e8ee1f16d7cfaddb8c7a30567dc",
				"openjdk11",
			);
			assert.strictEqual(
				replaceDockerfile,
				`FROM clojure:openjdk-11-lein-slim-buster AS builder

ARG MVN_ARTIFACTORYMAVENREPOSITORY_USER
ARG MVN_ARTIFACTORYMAVENREPOSITORY_PWD

RUN mkdir /build

WORKDIR /build

COPY project.clj /build
COPY src /build/src
COPY resources /build/resources

RUN lein metajar

FROM gcr.io/atomist-container-registry/java-atomist@sha256:e951674a5535c507d29f28c29f444b993d9b1e8ee1f16d7cfaddb8c7a30567dc AS runtime
LABEL com.atomist.follow-tag=openjdk11

MAINTAINER Jim Clark <jim@atomist.com>

RUN mkdir -p /usr/src/app \\
    && mkdir -p /usr/src/app/bin \\
    && mkdir -p /usr/src/app/lib

WORKDIR /usr/src/app

COPY --from=builder /build/target/lib /usr/src/app/lib

COPY --from=builder /build/target/view-service.jar /usr/src/app/

CMD ["-Djava.net.preferIPv4Stack=true", "-jar", "/usr/src/app/view-service.jar"]

ENV APP_NAME=view

EXPOSE 8080
`,
			);
		});

		it("should correctly update same from line", () => {
			const dockerfile = `# Set up build
FROM node:lts AS build

WORKDIR /usr/src

COPY . ./

RUN npm ci --no-optional && \\
    npm run compile && \\
    rm -rf node_modules .git

FROM node:lts

WORKDIR "/skill"

COPY package.json package-lock.json ./

RUN npm ci --no-optional \\
    && npm cache clean --force

COPY --from=build /usr/src/ .

WORKDIR "/atm/home"

ENV NODE_NO_WARNINGS 1

ENTRYPOINT ["node", "--no-deprecation", "--no-warnings", "--expose_gc", "--optimize_for_size", "--always_compact", "--max_old_space_size=512", "/skill/node_modules/.bin/atm-skill"]
CMD ["run"]
`;

			let result = replaceFroms(
				dockerfile,
				[
					"node:lts@sha256:fe842f5b828c121514d62cbe0ace0927aec4f3130297180c3343e54e7ae97362",
					"node:lts@sha256:fe842f5b828c121514d62cbe0ace0927aec4f3130297180c3343e54e7ae97362",
				],
				0,
			);
			assert.deepStrictEqual(
				result,
				`# Set up build
FROM node:lts@sha256:fe842f5b828c121514d62cbe0ace0927aec4f3130297180c3343e54e7ae97362 AS build

WORKDIR /usr/src

COPY . ./

RUN npm ci --no-optional && \\
    npm run compile && \\
    rm -rf node_modules .git

FROM node:lts

WORKDIR "/skill"

COPY package.json package-lock.json ./

RUN npm ci --no-optional \\
    && npm cache clean --force

COPY --from=build /usr/src/ .

WORKDIR "/atm/home"

ENV NODE_NO_WARNINGS 1

ENTRYPOINT ["node", "--no-deprecation", "--no-warnings", "--expose_gc", "--optimize_for_size", "--always_compact", "--max_old_space_size=512", "/skill/node_modules/.bin/atm-skill"]
CMD ["run"]
`,
			);

			result = replaceFroms(
				result,
				[
					"node:lts@sha256:fe842f5b828c121514d62cbe0ace0927aec4f3130297180c3343e54e7ae97362",
					"node:lts@sha256:fe842f5b828c121514d62cbe0ace0927aec4f3130297180c3343e54e7ae97362",
				],
				1,
			);
			assert.deepStrictEqual(
				result,
				`# Set up build
FROM node:lts@sha256:fe842f5b828c121514d62cbe0ace0927aec4f3130297180c3343e54e7ae97362 AS build

WORKDIR /usr/src

COPY . ./

RUN npm ci --no-optional && \\
    npm run compile && \\
    rm -rf node_modules .git

FROM node:lts@sha256:fe842f5b828c121514d62cbe0ace0927aec4f3130297180c3343e54e7ae97362

WORKDIR "/skill"

COPY package.json package-lock.json ./

RUN npm ci --no-optional \\
    && npm cache clean --force

COPY --from=build /usr/src/ .

WORKDIR "/atm/home"

ENV NODE_NO_WARNINGS 1

ENTRYPOINT ["node", "--no-deprecation", "--no-warnings", "--expose_gc", "--optimize_for_size", "--always_compact", "--max_old_space_size=512", "/skill/node_modules/.bin/atm-skill"]
CMD ["run"]
`,
			);
		});
	});
});
