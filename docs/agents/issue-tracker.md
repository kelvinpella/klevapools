# Issue Tracker

This repo tracks issues in **GitHub Issues** using the `gh` CLI.

## How to Create Issues

Use the `gh` CLI to create new tickets:

```bash
gh issue create --title "<clear title>" --body "<detailed description>"
```

Or use the web UI at https://github.com/kelvinpella/klevapools/issues

## Using Issues

Skills read from and write to the issue tracker to:
- Track feature requests and bugs
- Document work-in-progress
- Create tickets for code reviews

**Note:** Code reviews and pull requests are managed separately through the repo's PR workflow, not the issue tracker.

## Workflow Integration

When working on a new feature or bug fix:
1. Search existing issues for duplicates
2. If no duplicate exists, create a new issue
3. Reference the issue number in PRs for tracking
4. Skills will automatically read/write issues as part of their workflow
