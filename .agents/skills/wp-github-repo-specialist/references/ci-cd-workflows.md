# GitHub Actions CI/CD Workflows for WordPress Plugins

This guide contains production-grade GitHub Actions workflows for continuous integration, WordPress.org SVN deployment, GitHub Release automation, and automated dependency governance.

---

## 1. Continuous Integration Matrix (`.github/workflows/ci.yml`)

This workflow runs on every `push` to main branches and every `pull_request`. It enforces:
*   PHP Coding Standards (WPCS via PHPCS)
*   Static Analysis (PHPStan with `phpstan-wordpress`)
*   Matrix PHPUnit tests across PHP 7.4 through 8.3
*   Frontend linting (ESLint / Stylelint via `@wordpress/scripts` if applicable)

```yaml
name: CI & Code Quality

on:
  push:
    branches: [ main, master, develop ]
  pull_request:
    branches: [ main, master, develop ]

# Cancel in-progress runs on new pushes to the same PR
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # -------------------------------------------------------------
  # 1. PHP Code Sniffer (WPCS)
  # -------------------------------------------------------------
  phpcs:
    name: PHPCS (WordPress Standards)
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.2'
          coverage: none
          tools: composer:v2

      - name: Get Composer Cache Directory
        id: composer-cache
        run: echo "dir=$(composer config cache-files-dir)" >> $GITHUB_OUTPUT

      - name: Cache Composer Dependencies
        uses: actions/cache@v4
        with:
          path: ${{ steps.composer-cache.outputs.dir }}
          key: ${{ runner.os }}-composer-${{ hashFiles('**/composer.lock') }}
          restore-keys: ${{ runner.os }}-composer-

      - name: Install Dependencies
        run: composer install --prefer-dist --no-progress

      - name: Run PHPCS
        run: vendor/bin/phpcs -q --report=checkstyle | cs2pr || vendor/bin/phpcs

  # -------------------------------------------------------------
  # 2. Static Analysis (PHPStan)
  # -------------------------------------------------------------
  phpstan:
    name: PHPStan Static Analysis
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.2'
          coverage: none
          tools: composer:v2

      - name: Install Dependencies
        run: composer install --prefer-dist --no-progress

      - name: Run PHPStan
        run: vendor/bin/phpstan analyse --error-format=github

  # -------------------------------------------------------------
  # 3. PHPUnit Test Matrix (Unit & Integration)
  # -------------------------------------------------------------
  phpunit:
    name: PHPUnit (PHP ${{ matrix.php-version }})
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        php-version: ['7.4', '8.0', '8.1', '8.2', '8.3']
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: ${{ matrix.php-version }}
          coverage: none
          tools: composer:v2

      - name: Install Dependencies
        run: composer install --prefer-dist --no-progress

      - name: Run Unit Tests
        run: vendor/bin/phpunit --testsuite unit

  # -------------------------------------------------------------
  # 4. Frontend Linting & Build (Optional - if package.json exists)
  # -------------------------------------------------------------
  frontend:
    name: Frontend Lint & Build
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Check package.json existence
        id: check-package
        run: |
          if [ -f "package.json" ]; then
            echo "has_package=true" >> $GITHUB_OUTPUT
          else
            echo "has_package=false" >> $GITHUB_OUTPUT
          fi

      - name: Setup Node.js
        if: steps.check-package.outputs.has_package == 'true'
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install NPM Dependencies
        if: steps.check-package.outputs.has_package == 'true'
        run: npm ci

      - name: Run JS/CSS Lint
        if: steps.check-package.outputs.has_package == 'true'
        run: npm run lint --if-present

      - name: Verify Clean Build
        if: steps.check-package.outputs.has_package == 'true'
        run: npm run build --if-present
```

---

## 2. WordPress.org SVN Deployment (`.github/workflows/deploy-wporg.yml`)

Uses the industry standard `10up/action-wordpress-plugin-deploy`. Automatically runs when a version tag (`v*.*.*`) is pushed.

```yaml
name: Deploy to WordPress.org

on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+*'

jobs:
  deploy:
    name: Deploy to SVN
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Tag
        uses: actions/checkout@v4

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.2'
          tools: composer:v2

      - name: Setup Node.js (If Build Needed)
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Build Production Assets (If package.json exists)
        run: |
          if [ -f "package.json" ]; then
            npm ci
            npm run build
          fi

      - name: Install Production Composer Dependencies (No Dev)
        run: |
          if [ -f "composer.json" ]; then
            composer install --no-dev --prefer-dist --optimize-autoloader --no-progress
          fi

      - name: Deploy to WordPress.org Plugin Repository
        uses: 10up/action-wordpress-plugin-deploy@stable
        env:
          SVN_USERNAME: ${{ secrets.SVN_USERNAME }}
          SVN_PASSWORD: ${{ secrets.SVN_PASSWORD }}
          # Path to the directory containing assets for the plugin page (banner, icon, screenshots)
          ASSETS_DIR: .wordpress-org
```

> [!IMPORTANT]
> **Required Secrets**: Add `SVN_USERNAME` and `SVN_PASSWORD` in your GitHub Repository under **Settings > Secrets and variables > Actions**.
> Ensure your `.distignore` file exists to exclude `.git`, `tests/`, `node_modules/`, `composer.json`, etc., from the SVN commit.

---

## 3. GitHub Release with Clean Zip Artifact (`.github/workflows/release-gh.yml`)

Builds a production-ready `.zip` archive (excluding development tooling and dev-dependencies) and attaches it to a new GitHub Release.

```yaml
name: Create GitHub Release

on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+*'

permissions:
  contents: write

jobs:
  release:
    name: Build & Publish Release
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Extract Slug and Version
        id: vars
        run: |
          TAG="${{ github.ref_name }}"
          VERSION="${TAG#v}"
          REPO_NAME="${{ github.event.repository.name }}"
          echo "version=$VERSION" >> $GITHUB_OUTPUT
          echo "slug=$REPO_NAME" >> $GITHUB_OUTPUT

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.2'
          tools: composer:v2

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Build Frontend (If applicable)
        run: |
          if [ -f "package.json" ]; then
            npm ci
            npm run build
          fi

      - name: Install Production PHP Dependencies
        run: |
          if [ -f "composer.json" ]; then
            composer install --no-dev --prefer-dist --optimize-autoloader --no-progress
          fi

      - name: Prepare Clean Distribution Directory
        run: |
          mkdir -p build_dist/${{ steps.vars.outputs.slug }}
          # Rsync files respecting .distignore
          rsync -rc --exclude-from='.distignore' ./ build_dist/${{ steps.vars.outputs.slug }}/
          cd build_dist
          zip -r ../${{ steps.vars.outputs.slug }}-${{ steps.vars.outputs.version }}.zip ${{ steps.vars.outputs.slug }}
          cd ..

      - name: Publish GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: ${{ steps.vars.outputs.slug }}-${{ steps.vars.outputs.version }}.zip
          generate_release_notes: true
          draft: false
          prerelease: false
```

---

## 4. Dependabot Configuration (`.github/dependabot.yml`)

Automates security and version updates for Composer, npm, and GitHub Actions, grouped into weekly PRs to prevent notification fatigue.

```yaml
version: 2
updates:
  # GitHub Actions Workflows
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      actions:
        patterns:
          - "*"

  # PHP Composer Dependencies
  - package-ecosystem: "composer"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      php-dev-tools:
        dependency-type: "development"
        patterns:
          - "*"
      php-runtime:
        dependency-type: "production"
        patterns:
          - "*"

  # Node / NPM Dependencies (if applicable)
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      npm-dependencies:
        patterns:
          - "*"
```
