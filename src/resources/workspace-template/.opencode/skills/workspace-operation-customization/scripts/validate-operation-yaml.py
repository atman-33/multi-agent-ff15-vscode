#!/usr/bin/env python3

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Any

try:
	import yaml
except ImportError:
	print(
		"Unable to import PyYAML. Install it with `python -m pip install pyyaml` and retry.",
		file=sys.stderr,
	)
	sys.exit(1)


VALID_AGENTS = {"noctis", "ignis", "gladiolus", "prompto"}
TERMINAL_NEXT = {"ABORT", "COMPLETE"}
LEGACY_OPERATION_FIELDS = [
	"initial_movement",
	"movements",
	"max_movements",
	"handoff_mode",
]
CONTENT_SOURCE_KEYS = {"file", "inline"}
OUTPUT_CONTRACT_KEYS = {"report"}
OUTPUT_CONTRACT_REPORT_KEYS = {"name", "format"}
DELEGATION_KEYS = {
	"allowed_workers",
	"worker_job",
	"worker_instruction",
	"worker_skills",
	"worker_policies",
}
STEP_KEYS = {
	"name",
	"agent",
	"job",
	"instruction",
	"skills",
	"policies",
	"output_contracts",
	"delegation",
	"rules",
}
OPERATION_KEYS = {
	"name",
	"description",
	"initial_step",
	"jobs",
	"instructions",
	"skills",
	"policies",
	"steps",
}
RULE_KEYS = {"condition", "next"}
LEGACY_STEP_FIELD_MESSAGES = {
	"edit": 'contains removed field "edit".',
	"handoff_mode": 'contains removed field "handoff_mode".',
	"pass_previous_response": 'contains removed field "pass_previous_response".',
	"job_file": 'contains removed field "job_file". Use "job: { file: ... }" or "job: { inline: ... }" instead.',
	"instruction_file": 'contains removed field "instruction_file". Use "instruction: { file: ... }" or "instruction: { inline: ... }" instead.',
	"knowledge": 'contains removed field "knowledge". Use "skills:" with a list of file source objects instead.',
	"knowledge_files": 'contains removed field "knowledge_files". Use "skills:" with a list of file source objects instead.',
	"policy_files": 'contains removed field "policy_files". Use "policies:" with a list of source objects instead.',
}

OUTPUT_PLACEHOLDER_PATTERN = re.compile(
	r'\{\{\s*output\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)\s*\}\}'
)
SETTING_PLACEHOLDER_PATTERN = re.compile(
	r'\{\{\s*setting\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)\s*\}\}'
)
ROOT_PLACEHOLDER_PATTERN = re.compile(
	r'\{\{\s*root\(\s*"([^"]+)"\s*\)\s*\}\}'
)


def print_usage() -> None:
	print(
		"Usage: python .opencode/skills/workspace-operation-customization/scripts/validate-operation-yaml.py <file-or-directory> [...more-paths]"
	)


def to_display_path(file_path: Path) -> str:
	try:
		return file_path.relative_to(Path.cwd()).as_posix()
	except ValueError:
		return str(file_path)


def collect_yaml_files(input_paths: list[str]) -> list[Path]:
	files: set[Path] = set()

	for input_path in input_paths:
		resolved_path = (Path.cwd() / input_path).resolve()
		if not resolved_path.exists():
			raise ValueError(f"Path does not exist: {input_path}")

		if resolved_path.is_dir():
			for child in resolved_path.rglob("*"):
				if child.is_file() and is_yaml_file(child):
					files.add(child)
			continue

		if is_yaml_file(resolved_path):
			files.add(resolved_path)

	return sorted(files, key=lambda path: path.as_posix())


def is_yaml_file(file_path: Path) -> bool:
	return file_path.suffix.lower() in {".yaml", ".yml"}


def push_error(errors: list[str], message: str) -> None:
	errors.append(message)


def is_plain_object(value: Any) -> bool:
	return isinstance(value, dict)


def get_string(value: Any) -> str | None:
	if not isinstance(value, str):
		return None

	trimmed = value.strip()
	return trimmed or None


