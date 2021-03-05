## Before you get started

Connect and configure these integrations:

1.  [**GitHub**][github] _(required)_
2.  [**Slack**][slack] or [**Microsoft Teams**][msteams] _(optional)_

[github]: https://go.atomist.com/catalog/integration/github "GitHub Integration"
[slack]: https://go.atomist.com/catalog/integration/slack "Slack Integration"
[msteams]:
    https://go.atomist.com/catalog/integration/microsoft-teams
    "Microsoft Teams Integration"

## How to configure

1.  **Additional labels for pinning pull requests**

    Add labels that should be assigned to the pinning pull requests.

1.  **Assign reviewers to pinning pull requests**

    Select if this policy should assign the last committer on the repository as
    reviewer on pinning pull requests.

1.  **Determine repository scope**

    ![Repository filter](docs/images/repo-filter.png)

    By default, this policy will be enabled for all repositories in all
    organizations you have connected.

    To restrict the organizations or specific repositories on which the policy
    will apply to, you can explicitly choose organizations and repositories.

1.  **Activate the skill**

    Save your configuration and activate the skill by clicking the "Enable
    skill" button.
