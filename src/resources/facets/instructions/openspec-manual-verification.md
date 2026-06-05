# Manual Verification Docs — Instructions

1. Create exactly one user-facing manual verification document at the mission-scoped output path defined by this step's output contract. Do not create duplicate copies in the app repository, execution workspace, or any reports directory.
2. Determine the verification scope from the implementation diff, `{{ output("spec-planning", "latest", "spec-plan.md") }}`, and any remaining findings in `{{ output("review", "latest", "code-review.md") }}`.
3. If a scaffold generator or helper exists in the target repository, you may use it. Otherwise write the document directly. In either case, the output contract is authoritative for the final structure.
4. Document concrete prerequisites first: startup steps, required data, roles or permissions, environment conditions, observable logs or screens, and any configuration values needed to run the checks.
5. For each checklist item, include all of the following: execution steps, expected result, observation point, and an `Evidence / notes` field. If the exact execution method is unknown, write `Maintainer input required:` and name the missing detail instead of inventing a partial procedure.
6. Cover at least three verification angles: one happy path, one edge or failure path, and one permission, notification, background-job, side-effect, or equivalent operational check.
7. Make every expected result observable and specific. Prefer runnable commands or exact navigation steps over vague instructions, especially for APIs, scripts, jobs, queues, notifications, or log-driven behavior.
8. Write the document body in `{{ setting("language", "name") }}` and summarize the generated file path, target scope, main scenarios, and any remaining open items after creation.