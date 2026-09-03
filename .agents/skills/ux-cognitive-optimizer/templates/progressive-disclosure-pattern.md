# Progressive Disclosure & Hierarchy Layout Patterns

This document provides boilerplate structural patterns (HTML, CSS tokens, and component architecture) to build low-friction interfaces.

---

## 1. Contextual Stepper Pattern (Linear Form Chunking)

Break dense multi-field forms into sequential, focus-driven steps with contextual state persistence.

```html
<!-- Stepper Container -->
<div class="stepper-wrapper">
  <!-- Wayfinding Header -->
  <nav class="stepper-nav" aria-label="Checkout Progress">
    <ol class="stepper-list">
      <li class="step-item is-complete">
        <span class="step-badge">✓</span>
        <span class="step-label">Account</span>
      </li>
      <li class="step-item is-active" aria-current="step">
        <span class="step-badge">2</span>
        <span class="step-label">Shipping & Tax</span>
      </li>
      <li class="step-item is-upcoming">
        <span class="step-badge">3</span>
        <span class="step-label">Payment</span>
      </li>
    </ol>
  </nav>

  <!-- Focused Active Step Content -->
  <section class="step-content">
    <header class="step-header">
      <h2 class="step-title">Shipping & Destination</h2>
      <p class="step-subtitle">Select or confirm your delivery address.</p>
    </header>

    <!-- Form fields chunked in 3-4 items -->
    <form class="step-form">
      <div class="form-group">
        <label for="address" class="form-label">Street Address</label>
        <input type="text" id="address" class="form-input" placeholder="e.g. 123 Innovation Way" autocomplete="street-address" required />
        <span class="field-hint">Auto-detection active based on postal code</span>
      </div>

      <!-- Action Footer with clear Von Restorff primary CTA -->
      <footer class="step-actions">
        <button type="button" class="btn btn-secondary">Back to Account</button>
        <button type="submit" class="btn btn-primary">Proceed to Payment →</button>
      </footer>
    </form>
  </section>
</div>
```

---

## 2. Split-Pane / Contextual Slide-Over Drawer

Allows deep inspection/editing without losing background data table orientation.

```html
<div class="data-view-layout">
  <!-- Main Surface: Primary List/Table -->
  <main class="primary-surface">
    <div class="table-header">
      <h1 class="page-title">Active Projects</h1>
      <span class="badge badge-neutral">24 Total</span>
    </div>
    
    <!-- Table items with contextual click trigger -->
    <table class="data-table">
      <thead>
        <tr>
          <th>Project Name</th>
          <th>Owner</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr class="table-row is-selected" tabindex="0" role="button" aria-expanded="true">
          <td class="font-medium">Design System Refactor</td>
          <td>Sarah Connor</td>
          <td><span class="status-pill status-in-progress">In Progress</span></td>
          <td><button class="btn-ghost">View Details</button></td>
        </tr>
      </tbody>
    </table>
  </main>

  <!-- Contextual Slide-Over Sheet (Preserves background context) -->
  <aside class="detail-drawer" aria-label="Project Details Panel">
    <div class="drawer-header">
      <div>
        <span class="drawer-pretitle">Project Details</span>
        <h2 class="drawer-title">Design System Refactor</h2>
      </div>
      <button class="btn-close" aria-label="Close panel">✕</button>
    </div>

    <div class="drawer-body">
      <!-- Chunked metadata -->
      <div class="meta-group">
        <label class="meta-label">Assigned Lead</label>
        <div class="meta-value">Sarah Connor (sarah@company.io)</div>
      </div>
      
      <!-- Collapsible advanced settings (Progressive Disclosure) -->
      <details class="accordion-group">
        <summary class="accordion-trigger">Advanced Configuration</summary>
        <div class="accordion-content">
          <div class="form-group">
            <label for="webhook" class="form-label">Deployment Webhook URL</label>
            <input type="url" id="webhook" class="form-input" value="https://api.internal/hooks/ds-44" />
          </div>
        </div>
      </details>
    </div>

    <div class="drawer-footer">
      <button class="btn btn-secondary">Cancel</button>
      <button class="btn btn-primary">Save Changes</button>
    </div>
  </aside>
</div>
```

---

## 3. High-Clarity CSS Visual Hierarchy Tokens

```css
:root {
  /* Typographic Hierarchy Scale (1.25x Major Third) */
  --font-display: 1.75rem;   /* 28px - Display / Major Anchor */
  --font-h1: 1.375rem;       /* 22px - Section Titles */
  --font-h2: 1.125rem;       /* 18px - Card / Group Headers */
  --font-body: 0.9375rem;    /* 15px - Body / Input Text */
  --font-meta: 0.8125rem;    /* 13px - Secondary Labels / Badges */

  /* Spacing Scale (8pt Grid System) */
  --space-tight: 0.5rem;     /* 8px  - Related Items (Label to Input) */
  --space-medium: 1rem;      /* 16px - Component Insets */
  --space-loose: 1.5rem;     /* 24px - Inter-card / Section Gap */
  --space-section: 2.5rem;   /* 40px - Major Layout Separation */

  /* Contrast & Affordance Roles */
  --surface-primary: #FFFFFF;
  --surface-subtle: #F8FAFC;
  --border-subtle: #E2E8F0;
  
  --text-primary: #0F172A;   /* Contrast > 12:1 */
  --text-secondary: #475569; /* Contrast > 5.5:1 */
  --text-muted: #64748B;     /* Contrast > 4.5:1 */

  /* CTA Dominance (Von Restorff) */
  --cta-primary-bg: #2563EB;
  --cta-primary-fg: #FFFFFF;
  --cta-secondary-border: #CBD5E1;
}
```
