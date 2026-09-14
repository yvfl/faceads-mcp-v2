---
title: "Overrides API"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/localized-catalog/localized-catalog-setup/overrides-api"
scraped_at: "2026-09-12T19:02:49.960Z"
---

# Overrides API



The overrides API is built as a new endpoint over the product API. It returns all overrides that are associated with the item ID provided.

**Warning:** `price`, `sale_price`, `unit_price`, `base_price`, `status` (visibility), and `availability` must only be provided in a country feed. These fields cannot be provided in a language feed. This helps ensure customers see the correct localized product data.

## Endpoint

Make a `GET` call to the following endpoint:

```
GET /<API_VERSION>/{item_id}/override_details
```

## Filtering Parameters

| Field name | Description | Example |
| --- | --- | --- |
| keys | Filter for specific countries or languages | * `AE`, `US`, `DE`<br>* `en_XX`, `es_XX`<br>* `US`, `en_XX`, `DE`, `es_XX` |
| type | Filter for specific type of override | * `language`<br>* `country`<br>* `language_and_country` |

### Example Request

```
GET /v20.0/{item_id}/override_details?keys=US,en_XX,DE,es_XX
```

### Response

| Field name | Description | Example |
| --- | --- | --- |
| type | Unique enum identifier, representing different types of overrides, e.g. country or language. Easily extendible in the future to support. | `country` |
| key | Key for which we determine the data for a specific type e.g. certain language value or a certain country. | `AE` |
| values | Values that are set for each field on the overridden product item. | ```
[{
    "name": "price",
    "value": "55200 AED",
},
{
    "name": "fees",
    "value": "400 AED",
}]
``` |

### Sample Response

```
"override_details": [{
    "type": "country",
    "key": "AE",
    "values": {
        "price": "55200 AED",
        "fees": "400 AED",
        "availability": "in stock",
        "color": "black",
    },
},
{
    "type": "country",
    "key": "HR",
    "values": {
        "price": "120 EUR",
        "availability": "in stock",
        "fees": "20 EUR",
        "color": "red",
        "image_url": [
            "https://static.company.com/images/1...",
            "https://static.company.com/images/2...",
            "https://static.company.com/images/3...",
        ],
    },
},
{
    "type": "language",
    "key": "es_XX",
    "values": {
        "availability": "out of stock",
        "name": "silla",
        "description": "esta es una silla genial",
    },

}]
```

## See Also

* [Localized Catalogs Overview](catalog/guides/localized-catalog.md)
* [Localized Catalog Setup](catalog/localized-catalog/localized-catalog-setup.md)
