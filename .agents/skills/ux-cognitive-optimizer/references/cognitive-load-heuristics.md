# Cognitive Load & Mental Effort Heuristics

This reference details the psychological principles, cognitive load theories, and practical UX heuristics required to minimize extraneous mental effort across digital products.

---

## 1. Cognitive Load Theory in Interface Design

According to John Sweller's Cognitive Load Theory (CLT), working memory has strictly limited capacity. User interfaces impose three types of cognitive load:

```text
Total Cognitive Load = Intrinsic Load + Extrinsic Load + Germane Load
```

| Load Type | Definition | Interface Impact | UX Goal |
| :--- | :--- | :--- | :--- |
| **Intrinsic Load** | Inherent difficulty of the user's actual task (e.g., configuring tax settings or analyzing financial data). | Cannot be eliminated without changing the core business domain. | **Structure & Simplify:** Break down complex domains into digestible steps. |
| **Extrinsic (Extraneous) Load** | Mental effort wasted by poor interface design, visual clutter, ambiguous navigation, or hunting for actions. | Caused entirely by poor UX/UI decisions (mental noise). | **ELIMINATE RUTHLESSLY:** Remove friction so working memory is not depleted on UI parsing. |
| **Germane Load** | Productive mental effort dedicated to processing information, learning patterns, and completing goals. | Enables users to build accurate mental models of the application. | **FOSTER & SUPPORT:** Use familiar conventions, consistent terminology, and intuitive mental models. |

---

## 2. Fundamental UX Laws for Cognitive Reduction

### A. Hick-Hyman Law
> *The time it takes to make a decision increases logarithmically with the number and complexity of choices.*

- **Actionable Heuristic:**
  - Cap primary choices in any single view to 3–5 items.
  - Group secondary actions into contextual dropdowns or menus.
  - In forms, provide high-confidence **smart defaults** to eliminate decision paralysis.

### B. Miller's Law & Chunking
> *The average human working memory can only hold 7 (± 2) discrete chunks of information at once.*

- **Actionable Heuristic:**
  - Break long lists or multi-field forms into semantic chunks of 3–5 related items (e.g., grouping phone numbers, addresses, payment details).
  - Use visual containers (cards, bordered sections, subtle background shifts) to group related chunks.

### C. Fitts's Law
> *The time required to rapidly move to a target area is a function of the ratio between the distance to the target and the width of the target.*

- **Actionable Heuristic:**
  - Place primary actions close to the natural cursor/finger focal trajectory.
  - Increase the clickable/tappable hit area for primary actions (minimum 44x44px on touch; clear padding on desktop).
  - Keep related controls in close spatial proximity.

### D. Jakob's Law of Internet User Experience
> *Users spend most of their time on other sites. They expect your site to work the same way as all the other sites they already know.*

- **Actionable Heuristic:**
  - Never reinvent standardized interaction paradigms (e.g., search icon at top right, shopping cart in header, standard form validation behaviors).
  - Novelty in visual layout increases extrinsic load; prioritize recognized conventions.

### E. Tesler's Law (Law of Conservation of Complexity)
> *Every system has an inherent amount of complexity that cannot be removed. It can only be shifted from the user to the software, or vice-versa.*

- **Actionable Heuristic:**
  - Absorb complexity in the software layer (e.g., auto-detecting card types, auto-formatting phone masks, pre-filling known user data).

---

## 3. Recognition Over Recall (Nielsen Heuristic #6)

Forcing users to remember information across screens or states drains cognitive capacity.

```text
[Bad Pattern: Recall Required]
Screen 1: User chooses Option "Pro Bundle A"
Screen 2: User must re-type features from Option "Pro Bundle A" to configure add-ons.

[Good Pattern: Recognition Guided]
Screen 1: User selects Option "Pro Bundle A".
Screen 2: Summary card of "Pro Bundle A" remains visible in sticky sidebar/header with features pre-selected.
```

### Key Mechanisms:
1. **Inline Field Guidance:** Use placeholder hints and persistent input labels (never rely solely on floating labels that disappear).
2. **Persistent Context Summary:** When undergoing multi-step checkouts or wizards, show a persistent summary of previous selections.
3. **Smart Defaults & Auto-Suggestions:** Suggest the most common choice as pre-selected when 80%+ of users pick that option.
4. **Recent History & Quick Filters:** Provide quick chips for recent searches or frequently used actions.

---

## 4. Cognitive Friction Taxonomy & Anti-Patterns

| Anti-Pattern | Root Cause | Cognitive Impact | Prescribed Solution |
| :--- | :--- | :--- | :--- |
| **Wall of Form Fields** | Unsegmented data entry. | Cognitive exhaustion, high bounce rate. | Convert to multi-step stepper or accordion with progressive disclosure. |
| **Competing CTAs** | Equal color saturation and size on multiple buttons. | Decision paralysis (Hick's Law). | Establish single Primary button (high contrast), Secondary (outline), Tertiary (ghost/text). |
| **Hidden Error States** | Errors listed only at the top of the page. | Working memory load; hunting for problematic inputs. | Inline validation with immediate status icon and clear remediation instructions next to the input. |
| **Disappearing Input Context** | Modal windows overlaying critical reference data. | Forces memorization of data behind the modal. | Replace blocking modal with slide-over drawer, side-by-side split pane, or inline expansion. |
