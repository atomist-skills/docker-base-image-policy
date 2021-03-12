# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.1...HEAD)

## [0.1.1](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.0...0.1.1) - 2021-03-12

### Added

-   Include tag that is being followed to pin check. [#21](https://github.com/atomist-skills/docker-base-image-policy/issues/21)

### Changed

-   Enable pinning pull requests by default. [c1fed2c](https://github.com/atomist-skills/docker-base-image-policy/commit/c1fed2cf559f4f16e1c384ccfb846ce7c67fa78c)

## [0.1.0](https://github.com/atomist-skills/docker-base-image-policy/tree/0.1.0) - 2021-03-11

### Added

-   Initial version. [c6a4078](https://github.com/atomist-skills/docker-base-image-policy/commit/c6a407887bbe3a22951c4fbdab4bc61ee8899e1d)
-   Add base image accept feature. [c71ac95](https://github.com/atomist-skills/docker-base-image-policy/commit/c71ac95524a205e8c5bea95266b66408a9d66e38)
-   Add Pinned vs Unpinned Github Check. [#8](https://github.com/atomist-skills/docker-base-image-policy/issues/8)
-   Support to pin multiple FROM instructions per Dockerfile. [#6](https://github.com/atomist-skills/docker-base-image-policy/issues/6)
-   Add configuration to preserve tag when pinning. [dcecf91](https://github.com/atomist-skills/docker-base-image-policy/commit/dcecf91a74ea67b346ae4f965f32e2b0c9ea611e)

### Changed

-   Pin to manifest-list digest if available. [#2](https://github.com/atomist-skills/docker-base-image-policy/issues/2)
-   Turn into container skill. [#7](https://github.com/atomist-skills/docker-base-image-policy/issues/7)
-   Validate all used base images against allow-list. [#15](https://github.com/atomist-skills/docker-base-image-policy/issues/15)
