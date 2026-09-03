# Code Quality & Testing Configurations

This reference provides production-ready configuration files for WordPress Coding Standards (PHPCS), Static Analysis (PHPStan), Automated Unit/Integration Testing (PHPUnit with Yoast Polyfills & Brain Monkey), and End-to-End Browser Testing (Playwright + `@wordpress/env`).

---

## 1. WordPress Coding Standards (`phpcs.xml.dist`)

Configure PHP CodeSniffer with WPCS and PHP compatibility checks:

```xml
<?xml version="1.0"?>
<ruleset name="WordPress Plugin Coding Standards">
    <description>Sniffs for WordPress plugins complying with WPCS and PHP 7.4+.</description>

    <!-- Scan only PHP files -->
    <arg name="extensions" value="php"/>
    
    <!-- Show progress and sniff codes in output -->
    <arg value="ps"/>
    <arg name="colors"/>

    <!-- Target directories to scan -->
    <file>./src</file>
    <file>./includes</file>
    <file>./tests</file>
    <!-- Include main plugin entry file (adjust name as needed) -->
    <!-- <file>./plugin-slug.php</file> -->

    <!-- Exclude third-party and build directories -->
    <exclude-pattern>*/vendor/*</exclude-pattern>
    <exclude-pattern>*/vendor-prefixed/*</exclude-pattern>
    <exclude-pattern>*/node_modules/*</exclude-pattern>
    <exclude-pattern>*/build/*</exclude-pattern>
    <exclude-pattern>*/dist/*</exclude-pattern>
    <exclude-pattern>*/.wordpress-org/*</exclude-pattern>

    <!-- PHP Compatibility check for PHP 7.4 up to 8.3 -->
    <config name="testVersion" value="7.4-8.3"/>
    <rule ref="PHPCompatibilityWP"/>

    <!-- WordPress Core Standards & Best Practices -->
    <rule ref="WordPress-Core">
        <!-- Optional: Allow short array syntax [] -->
        <exclude name="Generic.Arrays.DisallowShortArraySyntax"/>
    </rule>
    <rule ref="WordPress-Extra"/>
    <rule ref="WordPress-Docs"/>

    <!-- Set minimum supported WordPress version -->
    <config name="minimum_supported_wp_version" value="6.0"/>

    <!-- Text domain verification -->
    <rule ref="WordPress.WP.I18n">
        <properties>
            <property name="text_domain" type="array">
                <element value="your-plugin-slug"/>
            </property>
        </properties>
    </rule>

    <!-- Naming prefix rule for global functions, classes, and hooks -->
    <rule ref="WordPress.NamingConventions.PrefixAllGlobals">
        <properties>
            <property name="prefixes" type="array">
                <element value="YourPlugin"/>
                <element value="your_plugin"/>
                <element value="YOUR_PLUGIN"/>
            </property>
        </properties>
    </rule>
</ruleset>
```

---

## 2. Static Analysis (`phpstan.neon.dist`)

Configured with `szepeviktor/phpstan-wordpress` to understand WordPress global constants, hook signatures, and core return types:

```neon
includes:
    - vendor/szepeviktor/phpstan-wordpress/extension.neon

parameters:
    level: 6
    paths:
        - src/
        - includes/
        - plugin-slug.php
    excludePaths:
        - vendor/
        - vendor-prefixed/
        - node_modules/
        - tests/
    scanFiles:
        # Load WordPress core stubs or constants if necessary
    dynamicConstantNames:
        - WP_DEBUG
        - WP_DEBUG_LOG
        - WP_DEBUG_DISPLAY
        - SCRIPT_DEBUG
        - WP_ENVIRONMENT_TYPE
        - ABSPATH
    checkMissingIterableValueType: false
    checkGenericClassInNonGenericObjectType: false
    ignoreErrors:
        # Common WordPress pattern where functions are conditionally defined
        - '#Function [a-zA-Z0-9_]+ not found.#'
```