def validate_no_unexpected_keys(
	record: dict[str, Any],
	label: str,
	allowed_keys: set[str],
	guidance: str,
	errors: list[str],
) -> None:
	unexpected_keys = [str(key) for key in record if str(key) not in allowed_keys]
	if not unexpected_keys:
		return

	push_error(
		errors,
		f"{label} contains unexpected field(s): {', '.join(unexpected_keys)}. {guidance}",
	)


def collect_output_placeholders(content: str | None) -> list[tuple[str, str, str]]:
	if not isinstance(content, str) or "{{" not in content:
		return []

	return [match.groups() for match in OUTPUT_PLACEHOLDER_PATTERN.finditer(content)]


def validate_placeholder_syntax(content: str | None, label: str, errors: list[str]) -> None:
	if not isinstance(content, str) or "{{" not in content:
		return

	if "{{ output(" in content and not OUTPUT_PLACEHOLDER_PATTERN.search(content):
		push_error(
			errors,
			f'{label} contains invalid output placeholder syntax. Use {{ output("step", "selector", "file") }}.',
		)

	if "{{ setting(" in content:
		matches = list(SETTING_PLACEHOLDER_PATTERN.finditer(content))
		if not matches:
			push_error(
				errors,
				f'{label} contains invalid setting placeholder syntax. Use {{ setting("key", "mode") }}.',
			)

		for match in matches:
			key, mode = match.groups()
			if key != "language":
				push_error(errors, f'{label} contains unsupported setting placeholder key "{key}".')
			if mode != "name":
				push_error(
					errors,
					f'{label} contains unsupported setting placeholder mode "{mode}" for key "{key}".',
				)

	if "{{ root(" in content:
		matches = list(ROOT_PLACEHOLDER_PATTERN.finditer(content))
		if not matches:
			push_error(
				errors,
				f'{label} contains invalid root placeholder syntax. Use {{ root("scope") }}.',
			)

		for match in matches:
			scope = match.group(1)
			if scope not in {"app_root", "execution_root"}:
				push_error(errors, f'{label} contains unsupported root placeholder scope "{scope}".')


def validate_output_placeholders_in_content(
	content: str | None,
	label: str,
	declared_outputs_by_step: dict[str, set[str]],
	errors: list[str],
) -> None:
	validate_placeholder_syntax(content, label, errors)

	for step_name, selector, file_name in collect_output_placeholders(content):
		if step_name not in declared_outputs_by_step:
			push_error(
				errors,
				f'{label} references unknown output step "{step_name}" via output("{step_name}", "{selector}", "{file_name}").',
			)
			continue

		declared_files = declared_outputs_by_step.get(step_name, set())
		if file_name not in declared_files:
			push_error(
				errors,
				f'{label} references undeclared output file "{file_name}" for step "{step_name}". Declare it in output_contracts.report or fix the placeholder.',
			)


def validate_content_source(
	raw: Any,
	label: str,
	operation_directory: Path,
	errors: list[str],
) -> None:
	if raw is None:
		return

	if not is_plain_object(raw):
		push_error(errors, f'{label} must be an object with exactly one of "file" or "inline".')
		return

	validate_no_unexpected_keys(
		raw,
		label,
		CONTENT_SOURCE_KEYS,
		'Content sources support only "file" or "inline". Check indentation so sibling step fields are not nested inside the source object.',
		errors,
	)

	file_ref = get_string(raw.get("file"))
	inline_value = get_string(raw.get("inline"))
	has_file = file_ref is not None
	has_inline = inline_value is not None

	if has_file == has_inline:
		push_error(errors, f'{label} must define exactly one of "file" or "inline".')
		return

	if has_file and not (operation_directory / file_ref).resolve().exists():
		push_error(errors, f"{label} file source does not exist: {file_ref}")


def validate_content_source_list(
	raw: Any,
	label: str,
	operation_directory: Path,
	errors: list[str],
) -> None:
	if raw is None:
		return

	if not isinstance(raw, list):
		push_error(errors, f"{label} must be an array of source objects.")
		return

	for index, entry in enumerate(raw):
		validate_content_source(entry, f"{label}[{index}]", operation_directory, errors)


