# 2026 Best Practices for Agent Skills Engineering

This document outlines the state-of-the-art standards and architectural patterns for designing robust, token-efficient, and highly reliable AI agent skills in 2026.

---

## 1. The Principle of Progressive Disclosure

Large monolithic prompts degrade agent performance by saturating the context window with irrelevant data, causing reasoning drift and hallucination.

### Key Rules:
- **Tier 1 (Catalog View):** The agent only sees the `name` and `description` from the YAML frontmatter until the skill is activated.
- **Tier 2 (Core Workflow - `SKILL.md`):** Loaded upon activation. Contains the procedural skeleton, decision trees, required tool calls, and high-level workflows.
- **Tier 3 (Deep Knowledge - `references/`):** Detailed API schemas, comprehensive tables, and edge-case documentation accessed on-demand via file viewer tools.
- **Tier 4 (Execution Layer - `scripts/`):** Fragile, multi-step deterministic operations executed as sub-processes.

```text
[Catalog: Name + Description]
           │
     (Skill Triggered)
            ▼
     [SKILL.md: Core Workflow]
      ├──> [references/*.md] (Read on demand via relative links)
      ├──> [scripts/*] (Executed deterministically)
      └──> [templates/*] (Scaffolded into workspace)
```

---

## 2. Skill Portability & Relative File Linking

A well-architected skill must be **completely portable**—it should function identically whether installed locally in `.agents/skills/<skill>/` or globally in `~/.gemini/config/skills/<skill>/`, across Windows, macOS, or Linux.

### Rules for Linking:
- **Use Clean Relative Paths:** Always format links to internal documentation, templates, or references as relative paths from the skill root:
  - ✅ `[API Reference](references/api-guide.md)`
  - ✅ `[Starter Template](templates/starter.md)`
- **Prohibit Hardcoded Absolute Paths:**
  - ❌ `[API Reference](file:///e:/DevCoding/Projects/.../references/api-guide.md)` *(Fails on other machines/paths)*
  - ❌ `[API Reference](C:/Users/.../references/api-guide.md)` *(Breaks cross-platform portability)*

---

## 3. Deterministic Scripts vs. Model Reasoning

A common failure mode in agent skill design is forcing the LLM to perform mechanical data parsing, string validation, or regex matching via prompt instructions.

| Task Category | Optimal Execution Method | Reason |
| :--- | :--- | :--- |
| **Linting / Syntax Checks** | Python/Node Script in `scripts/` | 100% deterministic, zero hallucination, fast. |
| **Data Extraction / Schema Validation** | Deterministic Script with Pydantic/Zod | Exact error messages, reliable exit codes. |
| **Architectural Planning** | LLM Model Reasoning | High-level synthesis, trade-off evaluation. |
| **Code Refactoring & Logic** | LLM Model Reasoning | Contextual understanding, semantic adaptation. |
| **Link & File Existence Check** | Deterministic Script | Eliminates broken links with absolute precision. |

---

## 4. Avoiding "Laundry List" Prompts with Canonical Examples

Instead of accumulating a massive list of negative rules ("Do not do X, do not do Y, remember not to Z"), use **Canonical Examples** (few-shot patterns):
- Provide 1 or 2 gold-standard input/output pairs that demonstrate desired reasoning, formatting, and tool usage.
- Models generalize significantly better from structured examples than from dozens of repetitive prohibitions.

---

## 5. Trigger Optimization & Negative Triggers

To ensure the agent router triggers skills accurately:
- **Use 3rd-Person Phrasing:** The router evaluates whether the skill matches the current user intent. Phrase descriptions as `"Specialist in doing X. Activate when..."` rather than `"I will help you do X"`.
- **Include Negative Constraints:** Explicitly mention what the skill is *not* intended for (e.g., `"Do not use for raw SQL migrations; use db-specialist instead"`).
- **Target Keywords & Contextual Hooks:** Include natural terms users frequently use when requesting the capability.

---

## 6. Continuous Grounding via Web Search

Technologies, SDK versions, and framework idioms evolve rapidly. 
- Never assume knowledge cutoff dates or hardcoded API signatures are permanent.
- Skills must mandate web searches (`search_web`) before writing code or configuring infrastructure whenever external libraries or newer tooling are involved.

---

## 7. Token Budgeting & Context Density

- **Target Line Count:** Aim for `SKILL.md` to be under 350 lines.
- **Dense Formatting:** Use tables, bulleted checklists, and mermaid diagrams instead of verbose explanatory prose.
- **Offload Heavy Content:** If a reference table exceeds 40 lines, move it into `references/<topic>.md` and link it in `SKILL.md` via relative link.
