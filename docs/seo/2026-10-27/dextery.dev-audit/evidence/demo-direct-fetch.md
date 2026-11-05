# Independent Grailed Plus demo availability check

Audit: 2026-10-27 local / 2026-10-28 UTC.

- Request: direct public `webfetch` of
  `https://grailed-plus-demo.dextery.dev/?feature=overview`.
- Requested timeout: 30 seconds.
- Observed result: `Request timed out`; no HTTP status or response body returned.
- No authentication, management access, configuration change, installation,
  form submission, retry loop, or remote mutation was performed.

This independently supports investigating the demo-readiness problem observed in
the visual/content/performance captures. It does not identify a DNS, TLS, hosting,
application or postMessage cause, establish a global/persistent outage, or prove
that the Chrome extension itself fails. First-party page content and official
store navigation remain separate from this dependency.
