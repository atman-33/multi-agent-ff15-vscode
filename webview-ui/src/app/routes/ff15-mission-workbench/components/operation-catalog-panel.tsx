import { Input } from "@/components/ui/input";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { SearchIcon } from "lucide-react";
import {
	OPERATION_REQUIRED_MESSAGE,
	type MissionWorkbenchCatalogEntry,
} from "./shared";

interface SupportedOperationButtonProps {
	onSelect: (operationRef: string) => void;
	operation: MissionWorkbenchCatalogEntry;
	selected: boolean;
}

const SupportedOperationButton = ({
	onSelect,
	operation,
	selected,
}: SupportedOperationButtonProps) => (
	<button
		className={cn(
			"rounded-2xl border px-4 py-3 text-left transition-colors",
			selected
				? "border-[color:var(--vscode-button-background,#0e7490)] bg-[color:var(--vscode-button-background,#0e7490)]/12"
				: "border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_82%,transparent)] hover:bg-[color:var(--vscode-button-background,#0e7490)]/8"
		)}
		onClick={() => {
			onSelect(operation.ref);
		}}
		type="button"
	>
		<div className="flex items-start justify-between gap-3">
			<div className="min-w-0">
				<div className="truncate font-medium text-[color:var(--vscode-foreground)] text-sm">
					{operation.name}
				</div>
				<div className="mt-1 break-all text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.68))] text-xs leading-5">
					Ref: {operation.ref}
				</div>
			</div>
			{selected ? (
				<span className="rounded-full border border-emerald-500/30 bg-emerald-500/12 px-2 py-0.5 font-medium text-[10px] text-emerald-200 uppercase tracking-[0.12em]">
					Selected
				</span>
			) : null}
		</div>
	</button>
);

const UnsupportedOperationCard = ({
	operation,
}: {
	operation: MissionWorkbenchCatalogEntry;
}) => (
	<div className="rounded-2xl border border-[color:var(--vscode-errorForeground,#f87171)]/25 bg-[color:var(--vscode-errorForeground,#f87171)]/8 px-4 py-3">
		<div className="font-medium text-[color:var(--vscode-foreground)] text-sm">
			{operation.name}
		</div>
		<div className="mt-1 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.68))] text-xs leading-5">
			<div>Ref: {operation.ref}</div>
			<div>
				{operation.unavailableReason ??
					"Unavailable in the current roster or runtime scope."}
			</div>
		</div>
	</div>
);

interface OperationCatalogPanelProps {
	filteredSupportedOperations: MissionWorkbenchCatalogEntry[];
	filteredUnsupportedOperations: MissionWorkbenchCatalogEntry[];
	hasCatalogEntries: boolean;
	hasDeliverableOperation: boolean;
	hasOperationSearchResults: boolean;
	hasUnsupportedOperations: boolean;
	onOperationQueryChange: (value: string) => void;
	onSelectOperation: (operationRef: string) => void;
	operationQuery: string;
	selectedOperation: MissionWorkbenchCatalogEntry | null;
	selectedOperationRef: string | null;
	supportedOperationCount: number;
}

