---
title: "Manage Catalog Items"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/guides/manage-catalog-items"
scraped_at: "2026-09-12T19:02:25.285Z"
---

# Manage Catalog Items



There are multiple ways to manage items in a catalog and keep catalog products up to date. For a comprehensive overview, including methods not available via APIs, please refer to this [Help Center article](https://www.facebook.com/business/help/890714097648074).

API integrations can be done using the three options explained below. Each of these options has features that make them more or less appropriate, depending on the situation.

## Option 1. Update One Item at a Time
The exact API endpoints to use depend on the type of items stored in a catalog. For example, for a commerce catalog.

* New items can be added by making a POST request to the `/{product_catalog_id}/products` edge
* Items can be updated or deleted by making calls to the [Product Item node](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-item)

There are similar endpoints for other types of items – vehicles, hotels, flights, etc. (see more details [here](catalog/guides/catalog-item-types.md))

This option should be used when the volume of updates for a catalog is very low. If the volume of updates is high, then updates to individual items should be grouped together and handled using Feed API or Batch API.

## Option 2. Feed API
[Feed API](catalog/guides/feed-api.md) allows you to update a catalog using a file or a URL. Data can be uploaded on an ad-hoc basis or according to an hourly, daily or weekly schedule. Feed API allows uploading product data in the 'replace' mode--this can be convenient when you want products not present in the latest feed dataset to be deleted (see the [Help Center article](https://www.facebook.com/business/help/2284463181837648) for more details).

## Option 3. Batch API
[Batch API](catalog/guides/manage-catalog-items/catalog-batch-api.md) is another option for updating multiple catalog items using a single API call. It is different from Feed API in the following ways:

* There is no need to put product data into a file or set up a URL. Updates are passed directly through the `POST` request payload
* You will **always** have to delete products by making a DELETE call to the API.