### Pro-Tip: Managing Legacy Code with PHPStan Baseline
For existing plugins with legacy warnings, generate a baseline without lowering the strictness level:
```bash
vendor/bin/phpstan analyse --generate-baseline
```
Then add `includes: [ phpstan-baseline.neon ]` in `phpstan.neon.dist`.

---

## 3. Unit & Integration Testing (`phpunit.xml.dist`)

Separates tests into pure Unit tests (fast, mock-based using Brain Monkey) and Integration tests (WordPress environment aware):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<phpunit
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:noNamespaceSchemaLocation="https://schema.phpunit.de/9.6/phpunit.xsd"
    bootstrap="tests/bootstrap.php"
    backupGlobals="false"
    colors="true"
    beStrictAboutTestsThatDoNotTestAnything="true"
    beStrictAboutOutputDuringTests="true"
    convertErrorsToExceptions="true"
    convertNoticesToExceptions="true"
    convertWarningsToExceptions="true"
    verbose="true">

    <testsuites>
        <testsuite name="unit">
            <directory suffix="Test.php">./tests/unit</directory>
        </testsuite>
        <testsuite name="integration">
            <directory suffix="Test.php">./tests/integration</directory>
        </testsuite>
    </testsuites>

    <coverage processUncoveredFiles="true">
        <include>
            <directory suffix=".php">./src</directory>
            <directory suffix=".php">./includes</directory>
            <file>./plugin-slug.php</file>
        </include>
        <exclude>
            <directory>./vendor</directory>
            <directory>./vendor-prefixed</directory>
            <directory>./tests</directory>
        </exclude>
    </coverage>
</phpunit>
```

### Unit Test Bootstrap with Brain Monkey (`tests/bootstrap.php`)

```php
<?php
/**
 * PHPUnit Test Bootstrap.
 */

// Autoload Composer dependencies.
require_once dirname( __DIR__ ) . '/vendor/autoload.php';

// Load Yoast PHPUnit Polyfills for cross-PHP/PHPUnit version compatibility.
require_once dirname( __DIR__ ) . '/vendor/yoast/phpunit-polyfills/phpunitpolyfills-autoload.php';

// Define essential WordPress constants if not already present.
if ( ! defined( 'ABSPATH' ) ) {
    define( 'ABSPATH', '/tmp/wordpress/' );
}
if ( ! defined( 'MINUTE_IN_SECONDS' ) ) {
    define( 'MINUTE_IN_SECONDS', 60 );
    define( 'HOUR_IN_SECONDS', 3600 );
    define( 'DAY_IN_SECONDS', 86400 );
}
```

### Example Unit Test (`tests/unit/ExampleServiceTest.php`)

```php
<?php
namespace YourPlugin\Tests\Unit;

use Brain\Monkey;
use Brain\Monkey\Functions;
use Yoast\PHPUnitPolyfills\TestCases\TestCase;

class ExampleServiceTest extends TestCase {

    protected function set_up(): void {
        parent::set_up();
        Monkey\setUp();
    }

    protected function tear_down(): void {
        Monkey\tearDown();
        parent::tear_down();
    }

    public function test_sanitizes_custom_field(): void {
        Functions\expect( 'sanitize_text_field' )
            ->once()
            ->with( '<b>test</b>' )
            ->andReturn( 'test' );

        $result = sanitize_text_field( '<b>test</b>' );
        $this->assertSame( 'test', $result );
    }
}
```

---

## 4. Local Environment & Playwright E2E (`.wp-env.json` & `playwright.config.ts`)

### Containerized Environment (`.wp-env.json`)

```json
{
  "core": "WordPress/WordPress#latest",
  "plugins": [
    "."
  ],
  "config": {
    "WP_DEBUG": true,
    "WP_DEBUG_LOG": true,
    "SCRIPT_DEBUG": true
  },
  "port": 8888
}
```

### Playwright E2E Configuration (`playwright.config.ts`)

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000
  },
  fullyParallel: false,
  workers: 1, // Keep sequential for WordPress DB state stability
  use: {
    baseURL: process.env.WP_BASE_URL || 'http://localhost:8888',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```
