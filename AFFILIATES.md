# Affiliate programs

Only add links from programs listed here as **active**. The site targets UK readers, so join the UK versions.

| Program | Status | Link format / tag |
|---|---|---|
| Amazon Associates (UK, affiliate-program.amazon.co.uk) | **joined 2026-10-24**, tracking ID `patchedpatches-20` | Set as `amazonTag` in site.config.json. In guides write `[link text](amazon:search words)`; the build turns it into an amazon.co.uk search link with the tag. Amazon closes accounts with no qualifying sales in the first 180 days, so aim for three sales by late April 2027. |
| Etsy (via Awin) | not joined | Good fit for custom and handmade patches. |
| Awin (network) | **pending: not joined yet** | Join Awin as a publisher, then put the publisher ID in `awinPublisherId` in site.config.json. Each merchant also needs its own approval. |
| Abakhan (via Awin, merchant 32143) | apply once on Awin | In guides write `[link text](awin:abakhan|https://www.abakhan.co.uk/...)`. Shows as plain text until `awinPublisherId` is set. |
| The Trimming Shop (via Awin, merchant 44013) | apply once on Awin | `[link text](awin:trimmingshop|https://www.trimmingshop.co.uk/...)` |
| Other Awin craft retailers | not checked | Add a key and merchant ID to `awinMerchants` in site.config.json, then use `awin:<key>|<url>`. Merchant IDs are the number in the merchant's Awin profile URL. |
| Gumroad (our own planner) | **pending: product not listed** | Put the product URL in `gumroad.planner` in site.config.json. `[Get the planner](gumroad:planner)` becomes a buy button; until then it shows "Coming soon". |
| Custom patch makers | not joined | Some makers run affiliate or referral schemes; check terms before joining. |
