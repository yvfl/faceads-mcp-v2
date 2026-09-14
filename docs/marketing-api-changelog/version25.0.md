---
title: "Version 25.0"
source: "https://developers.facebook.com/documentation/ads-commerce/marketing-api/marketing-api-changelog/version25.0"
scraped_at: "2026-09-12T17:42:28.349Z"
---

# Version 25.0



## Marketing API

February 18, 2026 | **Available until** TBD | [Blog post](https://developers.facebook.com/blog/post/2026/02/18/introducing-graph-api-v25-and-marketing-api-v25)

### Advantage+ Campaigns

#### Advantage+ Shopping Campaigns and Advantage+ App Campaigns deprecation
*Applies to v25.0+. Will apply to all versions May 19, 2026.*

Creation, duplication, and updates to [Advantage+ shopping campaigns](advantage-shopping-campaigns.md) and [Advantage+ app campaigns](docs/app-ads/advantage-app-campaigns/) is no longer allowed.

Refer to the [Advantage+ Campaigns documentation](advantage-campaigns.md) to learn how to [migrate your campaigns](advantage-campaigns.md#migrate-advatage--shopping-campaigns-and-advantage--app-campaigns-into-advantage--campaigns) to Advantage+ campaigns or continue to create new campaigns using the Advantage+ structure.

The following endpoints are affected:

* [`POST /{ad-account-id}/campaigns`](reference/ad-account/campaigns.md)
* [`POST /{campaign-id}/copies`](reference/ad-campaign-group/copies.md)

### Insights

#### Asynchronous Jobs
*Applies to v25.0+.*

The following new default fields will be returned when an asynchronous ad report fails:

* `error_code`: The error code
* `error_message`: A message corresponding to the `error_code`
* `error_subcode`: The specific subcode for the error
* `error_user_title`: A user-friendly title for the error subcode
* `error_user_msg`: A user-friendly message detailing the error subcode

For any developers with access to the `error_code` field, the type will be changed from `uint` to `int`.

See [Insights API Asynchronous Jobs](insights/best-practices.md#asynchronous) and [Ads Insights API Error Codes](insights/error-codes.md) for more information.

The following endpoints are affected:

* [`GET /{ad-report-run-id}`](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-report-run)