export const OperationCatalogPanel = ({
	filteredSupportedOperations,
	filteredUnsupportedOperations,
	hasCatalogEntries,
	hasDeliverableOperation,
	hasOperationSearchResults,
	hasUnsupportedOperations,
	onOperationQueryChange,
	onSelectOperation,
	operationQuery,
	selectedOperation,
	selectedOperationRef,
	supportedOperationCount,
}: OperationCatalogPanelProps) => (
	<div className="flex flex-col gap-4 rounded-3xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_74%,transparent)] px-5 py-4">
		<div className="flex flex-wrap items-start justify-between gap-3">
			<div>
				<div className="font-semibold text-[color:var(--vscode-foreground)] text-sm uppercase tracking-[0.18em]">
					Operations Catalog
				</div>
				<div className="mt-2 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] text-sm leading-6">
					Choose a supported operation before sending a prompt to Noctis. Search
					keeps large catalogs manageable and unsupported entries stay collapsed
					until needed.
				</div>
			</div>
			<span className="rounded-full border border-[color:color-mix(in_srgb,var(--vscode-foreground)_16%,transparent)] px-2.5 py-1 font-medium text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] uppercase tracking-[0.12em]">
				{supportedOperationCount} Selectable
			</span>
		</div>

		<div className="rounded-2xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_10%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_68%,transparent)] px-4 py-3">
			<div className="text-[10px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.68))] uppercase tracking-[0.14em]">
				Selected Operation
			</div>
			<div className="mt-2 flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="truncate font-medium text-[color:var(--vscode-foreground)] text-sm">
						{selectedOperation?.name ?? "Choose an operation below"}
					</div>
					<div className="mt-1 break-all text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.68))] text-xs leading-5">
						{selectedOperation?.ref ?? OPERATION_REQUIRED_MESSAGE}
					</div>
				</div>
				<span
					className={cn(
						"rounded-full border px-2 py-0.5 font-medium text-[10px] uppercase tracking-[0.12em]",
						hasDeliverableOperation
							? "border-emerald-500/30 bg-emerald-500/12 text-emerald-200"
							: "border-[color:var(--vscode-warningForeground,#fbbf24)]/35 bg-[color:var(--vscode-warningForeground,#fbbf24)]/12 text-[color:var(--vscode-warningForeground,#fbbf24)]"
					)}
				>
					{hasDeliverableOperation ? "Ready" : "Required"}
				</span>
			</div>
		</div>

		<div className="relative">
			<SearchIcon className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.5))]" />
			<Input
				aria-label="Search operations"
				className="border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_82%,transparent)] pl-9 text-[color:var(--vscode-foreground)]"
				onChange={(event) => {
					onOperationQueryChange(event.target.value);
				}}
				placeholder="Search operations by name, ref, or file"
				value={operationQuery}
			/>
		</div>

		{hasCatalogEntries ? (
			<div className="grid gap-3">
				{hasOperationSearchResults ? (
					<div className="max-h-[18rem] overflow-y-auto pr-1">
						<div className="grid gap-2">
							{filteredSupportedOperations.map((operation) => (
								<SupportedOperationButton
									key={operation.ref}
									onSelect={onSelectOperation}
									operation={operation}
									selected={selectedOperationRef === operation.ref}
								/>
							))}
						</div>
					</div>
				) : (
					<div className="rounded-2xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_14%,transparent)] border-dashed px-4 py-5 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.7))] text-sm leading-6">
						No operations match "{operationQuery.trim()}".
					</div>
				)}

				{hasUnsupportedOperations ? (
					<Accordion
						className="rounded-2xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_10%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_68%,transparent)] px-4"
						collapsible
						type="single"
					>
						<AccordionItem
							className="border-none"
							value="unsupported-operations"
						>
							<AccordionTrigger className="py-3 text-[11px] text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.72))] uppercase tracking-[0.16em] hover:no-underline">
								Unsupported Operations ({filteredUnsupportedOperations.length})
							</AccordionTrigger>
							<AccordionContent className="grid gap-2">
								{filteredUnsupportedOperations.length > 0 ? (
									filteredUnsupportedOperations.map((operation) => (
										<UnsupportedOperationCard
											key={operation.ref}
											operation={operation}
										/>
									))
								) : (
									<div className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.7))] text-sm leading-6">
										No unsupported entries match the current search.
									</div>
								)}
							</AccordionContent>
						</AccordionItem>
					</Accordion>
				) : null}
			</div>
		) : (
			<div className="rounded-2xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_14%,transparent)] border-dashed px-4 py-5 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.7))] text-sm leading-6">
				Bundled operations have not been materialized for this workspace yet.
			</div>
		)}
	</div>
);
