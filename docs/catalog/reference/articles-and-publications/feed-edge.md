---
title: "Product Feed Articles and Publications"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/reference/articles-and-publications/feed-edge"
scraped_at: "2026-09-12T19:03:05.720Z"
---

# Product Feed Articles and Publications



The Product Feed Articles and Publications edge allows you to list the article and publication items (ebooks, audiobooks, magazines, newspapers, and other written content) that a specific product feed ingested.

## Permissions

To use this API, your app needs the following permission:

* `catalog_management`

## Reading {#reading}

To list article and publication items from a product feed, send a `GET` request:

```
GET /v25.0/{product-feed-id}/articles_and_publications HTTP/1.1
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

A GET request to the Product Feed Articles and Publications edge returns a JSON-formatted result:

```
{
  "data": [],
  "paging": {},
  "summary": {}
}
```

#### `data`

A list of [Articles and Publications](catalog/reference/articles-and-publications.md) nodes. See the [Articles and Publications](catalog/reference/articles-and-publications.md#reading-fields) reference for the full list of fields.

#### `paging`

For more details about pagination, see the [Graph API guide](https://developers.facebook.com/docs/graph-api/using-graph-api#paging).

#### `summary`

Aggregated information about the edge, such as counts. Specify `summary=true` as a query parameter to include the `summary` object in the response.

| Field | Type | Description |
| --- | --- | --- |
| `total_count` | integer | Total number of items in the feed. |

## Creating {#creating}

You can't perform this operation on this node. To create product feeds, use the [Product Feed](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed#Creating) node.

## Updating {#updating}

You can't perform this operation on this node. To update product feeds, use the [Product Feed](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed) node.

## Deleting {#deleting}

You can't perform this operation on this node. To delete product feeds, use the [Product Feed](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed) node.
