---
title: "Product Catalog Apps and Software"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/reference/apps-and-software/catalog-edge"
scraped_at: "2026-09-12T19:03:00.792Z"
---

# Product Catalog Apps and Software



The Product Catalog Apps and Software edge allows you to list and create app and software items (mobile apps, desktop software, and games) in a product catalog.

## Permissions

You need the following permission to use this API:

* `catalog_management`

## Reading {#reading}

List app and software items in a catalog by sending a `GET` request:

```
GET /v25.0/{product-catalog-id}/apps_and_software HTTP/1.1
Host: graph.facebook.com
```

### Parameters {#reading-params}

| Parameter | Type | Description |
| --- | --- | --- |
| `filter` | string | **Optional**. JSON-encoded WCA (Whole Catalog Attribute) filter rule for apps and software. For example: `{"app_category":{"eq":"Games"}}`. See [Product Set](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-set) for the full list of filter operators. |
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

A list of [Apps and Software](catalog/reference/apps-and-software.md) nodes. See the [Apps and Software](catalog/reference/apps-and-software.md#reading-fields) reference for the full list of fields.

#### `paging`

For more details about pagination, see the [Graph API guide](https://developers.facebook.com/docs/graph-api/using-graph-api#paging).

#### `summary`

Aggregated information about the edge, such as counts. Specify `summary=true` as a query parameter to include this in the response.

| Field | Type | Description |
| --- | --- | --- |
| `total_count` | integer | Total number of items in the catalog. |

## Creating {#creating}

Create an app or software item in a catalog by sending a `POST` request:

```
POST /v25.0/{product-catalog-id}/apps_and_software HTTP/1.1
Host: graph.facebook.com
Content-Type: application/json

{
  "retailer_id": "app-001",
  "name": "Super Puzzle Game",
  "description": "A fun and challenging puzzle game for all ages",
  "image_url": "https://example.com/app-icon.jpg",
  "url": "https://example.com/super-puzzle-game",
  "app_category": "Games",
  "genre": ["Puzzle", "Casual"],
  "operating_system": ["iOS", "Android"]
}
```

### Parameters {#creating-params}

The following fields are required: `retailer_id`, `name`, `description`, `image_url`, and `url`. All other fields are optional.

For the full list of supported fields, see the [Apps and Software node — Fields](catalog/reference/apps-and-software.md#reading-fields).

### Response {#creating-response}

```
{
  "id": "1234567890"
}
```

## Updating {#updating}

You can't perform this operation on this node. To update individual app or software items, use the [Apps and Software](catalog/reference/apps-and-software.md#updating) node.

## Deleting {#deleting}

You can't perform this operation on this node. To delete individual app or software items, use the [Apps and Software](catalog/reference/apps-and-software.md#deleting) node.