def validate_file_content_source(
	raw: Any,
	label: str,
	operation_directory: Path,
	errors: list[str],
) -> None:
	if raw is None:
		return

	if not is_plain_object(raw):
		push_error(errors, f'{label} must be an object with "file".')
		return

	validate_no_unexpected_keys(
		raw,
		label,
		{"file"},
		'File-only sources support only the "file" field.',
		errors,
	)

	file_ref = get_string(raw.get("file"))
	inline_value = get_string(raw.get("inline"))
	if file_ref is None or inline_value is not None:
		push_error(errors, f'{label} must define exactly one "file" source. Workflow skills are file-only.')
		return

	if not (operation_directory / file_ref).resolve().exists():
		push_error(errors, f"{label} file source does not exist: {file_ref}")


def validate_file_content_source_list(
	raw: Any,
	label: str,
	operation_directory: Path,
	errors: list[str],
) -> None:
	if raw is None:
		return

	if not isinstance(raw, list):
		push_error(errors, f"{label} must be an array of file source objects.")
		return

	for index, entry in enumerate(raw):
		validate_file_content_source(entry, f"{label}[{index}]", operation_directory, errors)


def validate_delegation(
	raw: Any,
	step_name: str,
	agent: str,
	operation_directory: Path,
	errors: list[str],
) -> bool:
	if raw is None:
		return False

	if not is_plain_object(raw):
		push_error(errors, f'Step "{step_name}" delegation must be an object.')
		return False

	validate_no_unexpected_keys(
		raw,
		f'Step "{step_name}" delegation',
		DELEGATION_KEYS,
		"Delegation supports only allowed_workers, worker_job, worker_instruction, worker_skills, and worker_policies.",
		errors,
	)

	if agent != "noctis":
		push_error(errors, f'Step "{step_name}" delegation is only allowed on noctis steps.')

	if "worker_knowledge" in raw:
		push_error(
			errors,
			f'Step "{step_name}" delegation contains removed field "worker_knowledge". Use "worker_skills:" with a list of file source objects instead.',
		)

	allowed_workers = raw.get("allowed_workers")
	if allowed_workers is not None:
		if not isinstance(allowed_workers, list):
			push_error(errors, f'Step "{step_name}" delegation.allowed_workers must be an array.')
		else:
			for index, worker in enumerate(allowed_workers):
				if not isinstance(worker, str) or worker not in VALID_AGENTS or worker == "noctis":
					push_error(
						errors,
						f'Step "{step_name}" delegation.allowed_workers[{index}] must be one of ignis, gladiolus, or prompto.',
					)

	validate_content_source(raw.get("worker_job"), f'Step "{step_name}" delegation.worker_job', operation_directory, errors)
	validate_content_source(
		raw.get("worker_instruction"),
		f'Step "{step_name}" delegation.worker_instruction',
		operation_directory,
		errors,
	)
	validate_file_content_source_list(
		raw.get("worker_skills"),
		f'Step "{step_name}" delegation.worker_skills',
		operation_directory,
		errors,
	)
	validate_content_source_list(
		raw.get("worker_policies"),
		f'Step "{step_name}" delegation.worker_policies',
		operation_directory,
		errors,
	)

	return True


