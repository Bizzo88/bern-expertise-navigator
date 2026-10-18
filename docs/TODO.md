# Demo priorities — issue #1

Tracking: https://github.com/Bizzo88/bern-expertise-navigator/issues/1

Implementation: Bizzo88. Review, validation and merge decisions: Prachi Kedar.
Priorities and component ownership still need Prachi's confirmation. Work in
small PRs; the entire backlog is not required for the first demo.

## P0 — interface and core demo workflow

- [x] First typography and spacing pass with local system fonts and responsive controls.
- [x] Search company requests by company, needs, location or specialty.
- [x] Show a recoverable loading failure instead of an apparently empty lead list.
- [x] Announce pitch generation, preserve the previous output on failure and allow retry.
- [x] Restore partner-search controls after failure without losing the query.
- [x] Localize new UI messages in English, German and French.
- [ ] Obtain the official organization logo, approved fonts, colors and branding guidelines.
- [ ] Apply official branding once assets are provided.
- [ ] Visually validate desktop/mobile layouts, dark mode, contrast and keyboard navigation.
- [ ] Agree on representative fictional leads/documents and rehearse the complete demo.

## P1 — administration and Knowledge Base

- [ ] Agree on company/lead resource schema and API ownership before parallel implementation.
- [ ] Add an expandable company tree with websites, social media, documents, notes and commercial information.
- [ ] Add/edit/remove links, comments, notes and uploaded client documents.
- [ ] Integrate approved resources with AI retrieval, processing status and source references.
- [ ] Reflect edits/deletion in retrieval and keep client resources scoped to authorized users.

## P1/P2 — roles

- [ ] Agree on permissions for Admin, Sales Agent and Sales Representative.
- [ ] Implement role-specific workflows; distinguish prototype selection from authentication.
- [ ] Enforce access on the server and define what can appear in shared executive briefs.

## Validation for the first UI contribution

JavaScript syntax: `node --check src/app/navigator/static/app.js`.

Optional DOM behavior checks require Node and `jsdom@26`. Install jsdom in an
external tooling directory (not an application dependency), set `NODE_PATH` to
that directory's `node_modules`, and run:

```powershell
$env:NODE_PATH = 'C:/path/to/ui-tools/node_modules'
node --test src/tests/ui-workspace.test.cjs
```

The checks cover request filtering/clearing and safe rendering, three languages,
load failure/retry, pitch failure recovery and partner-search recovery. They use
mocked API responses and do not validate layout, live AI or production access controls.
