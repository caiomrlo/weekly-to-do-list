# Dependency Isolation & Vendor Prefixing with Strauss

In WordPress, all active plugins share a single global PHP runtime namespace. If Plugin A loads `GuzzleHttp v7` and Plugin B loads `GuzzleHttp v6`, the plugin loaded first wins, and the second plugin frequently crashes with fatal errors.

To distribute third-party Composer packages safely, plugins must **prefix** dependencies (renaming namespaces and class maps) into a private vendor folder.

---

## 1. Why Strauss?

[Strauss](https://github.com/BrianHenryIE/strauss) (by Brian Henry) is the modern, zero-fuss alternative to Imposter and PHP-Scoper tailored specifically for WordPress plugins.

*   Rewrites namespaces (e.g., `GuzzleHttp\` $\rightarrow$ `MyPlugin\Vendor\GuzzleHttp\`).
*   Prefixes global class names and constants.
*   Outputs a clean, self-contained `vendor-prefixed/` directory with its own autoloader.
*   Integrates seamlessly with Composer lifecycle hooks.

---

## 2. Setting Up Strauss in `composer.json`

### Step 1: Install Strauss as a Dev Dependency
```bash
composer require --dev brianhenryie/strauss
```

### Step 2: Configure `composer.json`

```json
{
  "name": "vendor/my-plugin",
  "type": "wordpress-plugin",
  "require": {
    "php": ">=7.4",
    "guzzlehttp/guzzle": "^7.8"
  },
  "require-dev": {
    "brianhenryie/strauss": "^0.17.0",
    "szepeviktor/phpstan-wordpress": "^1.3",
    "dealerdirect/phpcodesniffer-composer-installer": "^1.0",
    "wp-coding-standards/wpcs": "^3.1"
  },
  "autoload": {
    "psr-4": {
      "MyPlugin\\": "src/"
    },
    "files": [
      "vendor-prefixed/autoload.php"
    ]
  },
  "extra": {
    "strauss": {
      "target_directory": "vendor-prefixed",
      "namespace_prefix": "MyPlugin\\Vendor\\",
      "classmap_prefix": "MyPlugin_Vendor_",
      "delete_vendor_packages": true
    }
  },
  "scripts": {
    "strauss": [
      "vendor/bin/strauss"
    ],
    "post-install-cmd": [
      "@strauss"
    ],
    "post-update-cmd": [
      "@strauss"
    ]
  }
}
```

---

## 3. Loading Prefixed Dependencies in Code

Once Strauss runs, import classes using the prefixed namespace:

```php
<?php
namespace MyPlugin\Services;

// Use the isolated prefixed namespace
use MyPlugin\Vendor\GuzzleHttp\Client;

class ApiClient {
    private Client $client;

    public function __construct() {
        $this->client = new Client([
            'base_uri' => 'https://api.example.com',
            'timeout'  => 5.0,
        ]);
    }

    public function fetch_data(): array {
        $response = $this->client->get( '/endpoint' );
        return json_decode( (string) $response->getBody(), true );
    }
}
```

---

## 4. Git & Distribution Strategy for Prefixed Dependencies

| Location | Status | Rationale |
| :--- | :--- | :--- |
| **`.gitignore`** | **Ignore `vendor/`**, but **Commit `vendor-prefixed/`** (or generate it during CI release) | Allows users installing via Git/Zip to run immediately without needing Composer, while keeping un-prefixed duplicates out. |
| **`.distignore`** | **NEVER ignore `vendor-prefixed/`** | The prefixed code must be deployed to WordPress.org SVN for end users. |
| **`phpcs.xml.dist`** | **Exclude `vendor-prefixed/`** | Do not lint third-party vendor code against WPCS. |
| **`phpstan.neon.dist`** | **Exclude `vendor-prefixed/`** | Analyze only your plugin source code in `src/`. |
