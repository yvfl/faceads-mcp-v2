---
title: "Product Set Activities"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/reference/activities/product-set-edge"
scraped_at: "2026-09-12T19:02:58.973Z"
---

# Product Set Activities



The Product Set Activities edge allows you to list activity items (concerts, sporting events, guided tours, and other bookable activities) that belong to a specific product set.

## Permissions

To use this API, your app needs the following permission:

* `catalog_management`

## Reading {#reading}

To list activity items in a product set, send a `GET` request:

```
GET /v25.0/{product-set-id}/activities HTTP/1.1
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

A list of [Activities](catalog/reference/activities.md) nodes. See the [Activities](catalog/reference/activities.md#reading-fields) reference for the full list of fields.

#### `paging`

For more details about pagination, see the [Graph API guide](https://developers.facebook.com/docs/graph-api/using-graph-api#paging).

#### `summary`

Aggregated information about the edge, such as counts. Specify `summary=true` as a query parameter to include this in the response.

| Field | Type | Description |
| --- | --- | --- |
| `total_count` | integer | Total number of items in the product set. |

## Creating {#creating}

You can't perform this operation on this edge. To create product sets, use the [Product Set](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-set) node.

## Updating {#updating}

You can't perform this operation on this edge. To update product sets, use the [Product Set](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-set) node.

## Deleting {#deleting}

You can't perform this operation on this edge. To delete product sets, use the [Product Set](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-set) node.
