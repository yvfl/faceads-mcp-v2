---
title: "Catalog and Signals Quality"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/guides/cat-signals-quality"
scraped_at: "2026-09-12T19:02:02.749Z"
---

# Catalog and Signals Quality


We offer two options to get feedback about the quality and performance of your different Advantage+ catalog ads assets:

* [Matched and Unmatched Pixel and App Events linked to your catalog](#events_api)
* [Pixel and Apps linked to your catalog](#checks_api)

## Feedback on Pixel and App Events for Catalogs {#events_api}
To identify issues with your pixel or app installation, you can check aggregate statistics about matched and unmatched events received from different pixels, apps and devices.

Query Event API to get statistics about events originating from event sources linked to your catalog. See [Events API, Reference](reference/product-catalog/event_stats.md) for details.

### Event Statistics

You can get this information at the catalog level:

```html
curl -X GET \
  -d 'access_token=<ACCESS_TOKEN>' \
https://graph.facebook.com/v25.0/<PRODUCT_CATALOG_ID>/event_stats
```

This returns an array of elements, one per event type, source and date within the last month:

```
{
  "data": [
    {
      "date_start": "2017-03-16",
      "date_stop": "2017-03-16",
      "event": "AddToCart",
      "event_source": {
        "id": "<PIXEL_ID>",
        "source_type": "PIXEL"
      },
      "total_matched_content_ids": 1086,
      "total_content_ids_matched_other_catalogs": 10024,
      "total_unmatched_content_ids": 13024,
      "unique_matched_content_ids": 285,
      "unique_content_ids_matched_other_catalogs": 102,
      "unique_unmatched_content_ids": 2132
    },
    {
      "date_start": "2017-03-16",
      "date_stop": "2017-03-16",
      "event": "ViewContent",
      "event_source": {
        "id": "<APP_ID>",
        "source_type": "APP"
      },
      "total_matched_content_ids": 1007,
      "total_content_ids_matched_other_catalogs": 504,
      "total_unmatched_content_ids": 20206,
      "unique_matched_content_ids": 507,
      "unique_content_ids_matched_other_catalogs": 402,
      "unique_unmatched_content_ids": 8037
    },
    ...
  ]
}
```

The fields returned for each event type, source and date are:

| Count | Description |
| --- | --- |
| `total_matched_content_ids` | The total number of content ids from received events that matched to an item in the catalog. This count is not de-duplicated across content ids. |
| `total_content_ids_matched_other_catalogs` | Total number of content IDs from received events that matched to an item in another catalog associated to the given pixel or app. This count is not de-duplicated across content IDs. |
| `total_unmatched_content_ids` | Total number of content IDs from received events received that didn't match an item in the catalog. This count is not de-duplicated across content IDs. |
| `unique_matched_content_ids` | Number of unique content IDs from received events that matched to an item in the catalog. |
| `unique_content_ids_matched_other_catalogs` | Number of unique content IDs from received events that matched to an item in another catalog associated to the given pixel or app that fired the event. |
| `unique_unmatched_content_ids` | Number of unique content ids from received events that didn't match an item in the catalog. |

### Device Type Breakdowns

Break down results by passing `device_type`:

```html
curl -G \
  -d 'breakdowns=["device_type"]' \
  -d 'access_token=<ACCESS_TOKEN>' \
https://graph.facebook.com/v25.0/<CATALOG_ID>/event_stats
```

This returns results grouped by device they occurred on. For example `desktop`, `mobile_iphone`, `mobile_android_phone` and so on:

```
{
  "data": [
    {
      "date_start": "2017-03-10",
      "date_stop": "2017-03-10",
      "event": "AddToCart",
      "event_source": {
        "id": "<PIXEL_ID>",
        "source_type": "PIXEL"
      },
      "device_type": "desktop",
      "total_matched_content_ids": 282,
      "total_content_ids_matched_other_catalogs": 524,
      "total_unmatched_content_ids": 4965,
      "unique_matched_content_ids": 102,
      "unique_content_ids_matched_other_catalogs": 402,
      "unique_unmatched_content_ids": 1427
    },
    ...
  ]
}
```

## Feedback on Pixel and App Events {#checks_api}

**Example**—Use checks to allow you to verify if there are any issues with the events sent by your pixel.

```html
curl -G \
  -d 'access_token=<ACCESS_TOKEN>' \
https://graph.facebook.com/v25.0/<PIXEL_ID>/da_checks
```

**Example**—Response

```
{
  "data": [
    {
      "description": "Pixel hasn't sent some or any events for Advantage+ catalog ads (ex: ViewContent, AddToCart, Purchase) at least once in the last 24 hours.",
      "key": "pixel_missing_dpa_event",
      "result": "failed",
      "title": "Pixel is not sending DPA events"
    },
    {
      "description": "Pixel events might be missing parameters some or all of the time.",
      "key": "pixel_missing_param_in_events",
      "result": "passed",
      "title": "Pixel missing parameter in DPA events"
    },
    {
      "action_uri": "https://www.facebook.com/ads/manage/pixels/?pixel_id=<PIXEL_ID>&m2w=1",
      "description": "The number of pixel events has dropped to less than half of the weekly average.",
      "key": "pixel_decline",
      "result": "passed",
      "title": "Decline in number of pixel events"
    }
  ]
}
```

You can use the following checks:

| Check | Description |
| --- | --- |
| `pixel_missing_dpa_event` | Checks if there are missing events for this pixel, as defined in [Advantage+ Catalog Ads](audiences/guides/dynamic-product-audiences.md). |
| `pixel_missing_param_in_events` | Checks if there are events with missing mandatory parameters, as defined in [Dynamic Ads](audiences/guides/dynamic-product-audiences.md). |
| `pixel_decline` | Checks if there's a decline in the number of events received for that pixel in the last 24 hours. |

For details, see [Pixel Dynamic Ads Checks, Reference](reference/ads-pixel/da_checks.md).

Possible values for the `result` field:
| Status | Description |
| --- | --- |
| passed | Your pixel passed this check. |
| failed | Your pixel didn't pass this check. |
| unavailable | This check is not available for this pixel right now. Please try again later. |

We return all checks by default, but you can specify checks you'd like to run, as follow:

```html
curl -G \
  --data-urlencode 'checks=[
    "pixel_decline",
    "pixel_missing_dpa_event",
    "pixel_missing_param_in_events"
  ]' \
  -d 'access_token=<ACCESS_TOKEN>' \
https://graph.facebook.com/v25.0/<PIXEL_ID>/da_checks
```

## For App Events
You can verify if there are any issues with the events sent by your app:

```html
curl -G \
  -d 'access_token=<ACCESS_TOKEN>' \
https://graph.facebook.com/v25.0/<APP_ID>/da_checks
```

Example response:

```
{
  "data": [
    {
      "description": "App hasn't sent some or any events for dynamic ads (ex: ViewContent, AddToCart, Purchase)...",
      "key": "app_missing_dpa_event",
      "result": "failed",
      "title": "App is not sending DPA events"
    },
    {
      "description": "App events might be missing parameters some or all of the time.",
      "key": "app_missing_param_in_events",
      "result": "passed",
      "title": "App missing parameter in DPA events"
    }
  ]
}
```

| Check | Description |
| --- | --- |
| `app_missing_dpa_event` | Checks if there are missing events for the app, as defined in [Dynamic Ads](audiences/guides/dynamic-product-audiences.md). |
| `app_missing_param_in_events` | Checks if there are events with missing mandatory parameters, as defined in [Dynamic Ads](audiences/guides/dynamic-product-audiences.md). |

For more details, see [App DA Checks, Reference](https://developers.facebook.com/docs/graph-api/reference/application/da_checks).

Possible values returned for `result`:
| Status | Description |
| --- | --- |
| passed | Your app passed this check. |
| failed | Your app didn't pass this check. |
| unavailable | This check is not available for this app right now. Please try again later. |

You can request values for specific checks. We return all by default, but you can specify which checks you'd like to run by passing them in the request:

```html
curl -G \
  -d 'checks=["app_missing_dpa_event","app_missing_param_in_events"]' \
  -d 'access_token=<ACCESS_TOKEN>' \
https://graph.facebook.com/v25.0/<APP_ID>/da_checks
```
