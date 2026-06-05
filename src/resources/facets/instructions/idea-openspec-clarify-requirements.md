# Clarify Requirements — Instructions

1. Investigate the codebase first. If a question can be answered from the existing code, docs, tests, or surrounding patterns, answer it yourself instead of asking User.
2. When clarification is still needed, ask one focused question at a time. Walk down each unresolved branch of the design tree until the implementation scope is stable enough to create coherent OpenSpec artifacts.
3. For each important unresolved choice, provide your recommended answer or the default you would use if User does not override it. Keep the conversation moving toward a specification, not a brainstorm with loose ends.
4. Keep questions limited to what is necessary to create the OpenSpec artifacts. Avoid reopening decisions that are already settled or asking for information that downstream investigation can resolve.
5. The artifact produced in this step becomes fixed input for downstream steps. At a minimum, record the following in `change-brief.md`, and write its body in the language specified by User or in `{{ setting("language", "name") }}` if none is specified.
   - `Change Key`: a stable kebab-case key that uniquely identifies this request. Downstream steps use it as the seed for the OpenSpec change name and feature branch, and it must stay stable across reruns for the same request.
   - Problem, success criteria, constraints, in-scope items, and out-of-scope items.
   - The language explicitly requested by User. If none is specified, default to `{{ setting("language", "name") }}`.
6. Once the specification is solid enough that the next step can create the OpenSpec artifacts without more interviews, output the artifact. End as cancelled only if User wants to stop at this stage.