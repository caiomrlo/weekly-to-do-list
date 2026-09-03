# Frontmatter Specification & Trigger Optimization

The YAML frontmatter of a `SKILL.md` is the only information visible to the AI agent during the initial skill discovery and routing phase. Precision in its definition is critical to prevent routing failures.

---

## Frontmatter Schema

```yaml
---
name: <skill-slug>
description: <concise-3rd-person-summary-and-trigger-conditions>
---
```

### Field Definitions

| Field | Type | Required | Description | Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `name` | `string` | **Yes** | Unique identifier in kebab-case. | Lowercase letters, numbers, and hyphens only (`^[a-z0-9-]+$`). Max 40 characters. |
| `description` | `string` | **Yes** | Description used by the agent to decide when to activate the skill. | Written in 3rd person. Must include purpose, trigger keywords, positive triggers, and negative boundaries. Ideal length: 150–350 characters. |

---

## Writing High-Precision Descriptions

### 1. Phrasing Conventions
- **Correct (3rd Person):** `"Specialist in designing and auditing GraphQL schemas. Activate when the user asks to create or optimize GraphQL queries, mutations, or resolvers. Do not use for REST API design."`
- **Incorrect (1st/2nd Person):** `"I will help you build your GraphQL API whenever you need assistance."`

### 2. Anatomy of an Effective Description

```text
[Role / Specialty] + [Trigger Conditions / Scope] + [Negative Boundaries / Exceptions]
```

### Examples Comparison

#### Example A: Web Scraping Specialist
- ❌ **Poor:** `"Helps with web scraping and downloading data."` *(Too vague, triggers on simple HTTP curl requests).*
- ✅ **Optimized:** `"Specialist in extracting structured data from web pages using headless browsers, HTML parsers, and anti-detection patterns. Activate when the user needs web scrapers, crawler pipelines, or DOM extraction. Do not use for standard public REST API consumption."`

#### Example B: Tailwind CSS Designer
- ❌ **Poor:** `"Expert in CSS styling."` *(Overly broad, causes conflicts with vanilla CSS workflows).*
- ✅ **Optimized:** `"Expert in modern responsive UI design using Tailwind CSS utility classes and design tokens. Activate when the user requests Tailwind UI components, theme configurations, or styling refactors with Tailwind. Do not use when vanilla CSS or standard CSS modules are requested."`

---

## Testing Trigger Quality

Before finalizing the frontmatter, evaluate against these 3 verification questions:
1. *Would an agent activate this skill when asked a general question unrelated to the specific framework?* (If yes, tighten negative boundaries).
2. *Does the description contain the specific action verbs and domain keywords users frequently employ?* (If no, add domain keywords).
3. *Is the description concise enough to avoid consuming unnecessary routing context?* (Keep under 400 characters).
