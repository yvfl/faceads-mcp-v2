---
title: "Product Catalog Activities"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/reference/activities/catalog-edge"
scraped_at: "2026-09-12T19:02:57.341Z"
---

# Product Catalog Activities



The Product Catalog Activities edge allows you to list and create activity items (concerts, sporting events, guided tours, and other bookable activities) in a product catalog.

## Permissions

To use this API, your app needs the following permission:

* `catalog_management`

## Reading {#reading}

To list activity items in a catalog, send a `GET` request:

```
GET /v25.0/{product-catalog-id}/activities HTTP/1.1
Host: graph.facebook.com
```

### Parameters {#reading-params}

| Parameter | Type | Description |
| --- | --- | --- |
| `filter` | string | **Optional**. JSON-encoded WCA filter rule for filtering activities. For example: `{"activity_category":{"eq":"Tour"}}`. See [Product Set](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-set) for the full list of filter operators. |
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
| `total_count` | integer | Total number of items in the catalog. |

## Creating {#creating}

To create an activity item in a catalog, send a `POST` request:

```
POST /v25.0/{product-catalog-id}/activities HTTP/1.1
Host: graph.facebook.com
Content-Type: application/json

{
  "retailer_id": "ACT-001",
  "name": "Jasper's City Highlights Tour",
  "description": "Discover the city's most iconic landmarks on a guided walking tour with an expert local guide. Suitable for all ages.",
  "image_url": "https://www.example.com/images/city-tour.jpg",
  "url": "https://www.example.com/tours/city-highlights",
  "brand": "Facebook",
  "price": "10.00 USD",
  "activity_category": "Tour",
  "performers": "Alex Smith,Jordan Lee",
  "activity_date": "2026-09-15"
}
```

### Parameters {#creating-params}

The following fields are required: `retailer_id`, `name`, `description`, `image_url`, `url`. All other fields are optional.

For the full list of supported fields, see the [Activities node — Fields](catalog/reference/activities.md#reading-fields).

### Response {#creating-response}

```
{
  "id": "ACT-001"
}
```

### Example with optional fields {#creating-example-optional}

This example includes optional fields such as a sale price, multiple performers, a circular availability area, and the item status:

```
POST /v25.0/{product-catalog-id}/activities HTTP/1.1
Host: graph.facebook.com
Content-Type: application/json

{
  "retailer_id": "ACT-002",
  "name": "Riverside Jazz Festival",
  "description": "An open-air evening of live jazz featuring international and local artists along the river.",
  "image_url": "https://www.example.com/images/jazz-festival.jpg",
  "url": "https://www.example.com/events/riverside-jazz",
  "brand": "Riverside Events",
  "price": "75.00 USD",
  "sale_price": "60.00 USD",
  "currency": "USD",
  "activity_category": "Concert",
  "activity_sub_categories": "Jazz,Live Music",
  "activity_date": "2026-09-15",
  "performers": "Alex Smith,Jordan Lee",
  "location_names": "Riverside Amphitheater",
  "in_languages": "en,es",
  "availability_circle_origin": {
    "latitude": 40.7128,
    "longitude": -74.006
  },
  "availability_circle_radius": 10,
  "availability_circle_radius_unit": "km",
  "status": "active"
}
```

## Updating {#updating}

You can't perform this operation on this edge. To update individual activity items, use the [Activities](catalog/reference/activities.md#updating) node.

## Deleting {#deleting}

You can't perform this operation on this edge. To delete individual activity items, use the [Activities](catalog/reference/activities.md#deleting) node.
