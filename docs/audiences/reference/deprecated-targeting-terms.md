---
title: "Deprecated Targeting Terms"
source: "https://developers.facebook.com/documentation/ads-commerce/marketing-api/audiences/reference/deprecated-targeting-terms"
scraped_at: "2026-09-12T17:42:28.311Z"
---

# Deprecated Targeting Terms



We continuously review the available targeting options as part of our ongoing efforts to provide relevant and quality ad experiences for advertisers and developers. As a result, we may deprecate certain targeting options and pause delivery for ad sets that target these objects.

To identify ad sets targeted at deprecated targeting options, use the following API endpoint:

```
curl -G \
  -d 'type=<TYPE_VALUE>'
  'https://graph.facebook.com/<API_VERSION>/act_<AD_ACCOUNT_ID>/deprecatedtargetingadsets
```

The response:

```
{"data":[{"id":"<ADSET_ID>"},{"id":"<ADSET_ID>"},{"id":"<ADSET_ID>"}]}
```

The `type` parameter is optional. If not provided, the system returns deprecating ad sets by default.

* `deprecating` - Default value. These ad sets continue to deliver, but can't be duplicated into new ad sets. When updated, ad sets with deprecating terms will be rejected unless the terms are removed.
* `delivery_paused` - Ad sets with terms no longer valid for delivery. Facebook has paused these ad sets.

To verify the status of these targeting options listed under ad set targeting specification, use the `targeting_option_list` parameter in [Targeting Search](audiences/reference/targeting-search.md).

You can filter ad account ad sets by their targeting state using the `adset.targeting_state` filter. For example:

```
`<act_AD_ACCOUNT_ID>/adsets?filtering=[{"field":"adset.targeting_state","operator":"IN","value":["deprecating"]}]`
```

The filter supports these values: `normal`, `deprecating`, `delivery_affected`, `delivery_paused`.
