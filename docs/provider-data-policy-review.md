# Published provider data policies — November 3, 2026

This read-only review checks public statements, not account settings or legal
approval. No credentials, billing settings, provider route or model calls changed.

| Provider | Published statement | Verification limit |
| --- | --- | --- |
| Meta | Standard requests are not used to train Meta models; Contributor mode permits training. General terms also allow retention for service, compliance, security and policy purposes. | No zero-retention conclusion follows from Standard mode or `store: false`. Actual account routing and applicable processing agreement remain separate. |
| Baseten | Security Practices state synchronous Model APIs do not persist inputs/outputs after processing; customer configurations and enabled logging can change the applicable position. | Public policy does not establish this account's overrides. The initial page reader showed a JavaScript shell; the indexed primary-source result supplied the policy text. |

Sources checked:

- [Meta pricing modes](https://dev.meta.ai/docs/pricing-rate-limits), Standard versus Contributor.
- [Meta Model API terms](https://dev.meta.ai/legal/terms-of-service), sections 4.4 and 5.1.
- [Baseten Security Practices](https://www.baseten.co/security-practices/), Model APIs and customer-controlled factors.

The checkout uses Standard `muse-spark-1.3` for Meta requests and the existing
Baseten model endpoint for the configured analysis route. These are code
observations; they do not prove the full retention/training release gate.
The public-UO research store remains separate from student uploads.
