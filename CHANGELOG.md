# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.36...HEAD)

### Added

*   Backfill supported tags. [#251](https://github.com/atomist-skills/docker-base-image-policy/issues/251)

## [0.1.36](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.35...0.1.36) - 2021-06-09

### Fixed

*   Fix issue with checks when Dockerfiles are nested in dirs. [9b8547c](https://github.com/atomist-skills/docker-base-image-policy/commit/9b8547c0399d569f104f6d0f8fe4948f839d80c2)

## [0.1.35](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.34...0.1.35) - 2021-06-08

### Added

*   Transact support-tags on docker.repository. [80f69b5](https://github.com/atomist-skills/docker-base-image-policy/commit/80f69b59e773c108c38df170deb2549dc221533b)

### Fixed

*   Fix changelog formatting. [14b7421](https://github.com/atomist-skills/docker-base-image-policy/commit/14b7421cc0a692897744808fbd0e639886eeb626)
*   Fix commit sha in pinning PR body. [e2193ad](https://github.com/atomist-skills/docker-base-image-policy/commit/e2193adb095b85bbce0ab36b6a3dc649fb507d1a)

## [0.1.34](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.33...0.1.34) - 2021-06-04

### Changed

*   Improve file diff in changelog. [#217](https://github.com/atomist-skills/docker-base-image-policy/issues/217)
*   Polish changelogs in pinning PRs. [3e788c9](https://github.com/atomist-skills/docker-base-image-policy/commit/3e788c9c2b4dcbdea27a1cac1ecf3234c98b4e77)
*   Remove check run annotations. [06b8855](https://github.com/atomist-skills/docker-base-image-policy/commit/06b885511b0c0d5fdaa55d9e4cb7bfc851eda9e5)

### Removed

*   Remove Update Tag check run action. [#216](https://github.com/atomist-skills/docker-base-image-policy/issues/216)

### Fixed

*   Pinning PR body gets truncated for lots of changes. [#213](https://github.com/atomist-skills/docker-base-image-policy/issues/213)

## [0.1.33](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.32...0.1.33) - 2021-05-12

### Fixed

*   Fix branch filter. [81d7cae](https://github.com/atomist-skills/docker-base-image-policy/commit/81d7caedc16b09dd6132b8eee879b1c756244c99)

## [0.1.32](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.31...0.1.32) - 2021-05-07

## [0.1.31](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.30...0.1.31) - 2021-05-06

## [0.1.30](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.29...0.1.30) - 2021-05-06

### Fixed

*   Fix config change subscription to allow for no checks. [ff79f2a](https://github.com/atomist-skills/docker-base-image-policy/commit/ff79f2adc56ec6f7016a8a64c91c641419eefabb)
*   Ensure check is enabled by config. [883c242](https://github.com/atomist-skills/docker-base-image-policy/commit/883c2428b99a2b46917517aa0af91c592485fa14)
*   Assert that repoFilter has selection. [dc2a96a](https://github.com/atomist-skills/docker-base-image-policy/commit/dc2a96a16acdfee5dafe8a9cd3e464302377053e)

## [0.1.29](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.28...0.1.29) - 2021-05-02

### Added

*   Hook up config change event handlers. [374d623](https://github.com/atomist-skills/docker-base-image-policy/commit/374d623a017a527310b73f0a1ca837f666ed2ee9)

## [0.1.28](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.27...0.1.28) - 2021-04-30

### Changed

*   Aggregate tag update into one Check action. [#176](https://github.com/atomist-skills/docker-base-image-policy/issues/176)
*   Avoid cloning for pinning and supported tag checks. [#175](https://github.com/atomist-skills/docker-base-image-policy/issues/175)

## [0.1.27](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.26...0.1.27) - 2021-04-29

## [0.1.26](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.25...0.1.26) - 2021-04-28

## [0.1.25](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.24...0.1.25) - 2021-04-26

## [0.1.24](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.23...0.1.24) - 2021-04-23

### Added

*   Add Check run action to update to a supported Docker image tag. [#155](https://github.com/atomist-skills/docker-base-image-policy/issues/155)

## [0.1.23](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.22...0.1.23) - 2021-04-22

### Changed

*   Polish tag printing. [3ff2649](https://github.com/atomist-skills/docker-base-image-policy/commit/3ff26494a6ac588fc28cc9b7ebf26f9ec77fa6b5)

### Fixed

*   Resolve image references across all Dockerfiles. [33c3edd](https://github.com/atomist-skills/docker-base-image-policy/commit/33c3edd9b9b8e77f13113968b5db8ea48dd24680)

## [0.1.22](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.21...0.1.22) - 2021-04-22

### Changed

*   Switch to notice for annotations when check is neutral. [dd83c0d](https://github.com/atomist-skills/docker-base-image-policy/commit/dd83c0dc7a0e6d0335a73484dc713a7e155a2877)

## [0.1.21](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.20...0.1.21) - 2021-04-21

### Changed

*   Update to new logging. [61d8e4f](https://github.com/atomist-skills/docker-base-image-policy/commit/61d8e4f6038eb79c1d82a0c3aef55a83aef0f674)

## [0.1.20](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.19...0.1.20) - 2021-04-21

### Changed

*   Move digest word up in compare sentence. [167534c](https://github.com/atomist-skills/docker-base-image-policy/commit/167534cb603b640e4298050efb5bf5f0c71559ed)
*   Make checks neutral by default and allow config. [2a32c36](https://github.com/atomist-skills/docker-base-image-policy/commit/2a32c364cd11cffd94a393e755612047878f2dac)

## [0.1.19](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.18...0.1.19) - 2021-04-14

### Added

*   Add suggestion for supported tag. [2f40c37](https://github.com/atomist-skills/docker-base-image-policy/commit/2f40c37a154fda7f210dc6b3e2c316df2dd9e263)

### Changed

*   Update imageName in changelog pending message. [1731944](https://github.com/atomist-skills/docker-base-image-policy/commit/1731944dcc368a7f48372352d7a4d05f76c69495)

## [0.1.18](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.17...0.1.18) - 2021-04-13

### Added

*   Add check to indicate supported base image tags. [62c2efc](https://github.com/atomist-skills/docker-base-image-policy/commit/62c2efc420c35cca28f28cddf8563c43603e9860)

### Changed

*   Resolve referenced images and manifest-lists. [9b6125d](https://github.com/atomist-skills/docker-base-image-policy/commit/9b6125d2f0ef1338bf921b56744c2da4734604db)

## [0.1.17](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.16...0.1.17) - 2021-04-01

## [0.1.16](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.15...0.1.16) - 2021-03-31

### Fixed

*   Use first platform on an image for comparison. [1909739](https://github.com/atomist-skills/docker-base-image-policy/commit/190973963967cdfa9c0c45b14562f51b581b59b9)

## [0.1.15](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.14...0.1.15) - 2021-03-31

## [0.1.14](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.13...0.1.14) - 2021-03-31

### Fixed

*   Fix undefined access when diffing arrays. [b41ed1c](https://github.com/atomist-skills/docker-base-image-policy/commit/b41ed1c9668066bd14bdd7308167aa896dc45901)

## [0.1.13](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.12...0.1.13) - 2021-03-31

### Added

*   Add comparison for env and ports. [31c4f76](https://github.com/atomist-skills/docker-base-image-policy/commit/31c4f7609381c70810da344036cf867939698a24)
*   Wrap changelog creation in error handler. [040e0f5](https://github.com/atomist-skills/docker-base-image-policy/commit/040e0f5f1c9dfdcc150c2772539383c2a5cf9e76)

## [0.1.12](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.11...0.1.12) - 2021-03-30

### Fixed

*   Make docker-registy optional. [6061cdb](https://github.com/atomist-skills/docker-base-image-policy/commit/6061cdba0ba5554cad2798102eda2615496a610e)

## [0.1.11](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.10...0.1.11) - 2021-03-30

### Added

*   Add commit details for private images. [2ad9ce0](https://github.com/atomist-skills/docker-base-image-policy/commit/2ad9ce0dc3740cf02fcf79aac45890a1c687c764)

## [0.1.10](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.9...0.1.10) - 2021-03-30

### Changed

*   Disable the linking check by default. [20a8c8d](https://github.com/atomist-skills/docker-base-image-policy/commit/20a8c8d664c29aef2418332ea092507871a5be4e)

## [0.1.9](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.8...0.1.9) - 2021-03-30

### Fixed

*   Fix issues in changelog template. [ce80932](https://github.com/atomist-skills/docker-base-image-policy/commit/ce80932826cdf123cade9fb527d296fe39d1231c)

## [0.1.8](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.7...0.1.8) - 2021-03-29

### Changed

*   Update to DevSecOps category. [3cfa236](https://github.com/atomist-skills/docker-base-image-policy/commit/3cfa2367a81c1e2502d49313c317461de588d6a3)

## [0.1.7](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.6...0.1.7) - 2021-03-27

### Fixed

*   Use platfrom to get image from manifest-list. [fee76da](https://github.com/atomist-skills/docker-base-image-policy/commit/fee76da3fc7b1355b9c9f29b91058d9eae3e95fd)

## [0.1.6](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.5...0.1.6) - 2021-03-26

### Added

*   Check to indicate successful linkage of image -> dockerfile -> commit. [#22](https://github.com/atomist-skills/docker-base-image-policy/issues/22)
*   Add changelog for Docker Hub images. [ab14574](https://github.com/atomist-skills/docker-base-image-policy/commit/ab1457496b40c5c42d61e613736021ad38e585ae)

## [0.1.5](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.4...0.1.5) - 2021-03-24

### Changed

*   Review skill overview page and parameter descriptions. [#12](https://github.com/atomist-skills/docker-base-image-policy/issues/12)
*   Update skill icon. [#40](https://github.com/atomist-skills/docker-base-image-policy/issues/40)
*   PR message. [#64](https://github.com/atomist-skills/docker-base-image-policy/issues/64)
*   Different verbage for pinning vs re-pinning PRs. [#61](https://github.com/atomist-skills/docker-base-image-policy/issues/61)

## [0.1.4](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.3...0.1.4) - 2021-03-18

### Changed

*   Set one check only. [a613260](https://github.com/atomist-skills/docker-base-image-policy/commit/a613260fcd5075a95e11c936e5df629c7abc1c62)

## [0.1.3](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.2...0.1.3) - 2021-03-16

### Changed

*   Required Docker Capabilities. [#37](https://github.com/atomist-skills/docker-base-image-policy/issues/37)
*   Configuration. [#41](https://github.com/atomist-skills/docker-base-image-policy/issues/41)

## [0.1.2](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.1...0.1.2) - 2021-03-15

### Added

*   Add badge to check. [3e17f35](https://github.com/atomist-skills/docker-base-image-policy/commit/3e17f35d408381a0e7f6f7dedad0433da5f069b9)

## [0.1.1](https://github.com/atomist-skills/docker-base-image-policy/compare/0.1.0...0.1.1) - 2021-03-12

### Added

*   Include tag that is being followed to pin check. [#21](https://github.com/atomist-skills/docker-base-image-policy/issues/21)

### Changed

*   Enable pinning pull requests by default. [c1fed2c](https://github.com/atomist-skills/docker-base-image-policy/commit/c1fed2cf559f4f16e1c384ccfb846ce7c67fa78c)

## [0.1.0](https://github.com/atomist-skills/docker-base-image-policy/tree/0.1.0) - 2021-03-11

### Added

*   Initial version. [c6a4078](https://github.com/atomist-skills/docker-base-image-policy/commit/c6a407887bbe3a22951c4fbdab4bc61ee8899e1d)
*   Add base image accept feature. [c71ac95](https://github.com/atomist-skills/docker-base-image-policy/commit/c71ac95524a205e8c5bea95266b66408a9d66e38)
*   Add Pinned vs Unpinned Github Check. [#8](https://github.com/atomist-skills/docker-base-image-policy/issues/8)
*   Support to pin multiple FROM instructions per Dockerfile. [#6](https://github.com/atomist-skills/docker-base-image-policy/issues/6)
*   Add configuration to preserve tag when pinning. [dcecf91](https://github.com/atomist-skills/docker-base-image-policy/commit/dcecf91a74ea67b346ae4f965f32e2b0c9ea611e)

### Changed

*   Pin to manifest-list digest if available. [#2](https://github.com/atomist-skills/docker-base-image-policy/issues/2)
*   Turn into container skill. [#7](https://github.com/atomist-skills/docker-base-image-policy/issues/7)
*   Validate all used base images against allow-list. [#15](https://github.com/atomist-skills/docker-base-image-policy/issues/15)
