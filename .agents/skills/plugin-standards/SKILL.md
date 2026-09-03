---
name: wordpress-plugin-standards
description: Review and correct WordPress plugin code for security, naming uniqueness, database preparation, caching, and coding standards (WPCS). Resolves nonces, SQL preparation, input sanitization, global prefixing, and direct queries.
risk: low
source: local
---

# WordPress Plugin Security and Standards Review

Ensure WordPress plugin code complies with security practices, database guidelines, and global namespace uniqueness standards.

Use this skill to audit, write, or fix code for WordPress plugins to prevent common security vulnerabilities and standard violations.

## Scope and Errors Addressed

This skill targets the following specific WordPress Coding Standards (WPCS) errors and security vulnerabilities:

1. **`WordPress.Security.ValidatedSanitizedInput.InputNotSanitized`** (Unsanitized Input)
2. **`WordPress.Security.NonceVerification.Missing`** (Missing Nonce Verification)
3. **`WordPress.DB.PreparedSQL.InterpolatedNotPrepared`** (Unprepared SQL Queries)
4. **`WordPress.DB.DirectDatabaseQuery.DirectQuery`** (Discouraged Direct DB Calls)
5. **`WordPress.DB.DirectDatabaseQuery.NoCaching`** (Uncached Database Queries)
6. **`WordPress.DB.DirectDatabaseQuery.SchemaChange`** (Unsafe Schema Changes)
7. **`WordPress.NamingConventions.PrefixAllGlobals`** & Unique Naming (Prefixing Variables/Functions/Classes)

---

## Detailed Rules & Fixes

### 1. Input Sanitization (`WordPress.Security.ValidatedSanitizedInput.InputNotSanitized`)

*   **Rule**: All user inputs (`$_POST`, `$_GET`, `$_REQUEST`, `$_SERVER`, etc.) must be sanitized before usage or assignment.
*   **Best Practices**:
    *   Use `sanitize_text_field()` for plain text.
    *   Use `sanitize_textarea_field()` for multi-line inputs.
    *   Use `absint()` or `intval()` for integers.
    *   Use `sanitize_email()` for emails.
    *   Use `esc_url_raw()` for URLs.
    *   Use `sanitize_key()` for keys/slugs.

#### Example:
*   ❌ **Incorrect**:
    ```php
    $username = $_POST['username'];
    update_user_meta( $user_id, 'nickname', $username );
    ```
*   ✅ **Correct**:
    ```php
    $username = isset( $_POST['username'] ) ? sanitize_text_field( wp_unslash( $_POST['username'] ) ) : '';
    update_user_meta( $user_id, 'nickname', $username );
    ```

---

### 2. Nonce Verification (`WordPress.Security.NonceVerification.Missing`)

*   **Rule**: Any POST/GET action that modifies data, changes settings, or performs operations must verify a security nonce.
*   **Best Practices**:
    *   For form submissions: Use `check_admin_referer( 'action_name', 'nonce_name' )`.
    *   For AJAX requests: Use `check_ajax_referer( 'action_name', 'nonce_name' )`.
    *   For custom processing check: Use `wp_verify_nonce( $_POST['nonce_name'], 'action_name' )`.

#### Example:
*   ❌ **Incorrect**:
    ```php
    if ( isset( $_POST['save_settings'] ) ) {
        update_option( 'my_plugin_option', sanitize_text_field( $_POST['some_option'] ) );
    }
    ```
*   ✅ **Correct**:
    ```php
    if ( isset( $_POST['save_settings'] ) ) {
        if ( ! isset( $_POST['my_plugin_nonce_field'] ) || ! wp_verify_nonce( $_POST['my_plugin_nonce_field'], 'save_my_plugin_settings' ) ) {
            wp_die( esc_html__( 'Security check failed.', 'my-plugin' ) );
        }
        update_option( 'my_plugin_option', sanitize_text_field( wp_unslash( $_POST['some_option'] ) ) );
    }
    ```

---

### 3. Prepared SQL Queries (`WordPress.DB.PreparedSQL.InterpolatedNotPrepared`)

*   **Rule**: Never interpolate variables (like `$id` or `$status`) directly into SQL query strings.
*   **Best Practices**:
    *   Use `$wpdb->prepare()` to format queries before execution.
    *   Use placeholders: `%d` (integer), `%f` (float), `%s` (string), `%h` (like wildcard - rarely used, prefer escaping manually).

#### Example:
*   ❌ **Incorrect**:
    ```php
    global $wpdb;
    $results = $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}my_table WHERE status = '$status' AND id = $id" );
    ```
