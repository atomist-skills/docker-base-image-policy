# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.9...HEAD)

### Changed

-   Disable the linking check by default. [20a8c8d](https://github.com/atomist-skills/docker-base-image-policy/commit/20a8c8d664c29aef2418332ea092507871a5be4e)

## [0.1.9](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.8...0.1.9) - 2021-03-30

### Fixed

-   Fix issues in changelog template. [ce80932](https://github.com/atomist-skills/docker-base-image-policy/commit/ce80932826cdf123cade9fb527d296fe39d1231c)

## [0.1.8](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.7...0.1.8) - 2021-03-29

### Changed

-   Update to DevSecOps category. [3cfa236](https://github.com/atomist-skills/docker-base-image-policy/commit/3cfa2367a81c1e2502d49313c317461de588d6a3)

## [0.1.7](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.6...0.1.7) - 2021-03-27

### Fixed

-   Use platfrom to get image from manifest-list. [fee76da](https://github.com/atomist-skills/docker-base-image-policy/commit/fee76da3fc7b1355b9c9f29b91058d9eae3e95fd)

## [0.1.6](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.5...0.1.6) - 2021-03-26

### Added

-   Check to indicate successful linkage of image -> dockerfile -> commit. [#22](https://github.com/atomist-skills/docker-base-image-policy/issues/22)
-   Add changelog for Docker Hub images. [ab14574](https://github.com/atomist-skills/docker-base-image-policy/commit/ab1457496b40c5c42d61e613736021ad38e585ae)

## [0.1.5](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.4...0.1.5) - 2021-03-24

### Changed

-   Review skill overview page and parameter descriptions. [#12](https://github.com/atomist-skills/docker-base-image-policy/issues/12)
-   Update skill icon. [#40](https://github.com/atomist-skills/docker-base-image-policy/issues/40)
-   PR message. [#64](https://github.com/atomist-skills/docker-base-image-policy/issues/64)
-   Different verbage for pinning vs re-pinning PRs. [#61](https://github.com/atomist-skills/docker-base-image-policy/issues/61)

## [0.1.4](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.3...0.1.4) - 2021-03-18

### Changed

-   Set one check only. [a613260](https://github.com/atomist-skills/docker-base-image-policy/commit/a613260fcd5075a95e11c936e5df629c7abc1c62)

## [0.1.3](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.2...0.1.3) - 2021-03-16

### Changed

-   Required Docker Capabilities. [#37](https://github.com/atomist-skills/docker-base-image-policy/issues/37)
-   Configuration. [#41](https://github.com/atomist-skills/docker-base-image-policy/issues/41)

## [0.1.2](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.1...0.1.2) - 2021-03-15

### Added

-   Add badge to check. [3e17f35](https://github.com/atomist-skills/docker-base-image-policy/commit/3e17f35d408381a0e7f6f7dedad0433da5f069b9)

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
