---
title: "Product Feed Apps and Software"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/reference/apps-and-software/feed-edge"
scraped_at: "2026-09-12T19:03:01.721Z"
---

# Product Feed Apps and Software



The Product Feed Apps and Software edge allows you to list app and software items (mobile apps, desktop software, games) that were ingested from a specific product feed.

## Permissions

To use this API, your app needs the following permission:

* `catalog_management`

## Reading {#reading}

To list app and software items from a product feed, send a `GET` request:

```
GET /v25.0/{product-feed-id}/apps_and_software HTTP/1.1
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

A GET request to this edge returns a JSON-formatted result:

```
{
  "data": [],
  "paging": {},
  "summary": {}
}
```

#### `data`

A list of [Apps and Software](catalog/reference/apps-and-software.md) nodes. See the [Apps and Software](catalog/reference/apps-and-software.md#reading-fields) reference for the full list of fields.

#### `paging`

For more details about pagination, see the [Graph API guide](https://developers.facebook.com/docs/graph-api/using-graph-api#paging).

#### `summary`

Aggregated information about the edge, such as counts. Specify `summary=true` as a query parameter to include this in the response.

| Field | Type | Description |
| --- | --- | --- |
| `total_count` | integer | Total number of items in the feed. |

## Creating {#creating}

You can't perform this operation on this node. To create product feeds, use the [Product Feed](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed#Creating) node.

## Updating {#updating}

You can't perform this operation on this node. To update product feeds, use the [Product Feed](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed) node.

## Deleting {#deleting}

You can't perform this operation on this node. To delete product feeds, use the [Product Feed](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed) node.
