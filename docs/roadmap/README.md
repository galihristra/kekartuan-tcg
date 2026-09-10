# Roadmap docs

One file per initiative that's too big to describe in a bullet inside
[PLAN.md](../../PLAN.md). PLAN.md stays the index — the phase list, the
architecture decisions, and the "why we dropped X" record all live there, and
each phase links out to a doc here when it has one.

A doc in this directory covers a single piece of work: why it's being done, the
approach with concrete file paths, the trade-offs accepted, and how to verify it.
Write one when the work spans several files and the reasoning would otherwise be
lost in a PR description.

Keep the status line at the top current — `Planned`, `In progress`, `Done`, or
`Dropped`. A dropped doc stays here rather than being deleted: knowing what was
considered and rejected is the point (see Phase 4 in PLAN.md).

| Doc | Status |
| --- | --- |
| [Multi-admin live sync](./multi-admin-live-sync.md) | Planned |
