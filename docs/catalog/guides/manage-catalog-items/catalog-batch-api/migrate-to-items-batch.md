---
title: "Migrate to the /items_batch Endpoint"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/guides/manage-catalog-items/catalog-batch-api/migrate-to-items-batch"
scraped_at: "2026-09-12T19:02:26.961Z"
---

# Migrate to the /items_batch Endpoint



This document will help you plan migration of your API integration from the legacy [/batch](reference/product-catalog/batch.md) endpoint to its replacement  the [/items_batch](reference/product-catalog/items_batch.md) endpoint.

## Why You Should Migrate

* The [/batch](reference/product-catalog/batch.md) endpoint is no longer maintained and will eventually be deprecated.
* The new [/items_batch](reference/product-catalog/items_batch.md) endpoint is more versatile and can handle all operations supported by the /batch endpoint.
* The new [/items_batch](reference/product-catalog/items_batch.md) endpoint has support for [category-specific fields](https://developers.facebook.com/documentation/ads-commerce/commerce-platform/catalog/categories).

## Differences Between the Endpoints

The [/batch](reference/product-catalog/batch.md) and the new [/items_batch](reference/product-catalog/items_batch.md) endpoints were designed, at different points in time, to solve the same problem. It is important to note the following differences between the two:

### Difference 1 - Additional item_type parameter

Since the [/items_batch](reference/product-catalog/items_batch.md) endpoint supports the concept of verticals, you are required to pass a value of the 'item_type' parameter. If migrating from the /batch endpoint, you should always pass item_type=PRODUCT_ITEM.

### Difference 2 - Data for some fields is passed differently

| /batch | /items_batch | Comment |
| --- | --- | --- |
| retailer_id | id | The /batch endpoint has product retailer_id passed as part of a request object.<br><br>In the case of the [/items_batch](reference/product-catalog/items_batch.md) endpoint, the corresponding 'id' field is part of the 'data' field of the request object (see example requests below). |
| price, currency | price | Price may need to be divided by 100 depending on the currency (see [this documentation](currencies.md)). The currency code needs to be appended.<br><br>Example: `99.99 USD` |
| sale_price | sale_price | For passing the sale_price value to the [/items_batch](reference/product-catalog/items_batch.md) endpoint, the value from the /batch payload needs to be divided by 100 (depending on the currency, see [documentation](currencies.md)) and a currency code needs to be appended to it.<br><br>Example: `99.99 USD` |
| image_url | image_link | Same value, different field name |
| url | link | Same value, different field name |
| name | title | Same value, different field name |
| manufacturer_part_number | mpn | Same value, different field name |
| additional_image_urls | additional_image_link | Same value, different field name |
| category | google_product_category | Same value, different field name |
| shipping | shipping | Fields in the structures describing shipping are named differently.<br><br>\| /batch \| /items_batch \|<br>\| --- \| --- \|<br>\| country \| shipping_country \|<br>\| price_currency \| shipping_price_currency \|<br>\| price_value \| shipping_price_value \|<br>\| region \| shipping_region \|<br>\| service \| shipping_service \|<br><br>Alternatively, the [/items_batch](reference/product-catalog/items_batch.md) endpoint can handle shipping information passed as a single string consisting of comma-separated blobs (representing shipping options) in the following format: COUNTRY:STATE:SHIPPING_TYPE:PRICE<br><br>Example:<br>`US:CA:Ground:9.99 USD, US:NY:Air:15.99 USD` |
| additional_variant_attributes | additional_variant_attribute | The /batch endpoint expects this data to be passed as a label->value dictionary. The [/items_batch](reference/product-catalog/items_batch.md) endpoint expects this to be passed as an array of objects with two fields: variant_label, variant_value.<br><br>Example:<br><br>`[<br>{"variant_label": "a1", "variant_value": "v1},<br>{"variant_label": "a2", "variant_value": "v2}<br>]` |
| applinks | applink | The /batch endpoint expects app links to be passed as a dictionary where the key represents a platform name (such as 'android', 'ios', etc.) and the values are arrays of objects containing data related to the link.<br>The same data should be passed to the [/items_batch](reference/product-catalog/items_batch.md) endpoint as a flat object with the following fields:<br><br>* ios_url<br>* ios_app_store_id<br>* ios_app_name<br>* iphone_url<br>* iphone_app_store_id<br>* iphone_app_name<br>* ipad_url<br>* ipad_app_store_id<br>* ipad_app_name<br>* android_url<br>* android_package<br>* android_class<br>* android_app_name<br>* windows_phone_url<br>* windows_phone_app_id<br>* windows_phone_app_name |
| retailer_product_group_id | item_group_id | Same value, different field name |
| sale_price_start_date, sale_price_end_date | sale_price_effective_date | The /batch endpoint receives the start and end dates of a sale as two separate fields. The [/items_batch](reference/product-catalog/items_batch.md) endpoint requires them to be passed as a single string with two dates separated by a slash.<br><br>Example: `2014-11-01T12:00-0300/2014-12-01T00:00-0300` |

#### Example of Two Equivalent API Requests

| /batch | /items_batch |
| --- | --- |
| ```
curl -i -X POST \
  https://graph.facebook.com/<CATALOG_ID>/batch \
  -F access_token=<TOKEN> \
  -F 'requests=[
      {
          "method":"UPDATE",
          "data":{
              "retailer_product_group_id": "g1",
              "price": 1400,
              "currency": "GBP",
              "image_url": "http://website.com/image4.jpg",
              "additional_variant_attributes": {"Scent": "Fruity", "Flavor": "Apple"},
              "applinks": {
                 "android": [{
                  "url": "a://b/c",
                  "package": "android.topwidgets",
                  "app_name": "TopWidgets"
                 }],
                 "ios": [{
                  "url": "d://e/f",
                  "app_store_id": 123456,
                  "app_name": "TopWidgets"
                 }]
              },
              "category": "543586",
              "url": "http://website.com/product.html",
              "manufacturer_part_number": "twp123",
              "sale_price": 1100,
              "shipping": [
               {
                   "country": "US",
                   "region": "CA",
                   "service": "Pick-up point",
                   "price_value": "4.90",
                   "price_currency": "USD"
               },
               {
                   "country": "US",
                   "region": "CA",
                   "service": "Home delivery",
                   "price_value": "7.90",
                   "price_currency": "USD"
               }
               ],
              "name": "Test Product Name",
          },
          "retailer_id": "legacy_batch_api_product_123",
      }
  ]'
``` | ```
curl -i -X POST \
  https://graph.facebook.com/<CATALOG_ID>/items_batch \
  -F access_token=<TOKEN> \
  -F 'requests=[
      {
          "method":"UPDATE",
          "data":{
              "id": "batch_api_product_123",
              "item_group_id": "g1",
              "price": "14 GBP",
              "image_link": "http://website.com/image4.jpg",
              "additional_variant_attribute": "Scent:Fruity,Flavor:Apple",
              "applink": {
                  "android_url": "a://b/c",
                  "android_package": "android.topwidgets",
                  "android_app_name": "TopWidgets",
                  "ios_url": "d://e/f",
                  "ios_app_store_id": "123456",
                  "ios_app_name": "TopWidgets"
              },
              "google_product_category": "543586",
              "link": "http://website.com/product.html",
              "mpn": "twp123",
              "sale_price": "11 GBP",
              "shipping": [
      {
        "shipping_country": "US",
        "shipping_region": "CA",
        "shipping_service": "Pick-up point",
        "shipping_price_value": "4.90",
        "shipping_price_currency": "USD"
      },
      {
        "shipping_country": "US",
        "shipping_region": "CA",
        "shipping_service": "Home delivery",
        "shipping_price_value": "7.90",
        "shipping_price_currency": "USD"
      }
    ],
              "title": "Test Product Name",
          }
      }
  ]' \
  -F item_type=PRODUCT_ITEM
``` |

### Difference 3 - /items_batch warns about unsupported fields in the API response

The legacy /batch API endpoint ignores requests with unrecognized fields while the [/items_batch](reference/product-catalog/items_batch.md) endpoint issues a warning but still ingests the fields that it recognizes.

## Recommended Process for Migrating to the /items_batch Endpoint

At a high level the process should include the following two steps:

1. Implement the code necessary to pass all the necessary inputs to the items_batch endpoint. While doing so, you should take the differences listed above into account.
2. Gradually migrate your integration from the legacy /batch endpoint to the new [/items_batch](reference/product-catalog/items_batch.md) endpoint.

If you run into issues when carrying out the migration, please reach out to your business partner or reach out to Meta support.
