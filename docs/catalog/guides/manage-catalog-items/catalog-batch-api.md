---
title: "Catalog Batch API"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/guides/manage-catalog-items/catalog-batch-api"
scraped_at: "2026-09-12T19:02:26.137Z"
---

# Catalog Batch API



Catalog Batch APIs are one of the ways you can make changes to products in a catalog. Refer to this [Help Center article](https://www.facebook.com/business/help/384041892421495?id=725943027795860) to decide whether this is the right solution for your use case.

There are separate API endpoints for managing:

* Catalog items
* Localization information for catalog items

One API call allows you to modify one or multiple catalog entities (hence the "Batch" in the API name). In a single request you can mix three kinds of modifications:

1. Create
2. Update
3. Delete

For example, you can send a single request that will:

* Create 7 new products
* Update descriptions of 2 existing products
* Delete 5 products that have been discontinued by a business

## How it works

Use the Catalog Batch API as follows:

1. Make a call to one of the endpoints that allows specifying the product updates that need to be applied
2. Call the `/check_batch_request_status` endpoint multiple times until the response indicates that processing has completed

## Catalog batch API endpoints

| Endpoint | Description |
| --- | --- |
| `POST` [/{catalog_id}/items_batch](reference/product-catalog/items_batch.md) | Sends a batch of requests (create, update, delete) for a catalog. Various catalog item types are supported ([see item types here](catalog/guides/catalog-item-types.md)). |
| `POST` [/{catalog_id}/localized_items_batch](reference/product-catalog/localized_items_batch.md) | Sends batch localization requests (create, update, delete) to existing items in your catalog. Various catalog item types are supported ([see item types here](catalog/guides/catalog-item-types.md)). |
| `GET` [/{catalog_id}/check_batch_request_status](reference/product-catalog/check_batch_request_status.md) | Checks the status of a batch request. Use a handle (returned from a previous call to one of the other endpoints) and make a `GET` call. |
| `POST` [/{catalog_id}/batch](reference/product-catalog/items_batch.md) | **Note:** There should be no new integrations with this endpoint. The `/items_batch` endpoint should be used instead.<br><br>Sends a batch of requests (create, update, delete) for a catalog. This API works only for catalogs with vertical=COMMERCE. Other verticals and their corresponding item types are not supported ([see item types here](catalog/guides/catalog-item-types.md)) |