*   ✅ **Correct**:
    ```php
    global $wpdb;
    $query = $wpdb->prepare(
        "SELECT * FROM {$wpdb->prefix}my_table WHERE status = %s AND id = %d",
        $status,
        $id
    );
    $results = $wpdb->get_results( $query );
    ```

---

### 4. Direct Database Queries & Caching (`WordPress.DB.DirectDatabaseQuery`)

*   **Rule**: Avoid direct `$wpdb` calls if standard WordPress functions exist (e.g. `get_posts()`, `wp_insert_post()`, `get_post_meta()`). If direct queries are necessary, cache the results.
*   **Best Practices**:
    *   Use transients (`set_transient()`, `get_transient()`) or Object Cache (`wp_cache_set()`, `wp_cache_get()`) to cache custom query outputs.
    *   Flush caches when the underlying data is updated/deleted.

#### Example (Caching Custom DB Query):
*   ❌ **Incorrect**:
    ```php
    global $wpdb;
    $my_data = $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}custom_table LIMIT 10" );
    ```
*   ✅ **Correct**:
    ```php
    global $wpdb;
    $cache_key = 'my_plugin_custom_data_limit_10';
    $my_data   = wp_cache_get( $cache_key, 'my_plugin_group' );

    if ( false === $my_data ) {
        $my_data = $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}custom_table LIMIT 10" );
        wp_cache_set( $cache_key, $my_data, 'my_plugin_group', HOUR_IN_SECONDS );
    }
    ```

---

### 5. Unsafe Schema Changes (`WordPress.DB.DirectDatabaseQuery.SchemaChange`)

*   **Rule**: Never run manual `CREATE TABLE`, `ALTER TABLE`, or similar schema modifying statements directly via `$wpdb->query()`.
*   **Best Practices**:
    *   Include `wp-admin/includes/upgrade.php`.
    *   Use `dbDelta()` to safely create/upgrade schemas.

#### Example:
*   ❌ **Incorrect**:
    ```php
    global $wpdb;
    $wpdb->query( "CREATE TABLE {$wpdb->prefix}my_table ( id int NOT NULL )" );
    ```
*   ✅ **Correct**:
    ```php
    global $wpdb;
    $table_name = $wpdb->prefix . 'my_table';
    $charset_collate = $wpdb->get_charset_collate();

    $sql = "CREATE TABLE $table_name (
        id mediumint(9) NOT NULL AUTO_INCREMENT,
        name varchar(50) NOT NULL,
        PRIMARY KEY  (id)
    ) $charset_collate;";

    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta( $sql );
    ```

---

### 6. Naming Conventions & Unique Prefixing (`WordPress.NamingConventions.PrefixAllGlobals`)

*   **Rule**: All global elements (functions, variables, constants, classes, and option keys) must be uniquely prefixed to prevent conflicts.
*   **Strategy**:
    1. Identify the prefix of the plugin. If not predefined, define a clean, unique prefix (e.g. `my_plugin_slug_` or namespace `MyPluginSlug\`).
    2. Prefix all top-level functions (or wrap in a class/namespace).
    3. Prefix all global variables.
    4. Prefix all custom constants.
    5. Prefix option names used in `get_option()` / `update_option()`.

#### Example:
*   ❌ **Incorrect**:
    ```php
    define( 'VERSION', '1.0.0' );
    function init_plugin() { ... }
    $current_settings = [];
    ```
*   ✅ **Correct**:
    ```php
    define( 'MY_PLUGIN_SLUG_VERSION', '1.0.0' );
    function my_plugin_slug_init_plugin() { ... }
    global $my_plugin_slug_settings;
    ```

---

## Audit Checklist for the Agent

When reviewing files, perform the following validation steps:

- [ ] Check every instance of `$_POST`, `$_GET`, `$_REQUEST`, `$_SERVER` to verify it is sanitized using a proper WordPress sanitization function.
- [ ] Ensure that before any data-altering operation, there is a nonce validation block (`check_admin_referer`, `check_ajax_referer`, or `wp_verify_nonce`).
- [ ] Check every `$wpdb` direct query. Is it using `$wpdb->prepare`? Does it have caching wrapper functions?
- [ ] Search for raw `CREATE TABLE` or `ALTER TABLE` statements and ensure `dbDelta` is being used.
- [ ] Find all declared functions, global variables, and constants. Ensure they have a unique prefix matching the plugin's namespace or identifier.

## When to Use
Use this skill whenever you are:
- Creating a new WordPress plugin.
- Updating, refactoring, or reviewing an existing WordPress plugin.
- Fixing security bugs or PHPCS warning/error reports in WordPress php files.

## Limitations
- This skill applies specifically to WordPress plugin files (`.php`). It does not replace full automated scanner checks like PHP_CodeSniffer with WPCS rules, but serves as a solid pre-commit or code-authoring guide.
