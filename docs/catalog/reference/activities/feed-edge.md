---
title: "Product Feed Activities"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/reference/activities/feed-edge"
scraped_at: "2026-09-12T19:02:58.151Z"
---

# Product Feed Activities



The Product Feed Activities edge allows you to list activity items (concerts, sporting events, guided tours, and other bookable activities) that were ingested from a specific product feed.

## Permissions

To use this API, your app needs the following permission:

* `catalog_management`

## Reading {#reading}

To list activity items from a product feed, send a `GET` request:

```
GET /v25.0/{product-feed-id}/activities HTTP/1.1
Host: graph.facebook.com
```

### Parameters {#reading-params}

| Parameter | Type | Description |
| --- | --- | --- |
| `summary` | boolean | **Optional**. When `true`, includes a `summary` object with `total_count` in the response. |
| `limit` | integer | **Optional**. Maximum number of items to return per page. |
| `before` | string | **Optional**. Cursor for backward pagination. |
| `after` | string | **Optional**. Cursor for forward pagination. |

### Fields {#reading-fields}

Reading from this edge will return a JSON formatted result:

```
{
  "data": [],
  "paging": {},
  "summary": {}
}
```

#### `data`

A list of [Activities](catalog/reference/activities.md) nodes. See the [Activities](catalog/reference/activities.md#reading-fields) reference for the full list of fields.

#### `paging`

For more details about pagination, see the [Graph API guide](https://developers.facebook.com/docs/graph-api/using-graph-api#paging).

#### `summary`

Aggregated information about the edge, such as counts. Specify `summary=true` as a query parameter to include this in the response.

| Field | Type | Description |
| --- | --- | --- |
| `total_count` | integer | Total number of items in the feed. |

## Creating {#creating}

You can't perform this operation on this edge. To create product feeds, use the [Product Feed](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed#Creating) node.

## Updating {#updating}

You can't perform this operation on this edge. To update product feeds, use the [Product Feed](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed) node.

## Deleting {#deleting}

You can't perform this operation on this edge. To delete product feeds, use the [Product Feed](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed) node.
