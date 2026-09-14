---
title: "Product Set Media Titles"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/reference/media-titles/product-set-edge"
scraped_at: "2026-09-12T19:03:10.314Z"
---

# Product Set Media Titles



The Product Set Media Titles edge allows you to list media title items (movies, TV shows, music) that belong to a specific product set.

## Permissions

To use this API, your app needs the following permission:

* `catalog_management`

## Reading {#reading}

To list media title items in a product set, send a `GET` request:

```
GET /v25.0/{product-set-id}/media_titles HTTP/1.1
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

Reading from this edge returns a JSON-formatted result:

```
{
  "data": [],
  "paging": {},
  "summary": {}
}
```

#### `data`

A list of [Media Title](catalog/reference/media-titles.md) nodes. See the [Media Title](catalog/reference/media-titles.md#reading-fields) reference for the full list of fields.

#### `paging`

For more details about pagination, see the [Graph API guide](https://developers.facebook.com/docs/graph-api/using-graph-api#paging).

#### `summary`

Aggregated information about the edge, such as counts. Specify `summary=true` as a query parameter to include the `summary` object in the response.

| Field | Type | Description |
| --- | --- | --- |
| `total_count` | integer | Total number of items in the product set. |

## Creating {#creating}

You can't perform this operation on this node. To create product sets, use the [Product Set](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-set) node.

## Updating {#updating}

You can't perform this operation on this node. To update product sets, use the [Product Set](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-set) node.

## Deleting {#deleting}

You can't perform this operation on this node. To delete product sets, use the [Product Set](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-set) node.
