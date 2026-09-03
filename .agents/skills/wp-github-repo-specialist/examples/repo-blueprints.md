# WordPress Plugin Repository Archetype Blueprints

Choose the blueprint that matches your plugin's complexity and requirements.

---

## Blueprint A: Lightweight / Single-Purpose Utility Plugin

**Use Case**: Simple admin tweak, contact button, tracking code injector, or custom post type registrar with no frontend build steps and no runtime 3rd-party dependencies.

### Directory Structure
```text
my-utility-plugin/
├── .github/
│   └── workflows/
│       └── ci.yml                      # Basic PHPCS & lint check
├── assets/
│   ├── css/frontend.css
│   └── js/frontend.js
├── .distignore
├── .editorconfig
├── .gitattributes
├── .gitignore
├── composer.json                       # Dev tooling only (WPCS)
├── phpcs.xml.dist
├── README.md
├── readme.txt
└── my-utility-plugin.php               # Main plugin file
```

### Minimal `composer.json` (Dev-Only)
```json
{
  "name": "developer/my-utility-plugin",
  "description": "Lightweight utility plugin for WordPress.",
  "type": "wordpress-plugin",
  "license": "GPL-2.0-or-later",
  "require-dev": {
    "dealerdirect/phpcodesniffer-composer-installer": "^1.0",
    "wp-coding-standards/wpcs": "^3.1",
    "phpcompatibility/phpcompatibility-wp": "^2.1"
  },
  "scripts": {
    "lint": "vendor/bin/phpcs"
  },
  "config": {
    "allow-plugins": {
      "dealerdirect/phpcodesniffer-composer-installer": true
    }
  }
}
```

---

## Blueprint B: Standard OOP PHP Plugin

**Use Case**: Full-featured plugin with multiple classes, options pages, custom REST API endpoints, hooks, and clean unit testing.

### Directory Structure
```text
standard-oop-plugin/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   ├── workflows/
│   │   ├── ci.yml                      # Matrix PHPCS, PHPStan, PHPUnit
│   │   └── deploy-wporg.yml            # 10up SVN deploy on tag
│   └── PULL_REQUEST_TEMPLATE.md
├── .wordpress-org/                     # Banner, icon, screenshots
├── assets/
│   ├── css/admin.css
│   └── js/admin.js
├── includes/ or src/                   # PSR-4 classes
│   ├── Admin/
│   │   └── SettingsPage.php
│   ├── Api/
│   │   └── RestEndpoints.php
│   ├── Plugin.php
│   └── Service.php
├── languages/
│   └── standard-oop-plugin.pot
├── tests/
│   ├── unit/
│   │   └── ServiceTest.php
│   └── bootstrap.php
├── .distignore
├── .editorconfig
├── .gitattributes
├── .gitignore
├── CHANGELOG.md
├── composer.json
├── phpcs.xml.dist
├── phpstan.neon.dist
├── phpunit.xml.dist
├── README.md
├── readme.txt
└── standard-oop-plugin.php
```

### Complete `composer.json`
```json
{
  "name": "author/standard-oop-plugin",
  "description": "Standard OOP WordPress plugin with PSR-4 autoloading and tests.",
  "type": "wordpress-plugin",
  "license": "GPL-2.0-or-later",
  "autoload": {
    "psr-4": {
      "StandardPlugin\\": "src/"
    }
  },
  "autoload-dev": {
    "psr-4": {
      "StandardPlugin\\Tests\\": "tests/"
    }
  },
  "require": {
    "php": ">=7.4"
  },
  "require-dev": {
    "brain/monkey": "^2.6",
    "dealerdirect/phpcodesniffer-composer-installer": "^1.0",
    "phpcompatibility/phpcompatibility-wp": "^2.1",
    "phpunit/phpunit": "^9.6",
    "szepeviktor/phpstan-wordpress": "^1.3",
    "wp-coding-standards/wpcs": "^3.1",
    "yoast/phpunit-polyfills": "^2.0"
  },
  "scripts": {
    "lint": "vendor/bin/phpcs",
    "lint:fix": "vendor/bin/phpcbf",
    "analyse": "vendor/bin/phpstan analyse",
    "test": "vendor/bin/phpunit"
  },
  "config": {
    "allow-plugins": {
      "dealerdirect/phpcodesniffer-composer-installer": true
    }
  }
}
```

---

## Blueprint C: Modern Gutenberg / Block Plugin (React + TypeScript)

**Use Case**: Custom Gutenberg blocks, full site editing (FSE) components, modern React UI admin dashboards using `@wordpress/scripts`.

### Directory Structure
```text
modern-block-plugin/
├── .github/
│   └── workflows/
│       ├── ci.yml                      # PHP + Node linting & tests
│       └── e2e.yml                     # Playwright tests on wp-env
├── build/                              # Compiled JS/CSS (ignored in git, created on build)
├── src/                                # Frontend Source (React/TS/SCSS)
│   ├── blocks/
│   │   └── custom-card/
│   │       ├── block.json
│   │       ├── edit.tsx
│   │       ├── index.ts
│   │       ├── render.php
│   │       ├── save.tsx
│   │       └── style.scss
│   └── index.ts
├── includes/                           # PHP Server-Side registration
│   └── BlockRegistrar.php
├── tests/
│   └── e2e/
│       └── block-insertion.spec.ts
├── .distignore
├── .editorconfig
├── .gitattributes
├── .gitignore
├── .wp-env.json                        # Local containerized environment
├── composer.json
├── package.json
├── phpcs.xml.dist
├── playwright.config.ts
├── README.md
├── readme.txt
└── modern-block-plugin.php
```

### Modern `package.json` (`@wordpress/scripts`)
```json
{
  "name": "modern-block-plugin",
  "version": "1.0.0",
  "description": "Modern Gutenberg block plugin with React and Playwright.",
  "scripts": {
    "build": "wp-scripts build",
    "start": "wp-scripts start",
    "lint:js": "wp-scripts lint-js",
    "lint:css": "wp-scripts lint-style",
    "lint:php": "composer run lint",
    "env": "wp-env",
    "test:e2e": "playwright test"
  },
  "devDependencies": {
    "@playwright/test": "^1.45.0",
    "@wordpress/e2e-test-utils-playwright": "^0.18.0",
    "@wordpress/env": "^10.4.0",
    "@wordpress/scripts": "^27.9.0"
  }
}
```

---

## Blueprint D: Enterprise Plugin with 3rd-Party Libs (Strauss Isolation)

**Use Case**: Integrates external payment gateways (Stripe SDK), HTTP clients (Guzzle), cloud storage SDKs (AWS S3), or database logging (Monolog) that must be safely isolated from any other plugins on the site.

### Key Directory Additions
```text
enterprise-plugin/
├── vendor-prefixed/                    # Generated by Strauss (Committed or built in CI)
│   ├── autoload.php                    # Prefixed autoloader
│   └── GuzzleHttp/
├── src/
│   ├── Http/
│   │   └── CustomApiClient.php         # Uses MyPlugin\Vendor\GuzzleHttp\Client
│   └── Plugin.php
├── composer.json                       # Configured with "extra": { "strauss": { ... } }
└── enterprise-plugin.php
```
