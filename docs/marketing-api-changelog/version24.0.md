---
title: "Version 24.0"
source: "https://developers.facebook.com/documentation/ads-commerce/marketing-api/marketing-api-changelog/version24.0"
scraped_at: "2026-09-12T17:42:28.348Z"
---

# Version 24.0



## Marketing API

October 8, 2025 | **Available until** October 6, 2026 | [Blog](https://developers.facebook.com/blog/post/2025/10/08/introducing-graph-api-v24-and-marketing-api-v24/)

### Ad Creative

#### Website destination optimization
*Applies to v24.0+.*

When you [optimize your website destination](https://www.facebook.com/business/help/1261275665394096), you allow Meta to determine which landing page on your website to send a customer to based on which URL we believe is most likely to result in a conversion. Using **Optimize website destination** means we may direct a customer to a page on your website that's most relevant to them, like your homepage, product page, collection page or another page on your website depending on where they're likely to convert.

The following endpoints are affected:

* [`POST /{ad-account-id}/adcreatives`](reference/ad-account/adcreatives.md)
* [`GET /{ad-creative-id}/?fields=destination_spec`](reference/ad-creative.md#fields)

### Ads that Click to Messenger

#### Messenger ads for leads deprecation
*Applies to v24.0+.*

The ability to create [lead ads that generate leads in Messenger](ad-creative/messaging-ads/click-to-messenger.md#leads) with the API is being deprecated. You will still be able to create Messenger ads for leads using Ads Manager.

The following endpoints are affected:

* [`POST /{page-id}/messenger_lead_forms`](https://developers.facebook.com/docs/graph-api/reference/page/messenger_lead_forms)
* [`POST /{ad-account-id}/adcreatives`](reference/ad-account/adcreatives.md)
* `GET /{messenger-lead-gen-template-id}`

### Advantage+ Campaigns

#### Advantage+ shopping campaigns and Advantage+ app campaigns deprecation
*Applies to v24.0+.*

We are introducing a new, unified, and streamlined process for creating campaigns that will replace the existing workflows.

Beginning with v24.0, creation, duplication, and updates to [Advantage+ shopping campaigns](advantage-shopping-campaigns.md) and [Advantage+ app campaigns](https://developers.facebook.com/docs/app-ads/advantage-app-campaigns) will no longer be allowed.

Refer to the [Advantage+ Campaigns documentation](advantage-campaigns.md) to learn how to [migrate your campaigns](advantage-campaigns.md#migrate-advatage--shopping-campaigns-and-advantage--app-campaigns-into-advantage--campaigns), or create new Advantage+ campaigns to avoid disruption.

The following endpoints are affected:

* [`POST /{ad-account-id}/campaigns`](reference/ad-account/campaigns.md)
* [`POST /{campaign-id}/copies`](reference/ad-campaign-group/copies.md)

### Audiences

#### Customer file custom audiences
*Applies to v24.0+. Will apply to all versions January 6, 2026.*

Updating [customer file custom audiences](audiences/guides/custom-audiences.md) that are [flagged custom audiences](reference/custom-audience.md#flagged) will fail.  Creating and updating lookalike audiences using flagged seed audiences will fail.

More information on this update and how to resolve flagged custom audiences can be found [here](https://www.facebook.com/business/help/1055828013359808).

The following endopints are affected:

* [`POST {ad-account-id}/customaudiences`](reference/ad-account/customaudiences.md)
* [`GET {custom-audience-id}`](reference/custom-audience.md)
* [`POST {custom-audience-id}`](reference/custom-audience.md)
* [`POST {custom-audience-id}/users`](reference/custom-audience/users.md)
* [`POST {custom-audience-id}/usersreplace`](reference/custom-audience/usersreplace.md)
* [`DELETE {custom-audience-id}/users`](reference/custom-audience/users.md)  

#### Lookalike audience field type enforcement
*Applies to v24.0+. Will apply to all versions January 6, 2026.*

When creating new [lookalike audiences](audiences/guides/lookalike-audiences.md), the `lookalike_spec` field is now required to match the  valid types. Requests with a `lookalike_spec` field containing invalid subfields may fail to create a new lookalike audience.

The following endpoints are affected:

* [`POST /{ad-account-id}/customaudiences`](docs/marketing-api/reference/custom-audience)

### Budgeting

#### Ad set budget sharing field conditionally required
*Applies to v24.0+.*

[Ad set budget sharing](bidding/guides/adset-budget-sharing.md) allows you to share up to 20% of your budget with other ad sets in the same campaign. This is designed to improve performance for campaigns that are not using a campaign budget.

Beginning with v24.0, the `is_adset_budget_sharing_enabled` field is now required if you are planning to set a budget at the ad set level. Setting it to `true` is recommended in order to turn on this optimization.

The following endpoints are affected:

* [`POST /{ad-account-id}/campaigns`](reference/ad-account/campaigns.md)

#### Increasing daily budget flexibility
*Applies to v24.0+.*

Daily budget flexibility is increasing from 25% to 75%. This means up to 75% over your [daily budget](bidding/overview/budgets.md) may be spent on days when better opportunities are available, and less on others.

Your daily budget is used as an average over a seven-day calendar week from Sunday through Saturday. Your weekly spend will not change, and will not be greater than 7 times your daily budget.

The following endpoints are affected:

* [`POST /{ad-account-id}/adsets`](reference/ad-account/adsets.md)
* [`POST /{ad-account-id}/campaigns`](reference/ad-account/campaigns.md)
* [`POST /{ad-set-id}`](reference/ad-campaign.md)
* [`POST /{campaign-id}`](reference/ad-campaign-group.md)

### Conversions

#### Custom conversions
*Applies to v24.0+. Will apply to all versions January 6, 2026.*

Updating [custom conversions](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/custom-conversion) that are [flagged custom conversions](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/custom-conversion#flagged-custom-conversions) will fail.

More information on this update and how to resolve flagged custom conversions can be found [here](https://www.facebook.com/business/help/2455915321411996).

The following endpoint is affected:

* [`POST /{custom-conversion-id}`](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/custom-conversion)

### Campaigns

#### Campaign restrictions for custom conversions and audiences
*Applies to v24.0+. Will apply to all versions January 6, 2026.*

Creating and updating campaigns that are using flagged [custom conversions](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/custom-conversion#flagged-custom-conversions) or [audiences](reference/custom-audience.md#flagged) will fail.

More information on this update and how to resolve flagged custom conversions and audiences can be found [here](https://developers.facebook.com/blog/post/2025/10/08/introducing-graph-api-v24-and-marketing-api-v24/#marketing-api).

The following endpoints are affected:

* [`POST /{ad-set-id}`](reference/ad-campaign.md)
* [`POST /{ad-account-id}/adsets`](reference/ad-account/adsets.md)

### Catalog

#### New batch API payload request limit
*Applies to v24.0+.*

We’ve added a new limit to the size of request payloads for the Catalog Items Batch API. Starting with v24.0, payload requests will be limited to 30 MB. Note that in terms of the number of items per request, the current limit of 5,000 items remains unchanged.

The following endpoint is affected:

* [`POST /{product-catalog-id}/items_batch`](reference/product-catalog/items_batch.md)

#### Product Item endpoint supports `allow_upsert`
*Applies to v24.0+.*

The `allow_upsert` flag is now supported for the Product Item POST endpoint. That means users can now not only create product items using the Product Item POST endpoint, but also update existing items.

The following endpoint is affected:

* [`POST /{product-catalog-id}/products`](reference/product-catalog/products.md)  

### Placements

#### Advantage+ placements limited spend
*Applies to v24.0+.*

This update allows you to allocate up to 5% of your spend to specific placements you would otherwise exclude when it's likely to improve performance.

During ad set creation, you can now apply a [limited spend](audiences/reference/placement-targeting.md#limited-spend-on-excluded-placements) using the new `placement_soft_opt_out` parameter. There is no change in how placements are fully opted out with [Placement Targeting](audiences/reference/placement-targeting.md).

**Note:** This feature works with the Sales and Leads objectives.

The following endpoints are affected:

* [`POST /{ad-account-id}/adsets`](reference/ad-account/adsets.md)
* [`POST /{ad-set-id}`](reference/ad-campaign.md)
* [`GET /{ad-set-id}?fields=placement_soft_opt_out`](reference/ad-campaign.md#parameters)

#### Facebook video feeds ads placement deprecation
*Applies to v24.0+.*

Delivery of Facebook video feeds ad placements will be stopped and campaign spending will be shifted to other placements automatically. Attempting to create or update an ad campaign with the Facebook video feeds ad placement will produce an error.

The Facebook Reels placement is the recommended replacement.

The following endpoints are affected:

* [`POST /{ad-account-id}/adsets`](reference/ad-account/adsets.md)
* [`POST /{ad-set-id}`](reference/ad-campaign.md)

### Targeting

#### Detailed targeting
*Applies to v24.0+. Will apply to all versions January 6, 2026.*

We are combining some of the interests currently available in [Detailed Targeting](audiences/reference/detailed-targeting.md) into relevant groupings.

Certain detailed targeting interest options will not be supported for new campaigns. When creating new or updating existing campaigns with affected interest options, you will encounter an error preventing you from publishing your changes.  If an interest option has been combined, the search results will show the new, consolidated option.

Ad campaigns created before October 8, 2025 can continue to run, but will stop being delivered by January 15, 2026, unless removed or updated with suggested combined options.

Beginning October 8, 2025, duplicated campaigns using the affected interest options will automatically be replaced with suggested combined options for Marketing API v24.0 calls.

The following endpoints are affected:

* [`POST /{ad-account-id}/adsets`](reference/ad-account/adsets.md)
* [`POST /{ad-set-id}`](reference/ad-campaign.md)
* [`POST /{ad-set-id}/copies`](reference/ad-campaign/copies.md)
* [`GET /{ad-account-id}/delivery_estimate`](reference/ad-account/delivery_estimate.md)
* [`GET /{ad-set-id}/delivery_estimate`](reference/ad-campaign/delivery_estimate.md)
* [`GET /{ad-account-id}/reachestimate`](reference/ad-account/reachestimate.md)
* [`GET /{ad-account-id}/targetingsearch`](reference/ad-account/targetingsearch.md)
* [`GET /{ad-account-id}/targetingsuggestions`](reference/ad-account/targetingsuggestions.md)
* [`GET /{ad-account-id}/targetingvalidation`](reference/ad-account/targetingvalidation.md)
* [`GET /search`](audiences/reference/basic-targeting.md#interest-targeting)
