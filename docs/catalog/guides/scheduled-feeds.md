---
title: "Schedule Data Feed Uploads"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/guides/scheduled-feeds"
scraped_at: "2026-09-12T19:02:34.651Z"
---

# Schedule Data Feed Uploads



Use this guide to upload and schedule your feed.

## Upload your feed {#upload-feed}
To upload a feed, you need `catalog_management` permission. See [Marketing API, Permissions](get-started/authorization.md#access_token). After you create a catalog, use `catalog id` to create and schedule a [Product Feed](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed):

```html
curl -X POST \
  -F 'name="Test Feed"' \
  -F 'schedule={
       "interval": "DAILY",
       "url": "http://www.example.com/sample_feed.tsv",
       "hour": "22"
     }' \
  -F 'access_token=<ACCESS_TOKEN>' \
https://graph.facebook.com/v25.0/<PRODUCT_CATALOG_ID>/product_feeds
```

The `schedule` parameter enables you to schedule your feed upload. Options include `interval`, `url`, `hour`. The `schedule` parameter can also include `day_of_week`, `minute`, `username`, and `password`.

**Note:** **Note**: For `username` and `password`, Meta supports basic auth on HTTP and FTP.

**Example** — Schedule Your Feed Upload

```
schedule: {"day_of_week":"FRIDAY","hour":17,"interval_count":1,"interval":"DAILY","minute":42,"next_scheduled_upload_time":"","password":pwd123,"status":"active","timezone":"Atlantic/Canary","url":"https://www.abc.com","username":aname}
```

## Update an Individual Item {#update-item}

Update an individual item's data in real time. Include the updated fields in an `HTTP POST`, where `retailer_id` is the item ID from your feed. Base64url-encode the `retailer_id`.

```
https://graph.facebook.com/catalog:{CATALOG_ID}:{base64urlencode(retailer_id)}
```

See mutable fields in [Products, Reference](reference/product-catalog/products.md#Creating).

**Do not provide item feeds with individual item updates, creation, or deletion with the API.** This can disrupt any updates or deletes of items you created with the API because Meta doesn't track these with the feed.

## Schedule data feed fetches {#scheduled-feed-fetches}

**Warning:** Scheduled feeds don't support uploads more frequently than once per hour. If you need to update inventory faster, use the [Direct Upload API](catalog.md#direct-upload-product-feed).

**Note:** If you're using the Marketing API to create and manage your feeds, send an API request with details for the update schedule you want to create:

```
curl \
  -F 'name=Test Feed' \
  -F 'update_schedule={
    "interval": "HOURLY",
    "url": "http:\/\/www.example.com\/sample_feed_updates.tsv",
    "hour": 22
  }' \
  -F 'access_token=<ACCESS_TOKEN>' \
  https://graph.facebook.com/<API_VERSION>/<CATALOG_ID>/product_feeds
```

Meta fetches item feeds from your system on a schedule you define. There are two types of schedules you can define:

* `update_schedule` — The uploads create new items or update existing ones with the information provided in the data feed file.
* `schedule` — The uploads result in a complete refresh operation on your data feed. Meta deletes items not present in the file, updates existing ones, and creates new ones. You can use either of the schedules, or both, depending on your needs.

For example: `update_schedule` with frequency `HOURLY` and a replace `schedule` with frequency `DAILY`.

**Note:** Set up an `update_schedule` with only changed data in the data feed file for faster processing of the feed. An `update_schedule` is particularly useful for holiday sales and faster price and availability updates. Mark items as "out of stock" rather than deleting them from the feed so that Meta can retarget the user with similar available items.

```
curl \
  -F 'name=Test Feed' \
  -F 'schedule={
    "interval": "DAILY",
    "url": "http:\/\/www.example.com\/sample_feed.tsv"
  }' \
  -F 'update_schedule={
    "interval": "HOURLY",
    "url": "http:\/\/www.example.com\/sample_feed_updates.tsv",
    "hour": 22
  }' \
  -F 'access_token=<ACCESS_TOKEN>' \
  https://graph.facebook.com/<API_VERSION>/<CATALOG_ID>/product_feeds
```

Response:

```
{ "id" : {FEED_ID} }
```

See [Data Feed Reference](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed), [Data Feed Schedule Reference](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed-schedule).

## Learn more

* [Feed API, Commerce](catalog/guides/feed-api.md)
* [Perform One-Time Direct Upload](catalog/guides/feed-api.md#direct-upload-feed)
* [Manual Product Feed Uploads, Reference](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed/uploads)
* [Product Feed Upload Errors, Reference](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed-upload/errors)
* [Request a Data Feed Upload Error Report](catalog/support.md#data-feed-upload-report)
* [Get the Error Report Status](catalog/support.md#status-error-report)
* [Fix Feed Upload Errors with Rules](catalog/support.md#feed-rules)
* [Troubleshoot Your Data Feed, Support](catalog/support.md#troubleshoot-your-data-feed)
* [Prepare and Set Up Catalog for Advantage+ Catalog Ads, Blueprint](https://www.facebookblueprint.com/student/collection/240330/path/210141?content_id=E0G2EVplyh1dDB1)
* [Live Training on Catalog, Blueprint](https://www.facebookblueprint.com/student/collection/240330/path/210150?content_id=3AB46yBUG6YtkZC)
