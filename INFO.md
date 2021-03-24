If you're checking in Dockerfiles with tags, you've got a problem. This means
that every time you build you could get a new base image and you cannot look at
the Dockerfile and know which version was used in your last build.

By using the Docker Base Image Policy, you'll consistently pin the `FROM` lines
in Dockerfiles to the latest digests for those tags, monitor Docker Hub for
updates, and raise pull requests if the tags are updated to point to new images
when published. Use this policy to help advance your Docker security posture.

-   Operations teams never lose track of what version of software is actually
    running in clusters
-   Development teams always know which version of a base image ends up being
    consumed, tested, and delivered
-   Security teams achieve up-to-day image scanning to know so they always know
    the security status of an image

# Pin `FROM` lines in Dockerfiles to the latest digests

![Docker base image pinning pull request](docs/images/pinning-pull-request.png)

Read our
[how-to tutorial](https://go.atomist.com/catalog/skills/atomist/docker-base-image-policy/settings)
to learn more about the configuration parameters.
