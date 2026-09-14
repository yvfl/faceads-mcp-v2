---
title: "Estimated Daily Results"
source: "https://developers.facebook.com/documentation/ads-commerce/marketing-api/audiences/reference/estimated-daily-results"
scraped_at: "2026-09-12T17:42:28.312Z"
---

# Estimated Daily Results



**Warning:** This API is rolling out in phases, so you might not have access immediately.

Get the estimated bid, estimated daily and monthly active people and estimated outcomes curve for a specific [optimization goal](reference/ad-campaign.md), targeting spec, [attribution spec](reference/ad-campaign.md) and [promoted object](reference/ad-campaign.md) where applicable. In the outcomes curve each point represents an estimated reach and estimated number of results (impressions, actions) for a specific spend.

Endpoints for estimated daily results:

- [`/{AD_ACCOUNT}/delivery_estimate`](reference/ad-account/delivery_estimate.md) - note this `delivery_estimate` endpoint works on ad account level even though `targeting_spec` is defined for [ad sets](reference/ad-campaign.md)
- [`/{AD_SET}/delivery_estimate`](reference/ad-campaign/delivery_estimate.md) - You can omit all parameters at the ad set level; they default to the current ad set's settings.

The bid estimate may vary for the same targeting when you call it from different ad accounts: the bid estimate takes into consideration historical ad account information and forms a custom estimate.

Delivery estimates appear as the Daily Reach and Results Curve in [Ads Manager](https://www.facebook.com/ads/manager). **Ads Manager does not use delivery estimates for any other estimates.**