def validate_output_contracts(
	raw: Any,
	step_name: str,
	operation_directory: Path,
	errors: list[str],
) -> None:
	if raw is None:
		return

	if not is_plain_object(raw):
		push_error(errors, f'Step "{step_name}" output_contracts must be an object.')
		return

	validate_no_unexpected_keys(
		raw,
		f'Step "{step_name}" output_contracts',
		OUTPUT_CONTRACT_KEYS,
		'Step output_contracts currently supports only the "report" field.',
		errors,
	)

	report = raw.get("report")
	if report is None:
		return

	if not isinstance(report, list):
		push_error(errors, f'Step "{step_name}" output_contracts.report must be an array.')
		return

	for index, entry in enumerate(report):
		if not is_plain_object(entry):
			push_error(errors, f'Step "{step_name}" output_contracts.report[{index}] must be an object.')
			continue

		if "format_file" in entry:
			push_error(
				errors,
				f'Step "{step_name}" output_contracts.report[{index}] contains removed field "format_file". Use "format: {{ file: ... }}" or "format: {{ inline: ... }}" instead.',
			)

		validate_no_unexpected_keys(
			entry,
			f'Step "{step_name}" output_contracts.report[{index}]',
			OUTPUT_CONTRACT_REPORT_KEYS,
			'Output contract report entries support only "name" and "format".',
			errors,
		)

		name = get_string(entry.get("name"))
		if name is None:
			push_error(errors, f'Step "{step_name}" output_contracts.report[{index}] must define "name".')

		validate_content_source(
			entry.get("format"),
			f'Step "{step_name}" output_contracts.report[{index}].format',
			operation_directory,
			errors,
		)


def validate_rules(
	raw: Any,
	step_name: str,
	has_delegation: bool,
	agent: str,
	errors: list[str],
) -> list[str]:
	if raw is None:
		if not (agent == "noctis" and has_delegation):
			push_error(
				errors,
				f'Step "{step_name}" may omit rules only for an explicit noctis-owned autonomous delegation step.',
			)
		return []

	if not isinstance(raw, list):
		push_error(errors, f'Step "{step_name}" rules must be an array.')
		return []

	targets: list[str] = []
	for index, rule in enumerate(raw):
		if not is_plain_object(rule):
			push_error(errors, f'Step "{step_name}" rules[{index}] must be an object.')
			continue

		validate_no_unexpected_keys(
			rule,
			f'Step "{step_name}" rules[{index}]',
			RULE_KEYS,
			'Rules support only "condition" and "next".',
			errors,
		)

		condition = get_string(rule.get("condition"))
		next_target = get_string(rule.get("next"))

		if condition is None:
			push_error(errors, f'Step "{step_name}" rules[{index}] must define a non-empty condition.')

		if next_target is None:
			push_error(errors, f'Step "{step_name}" rules[{index}] must define a non-empty next target.')
			continue

		targets.append(next_target)

	return targets


def get_declared_output_names(output_contracts: Any) -> set[str]:
	if not is_plain_object(output_contracts):
		return set()

	report = output_contracts.get("report")
	if not isinstance(report, list):
		return set()

	declared_names: set[str] = set()
	for entry in report:
		if not is_plain_object(entry):
			continue

		name = get_string(entry.get("name"))
		if name is not None:
			declared_names.add(name)

	return declared_names


