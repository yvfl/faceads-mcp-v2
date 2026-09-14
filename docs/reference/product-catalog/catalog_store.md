---
title: "Product Catalog Catalog Store"
source: "https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-catalog/catalog_store"
scraped_at: "2026-09-12T17:42:28.397Z"
---

# Product Catalog Catalog Store



## Reading

You can't perform this operation on this endpoint.

## Creating

### /{product_catalog_id}/catalog_store
You can make a POST request to *catalog_store* edge from the following paths:

- [/{product_catalog_id}/catalog_store](reference/product-catalog/catalog_store.md)

When posting to this edge, a [StoreCatalogSettings](https://developers.facebook.com/docs/graph-api/reference/store-catalog-settings) will be created.

#### Parameters

| Parameter | Description |
| --- | --- |
| `page`<br><br>*numeric string* | The parent page associated with the store product catalog<br><br>**[required]**<br> |

#### Return Type

This endpoint supports [read-after-write](https://developers.facebook.com/docs/graph-api/overview#read-after-write) and will read the node represented by *id* in the return type.

```
Struct  {
id: numeric string,
}
```

#### Error Codes

| Error Code | Description |
| --- | --- |
| 100 | Invalid parameter |

## Updating

You can't perform this operation on this endpoint.

## Deleting

You can't perform this operation on this endpoint.
