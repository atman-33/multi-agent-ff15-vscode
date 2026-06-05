# Draft PRD — Instructions

1. Read `{{ output("clarify-requirements", "latest", "requirements-brief.md") }}` and treat all settled points there as the source of truth without asking again.
2. In this step, draft `prd-draft.md` only; do not publish or update the GitHub issue yet.
3. Explore the repository enough to verify the current state of the codebase and to pressure-test the proposed solution. If critical design branches are still unresolved, ask focused follow-up questions one at a time before finalizing the draft.
4. Sketch the major modules, interfaces, or system boundaries that will need to be built or modified. Look for opportunities to deepen shallow modules and to hide complexity behind stable public interfaces. If key module or testing-target assumptions remain uncertain, call them out explicitly before moving on.
5. Write the body of `prd-draft.md`, along with the GitHub issue title and body it contains, in the language specified by User, or in `{{ setting("language", "name") }}` if no explicit language was requested.
6. Include both the GitHub issue title and a complete GitHub issue body in `prd-draft.md`. The issue body must contain these sections in order: `Problem Statement`, `Solution`, `User Stories`, `Implementation Decisions`, `Testing Decisions`, `Out of Scope`, and `Further Notes`.
7. At the start of `## GitHub Issue Body`, include the HTML comment `<!-- prd-key: <same PRD Key> -->` so downstream steps can identify an existing parent issue again.
8. Make the `User Stories` list extensive enough to cover the important user-visible and operational aspects of the feature. Keep implementation and testing decisions concrete enough to guide downstream work, but do not include specific file paths or code snippets.