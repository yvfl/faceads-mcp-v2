---
title: "Ad optimization basics"
source: "https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started/ad-optimization-basics"
scraped_at: "2026-09-12T17:42:28.336Z"
---

# Ad optimization basics



The Marketing API offers endpoints to manage audiences and analyze ad campaign insights. Use these endpoints to optimize your advertising strategies.

## Ad optimization endpoints

### The `customaudiences` endpoint

The [`customaudiences` endpoint](reference/ad-account/customaudiences.md) allows you to create and manage custom and lookalike audiences, tailoring ads to specific user segments based on demographics, interests, and behaviors.

**Example API request**

```bash
curl -X POST \
  https://graph.facebook.com/v25.0/act_<AD_ACCOUNT_ID>/customaudiences \
  -F 'name=My Custom Audience' \
  -F 'subtype=CUSTOM' \
  -F 'access_token=<ACCESS_TOKEN>'
```

### The `insights` endpoint

The [`insights` endpoint](reference/ad-account/insights.md) provides analytics about the performance of campaigns, ad sets, and ads, allowing you to track key metrics such as impressions, clicks, and conversions.

**Example API request**

```bash
curl -X GET \
  https://graph.facebook.com/v25.0/act_<AD_ACCOUNT_ID>/insights \
  -F 'fields=impressions,clicks,spend' \
  -F 'time_range={"since":"2023-01-01","until":"2023-12-31"}' \
  -F 'access_token=<ACCESS_TOKEN>'
```
