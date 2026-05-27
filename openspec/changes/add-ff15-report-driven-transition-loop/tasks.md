## 1. Runtime transition contract

- [x] 1.1 Extend operation-definition parsing and canonical mission workflow metadata with the fields needed to validate report-driven transitions
- [x] 1.2 Update generated bridge scripts and runtime handlers to accept the `taskId` + `next` + `message` report contract

## 2. Report validation loop

- [x] 2.1 Validate incoming report task ids and next-step transitions against the active operation step before mutating mission state
- [x] 2.2 Preserve actionable mission failure state on invalid reports and update canonical workflow progress on valid reports

## 3. Verification

- [x] 3.1 Add focused tests for valid and invalid report-driven transitions in the runtime probe slice
- [x] 3.2 Run repository validation commands: `npm run lint`, `npm run test`, and `npm run compile`