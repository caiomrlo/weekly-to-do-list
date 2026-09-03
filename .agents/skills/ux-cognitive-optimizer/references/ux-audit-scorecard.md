# UX Cognitive Friction & Hierarchy Audit Scorecard

Standardized scoring rubric and heuristic evaluation matrix used to audit existing interfaces and classify cognitive friction severity.

---

## 1. Friction Severity Classification Scale

When auditing an interface, categorize every identified issue into one of 4 severity levels:

| Severity Level | Name | Definition & Impact | Action Requirement |
| :---: | :--- | :--- | :--- |
| **S4** | **Critical Flow Blocker** | Prevents task completion or causes irreversible error / severe disorientation (e.g., destructive action with no confirmation, form fields reset on error, inaccessible primary CTA). | Immediate mandatory refactor; blocks release. |
| **S3** | **Major Cognitive Tax** | Imposes high extrinsic load or confusing hierarchy (e.g., competing primary CTAs, 15 unchunked fields, buried essential context, broken wayfinding). | High-priority optimization required. |
| **S2** | **Minor Friction / Hesitation** | Slight delay or ambiguity (e.g., inconsistent button styling, lack of smart defaults, weak secondary text contrast, missing hover states). | Recommended improvement in current cycle. |
| **S1** | **Cosmetic Inconsistency** | Minor aesthetic or polish issue with minimal impact on working memory (e.g., minor alignment difference, non-critical whitespace variance). | Polish as time permits. |

---

## 2. 12-Point Heuristic Inspection Matrix

Use this 12-point matrix to conduct structured heuristic audits across any digital screen:

```text
[ Visual Hierarchy ]
 1. 5-Second Focal Anchor: Is the primary focal point and CTA instantly obvious?
 2. Typographic Scannability: Are font sizes/weights disciplined with clear scannable headers?
 3. Contrast & Affordance: Do interactive elements clearly look clickable with strong contrast?
 4. Whitespace & Clutter: Is there sufficient breathing room, or is visual noise crowding the view?

[ Contextual Continuity ]
 5. Wayfinding & Spatial Anchor: Does the user know where they are (breadcrumbs/active tabs)?
 6. Progressive Disclosure: Are secondary/advanced options revealed on-demand rather than all at once?
 7. State & Progress Preservation: Are form drafts, filters, and step progress preserved across actions?
 8. Action Proximity (Fitts's Law): Are contextual actions positioned close to their subject items?

[ Extrinsic Cognitive Load ]
 9. Recognition Over Recall: Is needed context visible without forcing memory recall?
10. Choice Minimization (Hick's Law): Are options chunked into 3–5 items per section?
11. Smart Defaults & Auto-Assist: Does the interface pre-fill or guide standard choices?
12. Error Prevention & Inline Feedback: Are errors communicated inline with immediate remediation cues?
```

---

## 3. Cognitive Health Scoring Formula

To calculate the overall Cognitive Health Score of a screen or workflow:

```text
Score Calculation:
Total Points Available = 12 (1 point per passed heuristic)
Friction Penalties:
  - S4 issue: -3 points
  - S3 issue: -2 points
  - S2 issue: -1 point
  - S1 issue: -0.5 points

Final Health Rating:
  10.0 - 12.0 : Grade A (Frictionless / High Clarity)
   7.5 - 9.5  : Grade B (Moderate Friction / Needs Hierarchy Polish)
   5.0 - 7.0  : Grade C (High Cognitive Load / Redesign Recommended)
   < 5.0      : Grade F (Severe Cognitive Overload / Critical Flow Rework Required)
```
