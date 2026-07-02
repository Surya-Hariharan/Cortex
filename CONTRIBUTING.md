# Contributing to Cortex

First off, thank you for considering contributing to Cortex. It's people like you that make Cortex such a great tool.

## Where do I go from here?

If you've noticed a bug or have a feature request, make sure to check our [Issues](https://github.com/yourname/cortex/issues) first to see if someone else has already created one. If not, go ahead and [create one](https://github.com/yourname/cortex/issues/new)!

## Fork & create a branch

If this is something you think you can fix, then fork Cortex and create a branch with a descriptive name.

A good branch name would be (where issue #325 is the ticket you're working on):

```sh
git checkout -b 325-add-dark-mode
```

## Get the test suite running

Make sure you're using Node.js version 18 or higher.
Run `npm install` and `npm run rebuild` to fetch all dependencies and configure the native modules.

```sh
npm test
```

## Implement your fix or feature

At this point, you're ready to make your changes. Feel free to ask for help; everyone is a beginner at first.

## Code Review Process

The core team looks at Pull Requests on a regular basis. We will give feedback and ask for changes, or we might accept the pull request right away. Once it is approved, it will be merged into the `main` branch.

## Community

Remember to follow our [Code of Conduct](./CODE_OF_CONDUCT.md). We want to maintain a respectful and inclusive environment for everyone.
