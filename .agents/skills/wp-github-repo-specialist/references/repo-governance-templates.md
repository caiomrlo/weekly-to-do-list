# Repository Governance, Templates & Distribution Files

This reference provides standard configuration files for repository hygiene, line endings, WordPress.org packaging (`.distignore`), developer vs directory documentation (`README.md` vs `readme.txt`), and structured GitHub collaboration templates.

---

## 1. Distribution Ignore (`.distignore`)

Defines which files must **NEVER** be committed to the WordPress.org SVN repository or included in end-user release `.zip` files:

```text
# Git & GitHub Configuration
.git/
.github/
.gitignore
.gitattributes
.distignore

# Development Tools & Configurations
.editorconfig
.wp-env.json
.eslintrc*
.stylelintrc*
.prettierrc*
phpcs.xml*
phpstan.neon*
phpunit.xml*
playwright.config.*
webpack.config.*
tsconfig.json

# Composer & Node Dev Artifacts
composer.json
composer.lock
package.json
package-lock.json
vendor/
node_modules/

# Test Suites & Fixtures
tests/
phpunit/
coverage/

# Documentation & Source Files
README.md
CONTRIBUTING.md
CODEOWNERS
src/
assets/src/

# IDE & OS Artifacts
.idea/
.vscode/
*.swp
.DS_Store
Thumbs.db
```

---

## 2. Git Attributes (`.gitattributes`)

Ensures line endings are standardized across operating systems (crucial for Windows vs Linux contributors) and marks development files with `export-ignore`:

```gitattributes
# Auto detect text files and normalize line endings to LF in Git
* text=auto eol=lf

# Explicit binary files
*.png binary
*.jpg binary
*.jpeg binary
*.gif binary
*.ico binary
*.svg text
*.woff binary
*.woff2 binary
*.ttf binary
*.eot binary

# Files to exclude from `git archive` release bundles
.gitattributes export-ignore
.gitignore export-ignore
.distignore export-ignore
.github export-ignore
.editorconfig export-ignore
phpcs.xml.dist export-ignore
phpstan.neon.dist export-ignore
phpunit.xml.dist export-ignore
.wp-env.json export-ignore
tests export-ignore
```

---

## 3. EditorConfig (`.editorconfig`)

Enforces WordPress Core spacing and indentation standards (Tabs for PHP, Spaces for web config files):

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.php]
indent_style = tab
indent_size = 4

[*.{js,jsx,ts,tsx,css,scss}]
indent_style = tab
indent_size = 4

[*.{json,yml,yaml,md}]
indent_style = space
indent_size = 2

[Makefile]
indent_style = tab
```

---

## 4. Documentation Strategy: `README.md` vs `readme.txt`

A modern WordPress plugin repository maintains two separate documentation files with distinct roles:

### A. `readme.txt` (For WordPress.org Plugin Directory Parser)
Must follow the strict [WordPress.org Plugin Standard](https://developer.wordpress.org/plugins/wordpress-org/how-your-readme-txt-works/):

```text
=== Plugin Name ===
Contributors: yourwporgusername
Donate link: https://example.com/donate
Tags: tag1, tag2, cta, contact
Requires at least: 6.0
Tested up to: 6.6
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Short description of plugin (150 chars max).

== Description ==

Full description of the plugin using standard markdown.

== Installation ==

1. Upload the plugin folder to the `/wp-content/plugins/` directory.
2. Activate the plugin through the 'Plugins' menu in WordPress.

== Frequently Asked Questions ==

= How do I configure the button? =
Navigate to Settings > Plugin Name.

== Changelog ==

= 1.0.0 =
* Initial release.
```

### B. `README.md` (For GitHub Developers & Contributors)
Focuses on developer onboarding, build instructions, CI badges, and architecture:

```markdown
# Plugin Name

[![CI & Code Quality](https://github.com/username/plugin-repo/actions/workflows/ci.yml/badge.svg)](https://github.com/username/plugin-repo/actions/workflows/ci.yml)
[![PHP Version](https://img.shields.io/badge/PHP-7.4%20--%208.3-blue.svg)](https://www.php.net/)
[![License: GPL v2](https://img.shields.io/badge/License-GPL%20v2-blue.svg)](LICENSE)

Brief developer-focused description of the plugin.

## 🚀 Getting Started (Development)

### Prerequisites
* PHP >= 7.4
* Composer >= 2.0
* Node.js >= 20 & npm (if editing frontend assets)
* Docker (for `wp-env`)

### Setup
```bash
git clone https://github.com/username/plugin-repo.git
cd plugin-repo
composer install
npm install
npm run build
```

## 🧪 Testing & Linting
```bash
# Run WordPress Coding Standards check
composer run lint:php

# Run PHPStan static analysis
composer run analyse

# Run Unit Tests
composer run test:unit
```
```

---

## 5. GitHub Issue & PR Templates

### Bug Report Form (`.github/ISSUE_TEMPLATE/bug_report.yml`)

```yaml
name: 🐛 Bug Report
description: Report a reproducible problem or unexpected behavior.
labels: ["bug", "needs-triage"]
body:
  - type: markdown
    attributes:
      value: Thanks for taking the time to report this issue!
  - type: textarea
    id: description
    attributes:
      label: Bug Description
      description: A clear and concise description of the issue.
    validations:
      required: true
  - type: input
    id: wp_version
    attributes:
      label: WordPress Version
      placeholder: "e.g., 6.6.1"
    validations:
      required: true
  - type: input
    id: php_version
    attributes:
      label: PHP Version
      placeholder: "e.g., 8.2"
    validations:
      required: true
  - type: textarea
    id: steps_to_reproduce
    attributes:
      label: Steps to Reproduce
      description: Step-by-step instructions to reproduce the behavior.
      placeholder: "1. Go to...\n2. Click on...\n3. See error"
    validations:
      required: true
```

### Pull Request Template (`.github/PULL_REQUEST_TEMPLATE.md`)

```markdown
## 📝 Summary of Changes
Provide a brief summary of the changes introduced in this PR.

## 🔍 Type of Change
- [ ] 🐛 Bug fix (non-breaking change fixing an issue)
- [ ] ✨ New feature (non-breaking change adding functionality)
- [ ] 💥 Breaking change (fix or feature causing existing functionality to change)
- [ ] 🧹 Refactoring / Code Quality (no functional changes)
- [ ] 📚 Documentation update

## ✅ Quality Checklist
- [ ] My code adheres to WordPress Coding Standards (WPCS).
- [ ] I have run `composer run lint:php` and fixed all warnings/errors.
- [ ] I have run `composer run analyse` (PHPStan) without errors.
- [ ] All new and existing tests pass (`composer run test`).
- [ ] Strict output escaping (`esc_html`, `esc_attr`, `esc_url`) and input sanitization are applied.
- [ ] Nonces and capability checks (`current_user_can`) are verified on all actions.
- [ ] Internationalization text domain is present on all user-facing strings.
```
