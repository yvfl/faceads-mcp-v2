---
title: "Feed API Reference"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/guides/feed-api"
scraped_at: "2026-09-12T19:02:06.236Z"
---

# Feed API Reference



Items you want to sell on Facebook and Instagram are uploaded and managed using a [catalog](catalog/overview.md). For each catalog, a [data feed](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed) should be provided in one of the [supported formats](catalog/reference.md#feed-format) (CSV, TSV, RSS XML, ATOM XML).

**Note**, to supplement or modify existing catalog data without modifying the raw, underlying data source, use a [supplementary feed](https://developers.facebook.com/documentation/ads-commerce/commerce-platform/catalog/supplementary-feeds). Supplementary feeds can only update items in a catalog; they cannot create or delete items.

## Uploading your products {#uploading}

You can manually create a product catalog in the [Commerce Manager](https://business.facebook.com/products), or programmatically. Upload or configure your products using the Product Feed API.

The product feed is the authoritative record used to update your catalog on Facebook, and Facebook fetches it periodically according to the configured interval. Store the product feed ID and use it to get upload status, errors, and to change upload schedule.

```html
curl -X POST \
  -F 'access_token=<ACCESS_TOKEN>' \
https://graph.facebook.com/v25.0/<PRODUCT_CATALOG_ID>/product_feeds
```

### Request

| Attribute | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | `string` | Required |  |
| `schedule` | [`schedule`](#schedule) | Required | The configuration for fetching a feed in a recurrent manner. See [`schedule` object below](#schedule) for more details. |
| `update_only` | `bool` | Optional | Default: `false`<br><br>**Note**, if value is set to `false`, the feed is treated as a replace feed. That means with every new incoming update, if Meta does not find the set of items created previously, Meta deletes them.<br><br>When set to `true`, Meta creates new items and updates existing ones but does not delete items from the feed. You only need to provide ID to update existing items. This reduces time to fetch and process your file. |
| `ingestion_source_type` | `enum {PRIMARY_FEED, SUPPLEMENTARY_FEED}` | Optional (Required for Supplementary Feeds) | See [Product Feed](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed) documentation. |
| `primary_feed_ids` | `list <numeric string>` | Optional (Required for Supplementary Feeds) | See [Product Feed](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed) documentation. |

### `schedule` object {#schedule}

Read the [Product Feed Schedule specification](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed-schedule) for more details.

| Attribute | Type | Required | Description |
| --- | --- | --- | --- |
| `url` | `string` | Required | The location of the product feed to fetch. |
| `interval` | `string` | Required | The interval at which the product feed gets fetched. |
| `hour` | `number` | Optional | Hour of the day to fetch the product feed. |

**Warning:** Scheduled feeds do not support uploads more frequently than once per hour.  If you need to update inventory faster, please use the [Catalog Batch API](https://developers.facebook.com/documentation/ads-commerce/commerce-platform/catalog/batch-api).

### Response

```json
{
  "id": {PRODUCT_FEED_ID}
}
```

## Perform a one-time direct upload {#direct-upload-feed}

Along with scheduled feed fetches, you can manually perform one-time uploads.

**Example** — Feed files hosted on a public location

```html
curl -X POST \
  -F 'url="<URL>"' \
  -F 'access_token=<ACCESS_TOKEN>' \
  https://graph.facebook.com/v25.0/<PRODUCT_FEED_ID>/uploads
```

**Example** — Uploading feed files directly from the local machine. The path to the file needs to be changed according to your use case.

```html
curl -X POST \
  -F 'file=@catalog.csv;type=text/csv' \
  -F 'access_token=<ACCESS_TOKEN>' \
  https://graph.facebook.com/v25.0/<PRODUCT_FEED_ID>/uploads
```

Optionally, you can set `update_only` to `true`. Meta creates new items and updates existing ones, but does not delete items from the feed. You only need to provide `id` to update existing items. This reduces time to fetch and process your file.

For example, to update only price and custom labels for 100 items in a feed, use direct upload. Provide a file with only `id`, `price` and `custom_label_0` for those items and `update_only` set to `true`. Meta supports all listed file formats; the most common ones are TSV and CSV. See [Supported Feed Formats](https://developers.facebook.com/documentation/ads-commerce/marketing-api/dynamic-product-ads/set-up-feed#feed-format) for more information.

If your feed file is hosted on a server with basic `HTTP` authentication, you have the option to send both `username` and `password`.

For more information, see:

- [Manual Product Feed Uploads, Reference](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed/uploads)
- [Product Feed Upload Errors, Reference](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed-upload/errors)
- [Uploading Inventory, Commerce Platform](catalog/guides/feed-api.md#uploading).

### Feed format per use case

| Feed Format | Use Case | Sample Feed |
| --- | --- | --- |
| CSV | Update `price` and `availability` for a subset of items. | [Download (Right-Click and Save Link As)](https://lookaside.facebook.com/developers/resources/?id=dpa_product_catalog_sample_feed_update.csv) |
| TSV | Reset `sale_price` and update `custom_label_0` for a subset of items | [Download (Right-Click and Save Link As)](https://lookaside.facebook.com/developers/resources/?id=dpa_product_catalog_sample_feed_update.tsv) |

## Handling product feed upload errors {#errors}

Read the [Product Feed Upload Errors documentation](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed-upload/errors).

Check catalog upload errors and warnings after each upload session. To do this, go to the **Diagnostics** section of your [Commerce Manager](https://business.facebook.com/products), or use the Feed API to request a sampling of errors and warnings. Start by first querying for recent upload sessions.

### Request

```html
curl -X GET -G \
  -d 'access_token=<ACCESS_TOKEN>' \
https://graph.facebook.com/v25.0/<PRODUCT_FEED_ID>/uploads
```

### Sample response

```json
{
  "data": [
    {
      "id": "{UPLOAD_SESSION_ID}}",
      "start_time": "2019-07-15T12:38:36+0000",
      "end_time": "2019-07-15T12:38:47+0000"
    }
  ]
}
```

Then, use the value returned in the `id` field to retrieve **a sampling** of errors and warnings.

### Request

```html
curl -X GET -G \
  -d 'access_token=<ACCESS_TOKEN>' \
https://graph.facebook.com/v25.0/<UPLOAD_SESSION_ID>/errors
```

### Sample response

A `fatal` severity here means the item cannot be ingested by Meta; a `warning` severity means the recommended attributes are missing or malformed. In the case of a `warning`, Meta omits the problematic field and proceeds with mutating the other fields.

```json
{
  "data": [
    {
      "id": 1510567479166488,
      "summary": "A required field is missing: price.",
      "description": "Products need to have prices to run in ads. Include a price for each product in your data feed file and upload it again. Prices must include cost and an ISO currency code (for example: 10 USD instead of $10 for American dollars).",
      "severity": "fatal",
      "samples": {
        "data": [
          {
            "row_number": 2,
            "retailer_id": "yj9bpbpub5t8t22kgbq6",
            "id": "1677559492523068"
          },
          {
            "row_number": 5,
            "retailer_id": "ujn33tvbyv2vmdpo7ecb",
            "id": "1529743440653137"
          }
        ]
      }
    },
    {
      "id": 275241589314958,
      "summary": "GTIN is incorrectly formatted",
      "description": "Check that the GTIN (Global Trade Identification Number) for each of your products is in the correct format. Accepted types include UPC, EAN, JAN, and ISBN.",
      "severity": "warning",
      "samples": {
        "data": [
          {
            "row_number": 4,
            "retailer_id": "bxwb1pho9o43uxjxikcg",
            "id": "538700559625644"
          }
        ]
      }
    }
  ]
}
```

## Download a full product feed errors report {#error_report}

Getting a sampling of errors and warnings is often sufficient to fix most Product Feed Upload issues. However, you may need the full list of errors to do deeper analysis. To download a full list of errors and warnings, you must first query the most recent upload session (see section above).

You can request the full error report to be generated for a given upload session ID.

### Request  

```html
curl -X POST \
  -F 'access_token=<ACCESS_TOKEN>' https://graph.facebook.com/v25.0/<UPLOAD_SESSION_ID>/error_report
```

### Response

```json
{
  "success": true
}
```

In case the report is not ready, repeat the last call after a few seconds. You can then download the report itself.

### Request

```html
curl -X GET -G \
  -d 'fields="error_report"' \
  -d 'access_token=<ACCESS_TOKEN>' \
https://graph.facebook.com/v25.0/<UPLOAD_SESSION_ID>
```

### Response

```json
{
  "error_report": {
    "report_status": "WRITE_FINISHED",
    "file_handle": "{link-to-the-file-location}"
  },
  "id": "493476498092860"
}
```

Find a URL that you can download with a tool such as wget or curl. The downloaded file contains the full error report.

If you get the error: "Cannot access an object not managed by the business owning this app", please make sure that the app you're using belongs to the business (Business Settings > Account > Apps).
