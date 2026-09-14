---
title: "Product Set Professional Services"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/reference/professional-services/product-set-edge"
scraped_at: "2026-09-12T19:03:13.858Z"
---

# Product Set Professional Services



The Product Set Professional Services edge allows you to list professional services items (consulting, home services, health and wellness, and other services) that belong to a specific product set.

## Permissions

To use this API, your app needs the following permission:

* `catalog_management`

## Reading {#reading}

To list professional services items in a product set, send a `GET` request:

```
GET /v25.0/{product-set-id}/professional_services HTTP/1.1
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

A list of [Professional Services](catalog/reference/professional-services.md) nodes. See the [Professional Services](catalog/reference/professional-services.md#reading-fields) reference for the full list of fields.

#### `paging`

For more details about pagination, see the [Graph API guide](https://developers.facebook.com/docs/graph-api/using-graph-api#paging).

#### `summary`

Aggregated information about the edge, such as counts. Specify `summary=true` as a query parameter to include this in the response.

| Field | Type | Description |
| --- | --- | --- |
| `total_count` | integer | Total number of items in the product set. |

## Creating {#creating}

You can't perform this operation on this node. To create product sets, use the [Product Set](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-set) node.

## Updating {#updating}

You can't perform this operation on this node. To update product sets, use the [Product Set](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-set) node.

## Deleting {#deleting}

You can't perform this operation on this node. To delete product sets, use the [Product Set](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-set) node.