def validate_operation_file(file_path: Path) -> list[str]:
	operation_directory = file_path.parent
	errors: list[str] = []

	try:
		raw = yaml.safe_load(file_path.read_text(encoding="utf-8"))
	except Exception as error:  # noqa: BLE001
		push_error(errors, f"YAML parse failed: {error}")
		return errors

	if not is_plain_object(raw):
		push_error(errors, "Operation file must parse to an object.")
		return errors

	for field in LEGACY_OPERATION_FIELDS:
		if field in raw:
			push_error(errors, f'Operation contains removed field "{field}".')

	validate_no_unexpected_keys(
		raw,
		"Operation schema",
		OPERATION_KEYS,
		'Operations support only name, description, initial_step, jobs, instructions, skills, policies, and steps.',
		errors,
	)

	initial_step = get_string(raw.get("initial_step"))
	if initial_step is None:
		push_error(errors, 'Operation must define a non-empty "initial_step".')

	steps = raw.get("steps")
	if not isinstance(steps, list):
		push_error(errors, 'Operation must define "steps" as an array.')
		return errors

	step_names: set[str] = set()
	step_agents: dict[str, str] = {}
	step_rule_targets: dict[str, list[str]] = {}
	declared_outputs_by_step: dict[str, set[str]] = {}

	for index, step in enumerate(steps):
		if not is_plain_object(step):
			push_error(errors, f"steps[{index}] must be an object.")
			continue

		step_name = get_string(step.get("name"))
		if step_name is None:
			push_error(errors, f"steps[{index}] must define a non-empty name.")
			continue

		if step_name in step_names:
			push_error(errors, f'Duplicate step name: "{step_name}".')
		step_names.add(step_name)

		agent = get_string(step.get("agent")) or ""
		if agent not in VALID_AGENTS:
			push_error(
				errors,
				f'Step "{step_name}" agent must be one of noctis, ignis, gladiolus, or prompto.',
			)
		step_agents[step_name] = agent

		for field, message in LEGACY_STEP_FIELD_MESSAGES.items():
			if field in step:
				push_error(errors, f'Step "{step_name}" {message}')

		validate_no_unexpected_keys(
			step,
			f'Step "{step_name}"',
			STEP_KEYS,
			'Steps support only name, agent, job, instruction, skills, policies, output_contracts, delegation, and rules.',
			errors,
		)

		validate_content_source(step.get("job"), f'Step "{step_name}" job', operation_directory, errors)
		validate_content_source(
			step.get("instruction"),
			f'Step "{step_name}" instruction',
			operation_directory,
			errors,
		)
		validate_file_content_source_list(
			step.get("skills"),
			f'Step "{step_name}" skills',
			operation_directory,
			errors,
		)
		validate_content_source_list(
			step.get("policies"),
			f'Step "{step_name}" policies',
			operation_directory,
			errors,
		)
		validate_output_contracts(
			step.get("output_contracts"),
			step_name,
			operation_directory,
			errors,
		)

		declared_outputs_by_step[step_name] = get_declared_output_names(step.get("output_contracts"))
		has_delegation = validate_delegation(
			step.get("delegation"),
			step_name,
			agent,
			operation_directory,
			errors,
		)
		step_rule_targets[step_name] = validate_rules(
			step.get("rules"),
			step_name,
			has_delegation,
			agent,
			errors,
		)

	if initial_step is not None:
		if initial_step not in step_names:
			push_error(errors, f'initial_step references an undefined step: "{initial_step}".')
		else:
			initial_agent = step_agents.get(initial_step)
			if initial_agent != "noctis":
				push_error(errors, f'initial_step "{initial_step}" must be owned by noctis.')

			for next_target in step_rule_targets.get(initial_step, []):
				if next_target in TERMINAL_NEXT:
					push_error(
						errors,
						f'initial_step "{initial_step}" must not route directly to {next_target}. Route through a named non-initial step instead.',
					)

	for step_name, targets in step_rule_targets.items():
		for next_target in targets:
			if next_target in TERMINAL_NEXT:
				continue

			if next_target not in step_names:
				push_error(errors, f'Step "{step_name}" routes to an undefined next target: "{next_target}".')

	for step in steps:
		if not is_plain_object(step):
			continue

		step_name = get_string(step.get("name"))
		if step_name is None:
			continue

		instruction = step.get("instruction")
		if not is_plain_object(instruction):
			continue

		inline_instruction = get_string(instruction.get("inline"))
		if inline_instruction is None:
			continue

		validate_output_placeholders_in_content(
			inline_instruction,
			f'Step "{step_name}" instruction.inline',
			declared_outputs_by_step,
			errors,
		)

	return errors


def main() -> None:
	args = sys.argv[1:]
	if not args:
		print_usage()
		sys.exit(1)

	if any(argument in {"-h", "--help"} for argument in args):
		print_usage()
		sys.exit(0)

	try:
		files = collect_yaml_files(args)
	except ValueError as error:
		print(error, file=sys.stderr)
		sys.exit(1)

	if not files:
		print("No YAML files found in the provided paths.", file=sys.stderr)
		sys.exit(1)

	has_errors = False
	for file_path in files:
		errors = validate_operation_file(file_path)
		if not errors:
			print(f"OK {to_display_path(file_path)}")
			continue

		has_errors = True
		print(f"ERROR {to_display_path(file_path)}", file=sys.stderr)
		for message in errors:
			print(f"  - {message}", file=sys.stderr)

	if has_errors:
		sys.exit(1)

	print(f"Validated {len(files)} operation YAML file(s).")


if __name__ == "__main__":
	main()