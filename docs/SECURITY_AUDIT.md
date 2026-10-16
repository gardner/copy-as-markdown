# Security review of the Gardner fork

Reviewed on 2026-10-16. Upstream: [yorkxin/copy-as-markdown at
40ebb8d81af1069613e0b5f85993ec23304a8a25](https://github.com/yorkxin/copy-as-markdown/tree/40ebb8d81af1069613e0b5f85993ec23304a8a25).
The upstream Firefox manifest was 3.8.0; its package.json still said 2.0.0.
This fork uses 3.8.1 consistently and a separate Firefox add-on ID.

## Scope and conclusion

Reviewed manifests, runtime entry points, HTML/Markdown conversion, content
extraction, clipboard transports, settings/custom formats, messaging, build
scripts, and the dependencies included in the release. No intentional
exfiltration, telemetry client, credential collection, remote-code loader,
dynamic code evaluation, or malware was found in the reviewed source. This is a
bounded source/dependency review, not a guarantee about every upstream version
or every possible vulnerability.

The extension reads page content only after a user invokes a copy action.
`activeTab` and `scripting` support selection extraction; `clipboardWrite`
supports copying; `contextMenus`, `alarms`, and `storage` support the UI.
Tabs, tab groups, and bookmarks remain optional permissions. There are no
blanket host permissions, persistent page content scripts, external message
listeners, or web-accessible resources. Settings previously used browser
account sync; this was an explicit upstream feature, not evidence of malware.

## Findings fixed

| Finding | Change and regression coverage |
| --- | --- |
| Link/image destinations accepted executable schemes and Markdown delimiters | Shared protocol validation rejects executable/data schemes, credentials, controls, and entity ambiguity; destination delimiters are percent-encoded. Seven initial security tests reproduced unsafe upstream output. |
| Titles, image labels, and bookmark/group names could inject Markdown or HTML | Labels escape brackets, backslashes, image syntax, and HTML; line breaks become spaces. Custom format inputs pass through the same boundaries. The unsafe bracket-escaping opt-out is retired. |
| HTML link titles could break out of Markdown title syntax | Backslashes and double quotes are escaped before inline or reference link conversion. An adversarial-title regression test reproduced the issue before the fix. |
| Selected HTML reached the converter without a sanitization boundary | DOMPurify returns a detached fragment. Scripts, embedded documents, foreign markup and unsafe attributes are removed. A restrictive extension CSP blocks outbound connections and remote resources. Browser tests intercept network traffic and verify that hostile conversion neither executes code nor requests resources. |
| Unbounded selected HTML and recursive conversion | Input is capped at 1,000,000 UTF-16 code units, 10,000 traversed nodes and depth 128. Excess content produces an error rather than a partial clipboard result. |
| GFM table plugin expands arbitrary `colspan` attributes | Spans must be positive safe integers at most 100; total expanded cells are capped at 20,000. This contains the unsafe expansion in `@truto/turndown-plugin-gfm` 1.0.2. |
| Table conversion doubled existing backslashes, undoing Markdown escaping | A pinned patch preserves already-escaped cell content. A literal-link regression test failed before the fix. |
| Indented closing fences could escape a generated code block | Fence length exceeds every run of the chosen delimiter in the code; language identifiers are restricted. A regression test failed before the change. |
| Preferences and custom templates synced to the browser account | All production preference storage now uses `storage.local`. Clipboard contents are not persisted by production code; the build checks reject test-only clipboard recording code. |
| Vulnerable, unused Firefox debugging dependencies | Only `web-ext/util/submit-addon` is used. pnpm removes its Android `adbkit` and desktop `fx-runner` dependencies, eliminating the `node-forge` and `shell-quote` advisory paths. The full locked tree audits without known advisories. The general `web-ext` CLI is deliberately not used with this pruned dependency tree. |
| Publishing could accept an unrelated or altered archive | The release checker caps archive sizes, rejects duplicate/unexpected/missing payload files, requires Mozilla signing metadata, and compares every payload byte with the built extension. GitHub receives only that verified XPI, its committed source archive, and SHA256SUMS. Firefox verifies the cryptographic signature during installation. |

The DOMPurify ESM build has one committed pnpm patch: its legacy `innerHTML`
fallback is replaced with an error when DOMParser fails. Supported browsers have
DOMParser. The patch is explicit in `patches/`, integrity-bound in the lockfile,
and covered by a real-browser failure test. The sanitizer ships separately with
its license; no Mozilla validation rule is disabled.

## Verification and limits

Run `pnpm check`, `pnpm test:browser`, `pnpm test:security:browser`,
`pnpm package:firefox`, `pnpm lint:firefox`, and `pnpm audit --audit-level=moderate`.
The tests include upstream regression coverage and new adversarial parsing and
signed-artifact cases. CI must pass all gates before signing. GitHub Actions are
pinned to commit hashes; dependency lifecycle scripts are disabled; signing
secrets are scoped to the signing step and never passed as command arguments.

The browser tests exercise Chromium, including a production extension load and
conversion through its packaged offscreen parser; they do not certify installation of a
Mozilla-signed Firefox package. That requires a successful signing submission
and an installation check. No signing or publication occurred during this local
audit. Source archive packaging uses Git HEAD, so commit changes before signing.

Generated Markdown intentionally retains ordinary HTTP(S) image references;
rendering or pasting it into another application may load those images. Custom
templates are user-authored Markdown and can deliberately contain links or
HTML. Neither is interpreted or uploaded by this extension. Browser/OS clipboard
synchronization is outside the extension's control.

Future upstream updates must be reviewed and tested before merging. CI builds
the checked-in code and frozen lockfile; it does not fetch upstream's moving
branch or download prebuilt extension bundles.
