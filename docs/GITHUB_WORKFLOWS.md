# GitHub Actions Workflows

This document describes the GitHub Actions workflows for the Chat Bridge project.

## Important Note

Due to GitHub App permissions, workflow files cannot be pushed directly to `.github/workflows/`.
These workflows need to be manually created in the GitHub web interface or pushed with appropriate permissions.

## Workflow Files

The following workflow files are provided in `docs/github-workflows/`:

1. **laravel-tests.yml** - Laravel backend testing
2. **python-tests.yml** - Python backend testing
3. **frontend-tests.yml** - Frontend build and testing

## How to Add Workflows

### Option 1: Manual Creation via GitHub UI

1. Go to your repository on GitHub
2. Click on "Actions" tab
3. Click "New workflow"
4. Click "set up a workflow yourself"
5. Copy the content from the respective `.yml` file in `docs/github-workflows/`
6. Commit the workflow file

### Option 2: Push with Workflow Permissions

If you have admin access or appropriate GitHub App permissions:

```bash
# Copy workflows to .github/workflows
cp docs/github-workflows/*.yml .github/workflows/

# Commit and push
git add .github/workflows/
git commit -m "Add GitHub Actions workflows"
git push
```

## Workflows Overview

### 1. Laravel Tests (laravel-tests.yml)

**Triggers:**
- Push to `main`, `develop`, `claude/**` branches
- Pull requests to `main`, `develop`
- Only when files in `laravel-backend/` change

**Matrix:**
- PHP 8.1, 8.2, 8.3

**Steps:**
1. Checkout code
2. Setup PHP with required extensions
3. Cache Composer dependencies
4. Install dependencies
5. Setup environment (.env)
6. Generate application key
7. Run database migrations
8. Execute PHPUnit tests
9. Generate coverage report (PHP 8.2 only)
10. Upload coverage to Codecov

### 2. Python Tests (python-tests.yml)

**Triggers:**
- Push to `main`, `develop`, `claude/**` branches
- Pull requests to `main`, `develop`
- Only when files in `backend/` change

**Matrix:**
- Python 3.9, 3.10, 3.11

**Steps:**
1. Checkout code
2. Setup Python
3. Cache pip dependencies
4. Install dependencies
5. Run pytest tests
6. Generate coverage report (Python 3.10 only)
7. Upload coverage to Codecov

### 3. Frontend Tests (frontend-tests.yml)

**Triggers:**
- Push to `main`, `develop`, `claude/**` branches
- Pull requests to `main`, `develop`
- Only when files in `frontend/` change

**Matrix:**
- Node 18.x, 20.x

**Steps:**
1. Checkout code
2. Setup Node.js
3. Cache node modules
4. Install dependencies
5. Run linter (if configured)
6. Build application
7. Run tests (when implemented)

## Coverage Reporting

All workflows are configured to upload coverage reports to Codecov:

- **Laravel**: PHP 8.2 run uploads coverage
- **Python**: Python 3.10 run uploads coverage
- **Frontend**: When tests are implemented

### Setting up Codecov

1. Sign up at [codecov.io](https://codecov.io)
2. Add your repository
3. No additional configuration needed - the workflows handle uploads

## Monitoring

### Viewing Test Results

1. Go to your repository on GitHub
2. Click on "Actions" tab
3. Select a workflow run to see details
4. View logs for each step
5. See test results in the workflow summary

### Badges

Add status badges to your README.md:

```markdown
![Laravel Tests](https://github.com/meistro57/chat_bridge_WEB/workflows/Laravel%20Tests/badge.svg)
![Python Tests](https://github.com/meistro57/chat_bridge_WEB/workflows/Python%20Backend%20Tests/badge.svg)
![Frontend Tests](https://github.com/meistro57/chat_bridge_WEB/workflows/Frontend%20Tests/badge.svg)
```

## Troubleshooting

### Workflow Not Triggering

- Check if the workflow file is in `.github/workflows/`
- Verify the trigger paths match your changes
- Ensure the branch name matches the trigger configuration

### Tests Failing

- Check the workflow logs for error messages
- Verify dependencies are correctly installed
- Ensure environment variables are properly configured
- Test locally before pushing

### Permission Errors

If you see "refusing to allow a GitHub App to create or update workflow":

- You need to create the workflow via GitHub UI
- Or ensure your GitHub App has `workflows` permission
- Or push from a personal access token with workflow scope

## Local Testing

Before pushing, test the workflows locally:

### Laravel Tests
```bash
cd laravel-backend
composer install
php artisan test
```

### Python Tests
```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v
```

### Frontend Build
```bash
cd frontend
npm install
npm run build
```

## Customization

### Adding New Steps

Edit the workflow files in `docs/github-workflows/` and follow the "How to Add Workflows" section above.

### Changing Triggers

Modify the `on:` section in the workflow files:

```yaml
on:
  push:
    branches: [ main, develop ]
    paths:
      - 'your-path/**'
  pull_request:
    branches: [ main ]
```

### Adding Secrets

1. Go to repository Settings
2. Select "Secrets and variables" → "Actions"
3. Add new repository secrets
4. Reference in workflow: `${{ secrets.YOUR_SECRET }}`

## Best Practices

1. **Keep workflows fast** - Use caching for dependencies
2. **Fail fast** - Stop on first failure when appropriate
3. **Test coverage** - Aim for 80%+ coverage
4. **Status checks** - Make workflows required for PRs
5. **Notifications** - Configure Slack/email notifications for failures

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions)
- [Codecov Documentation](https://docs.codecov.com/)

---

**Created**: 2026-01-14
**Last Updated**: 2026-01-14
