---
title: "Version 21.0"
source: "https://developers.facebook.com/documentation/ads-commerce/marketing-api/marketing-api-changelog/version21.0"
scraped_at: "2026-09-12T17:42:28.348Z"
---

# Version 21.0



## Marketing API

October 2, 2024 | **Available until** September 9, 2025 | [Blog post](https://developers.facebook.com/blog/post/2024/10/02/introducing-graph-api-v21-and-marketing-api-v21/)

### Objectives

#### Outcome-Driven Ad Experiences
*Applies to v21.0+.*

Beginning with v21.0, you will no longer be able to create new ad sets or ads with non-Outcome-Driven Ad Experience (ODAX) objectives. Existing ad campaigns using older objectives can continue to run for now, but we encourage you to transition all your campaigns to the ODAX objectives. See the [Simplifying campaign objectives with Outcome-Driven Ad Experiences](https://developers.facebook.com/blog/post/2021/12/21/simplifying-campaign-objectives-outcome-driven-ad-experiences) blog entry and the [Outcome-Driven Ad Experiences documentation](reference/ad-campaign.md#odax) for more information.

The following endpoints are affected:

* [`POST /{ad_account_id}/campaigns`](reference/ad-account/campaigns.md)
* [`POST /{ad_account_id}/ads`](reference/ad-account/ads.md)
* [`POST /{ad_account_id}/adsets`](reference/ad-campaign.md)
* [`POST /{campaign_id}`](reference/ad-campaign-group.md)
* [`POST /{ad_group_id}`](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-group)

### Standard Enhancements

#### Image Expansion
*Applies to v21.0+.*

For single media ads, the [Image Expansion feature](creative/generative-ai-features.md#image-expansion) will be included as part of Standard Enhancements. Therefore, if creating an ad or an ad creative opted-in to Image Expansion, please refer to this [link](advantage-catalog-ads/standard-enhancements.md) for instructions to set `standard_enhancements` as a field inside the `creative_features_spec`.

The following endpoints are affected:

* [`POST /{ad_account_id}/adcreatives`](reference/ad-account/adcreatives.md)
* [`POST /{ad_account_id}/ads`](reference/ad-account/ads.md)
* [`GET /{ad_id}/previews`](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/adgroup/previews)
* [`GET /{ad_account_id}/generatepreviews`](generatepreview.md)

### Version 22 Upcoming Change

### Product Catalog — Enforcing Country Override Specific Fields
*Applies to: v22.0*

This change applies to advertisers using country and language feeds to localize their product data. It standardizes which fields should be provided in a country feed versus a language feed (or a country and language feed via API) to help advertisers set up their product data in the most efficient way.

Price, sale price, unit price, base price, status (visibility), and availability must now only be provided in a country feed. This helps ensure customers see the correct localized product data.

If your language feed currently contains the `price`, `sale_price`, `base_price`, `status` or `availability` fields, move them to your country feed before the Graph API v22.0 release in Q1 2025 to ensure that the localized data continues to be uploaded to your products past this date.

The following endpoints are affected:
* [`POST /{product-catalog-id}/localized_items_batch`](reference/product-catalog/localized_items_batch.md)
