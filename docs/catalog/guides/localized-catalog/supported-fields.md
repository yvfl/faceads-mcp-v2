---
title: "\"Localized Catalog: Supported Fields\""
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/guides/localized-catalog/supported-fields"
scraped_at: "2026-09-12T19:02:24.337Z"
---

# "Localized Catalog: Supported Fields"



This document contains the lists of supported fields grouped by item type. Please note that the notation used here reflects how the fields are called in feed files. For example,a CSV feed file can have columns named 'image[0].url', 'image[1].url', 'applink.android_url', etc. By comparison, in Batch API, catalog item data is hierarchically organized in a JSON object, for example:

```
{
    "image": [
        {
            "url": "http://website.com/image4.jpg",
            "tag": [
                       "t1",
                       "t2"
            ]
        },
        ...
    ],
    "applink": {
        "android_url": "a://b/c",
        ...
    },
    ...
}
```

**Warning:** **Note**: `price`, `sale_price`, `unit_price`, `base_price`, `status` (visibility), and `availability` must only be provided in a country feed. These fields cannot be provided in a language feed. This helps ensure customers see the correct localized product data.

## Products

* `title`
* `description`
* `availability`
* `link`
* `brand`
* `price`
* `sale_price`
* `sale_price_effective_date`
* `color`
* `size`
* `material`
* `pattern`
* `custom_label_0`
* `custom_label_1`
* `custom_label_2`
* `custom_label_3`
* `custom_label_4`
* `short_description`
* `additional_variant_attribute`
* `applink.ios_url`, `applink.ios_app_store_id`, `applink.ios_app_name`, `applink.android_url`, `applink.android_package`, `applink.android_app_name`, `applink.windows_phone_url`, `applink.windows_phone_app_id`, `applink.windows_phone_app_name`, `applink.ipad_url`, `applink.ipad_app_store_id`, `applink.ipad_app_name`

To localize any applink fields, you must provide all of them. Learn more about [product deep links](catalog/guides/product-deep-links.md).

To localize an image, you must use the `image[0].url`, `image[0].tag[0]` nested image fields. The `image_link` field isn't supported for localization.  

For reference, see the [main list of fields for products](catalog/reference.md#da-commerce).

## Hotels

* `name`
* `description`
* `base_price`
* `sale_price`
* `brand`
* `url`
* `neighborhood`
* `longitude`
* `latitude`
* `image[0].url, image[0].tag[0] internal_label`
* `applink.ios_url`, `applink.ios_app_store_id`, `applink.ios_app_name`, `applink.android_url`, `applink.android_package`, `applink.android_app_name`, `applink.windows_phone_url`, `applink.windows_phone_app_id`, `applink.windows_phone_app_name`, `applink.ipad_url`, `applink.ipad_app_store_id`, `applink.ipad_app_name`

To localize any applink fields, you must provide all of them. Learn more about [product deep links](catalog/guides/product-deep-links.md).

For reference, see the [main list of fields for hotels](hotel-ads/catalog.md#hotel-feed).

## Flights

* `description`
* `url`
* `origin_city`
* `destination_city`
* `price`
* `one_way_price`
* `image[0].url, image[0].tag[0]`
* `custom_label_0`
* `custom_label_1`
* `custom_label_2`
* `custom_label_3`
* `custom_label_4`
* `custom_number_0`
* `custom_number_1`
* `custom_number_2`
* `custom_number_3`
* `custom_number_4`
* `internal_label`
* `applink.ios_url`, `applink.ios_app_store_id`, `applink.ios_app_name`, `applink.android_url`, `applink.android_package`, `applink.android_app_name`, `applink.windows_phone_url`, `applink.windows_phone_app_id`, `applink.windows_phone_app_name`, `applink.ipad_url`, `applink.ipad_app_store_id`, `applink.ipad_app_name`

To localize any applink fields, you must provide all of them. Learn more about [product deep links](catalog/guides/product-deep-links.md).

For reference, see the [main list of fields for flights](flight-ads/catalog.md#flight-feed).

## Destinations

* `name`
* `description`
* `url`
* `price`
* `neighborhood`
* `longitude`
* `latitude`
* `image[0].url, image[0].tag[0]`
* `custom_label_0`
* `custom_label_1`
* `custom_label_2`
* `custom_label_3`
* `custom_label_4`
* `custom_number_0`
* `custom_number_1`
* `custom_number_2`
* `custom_number_3`
* `custom_number_4`
* `internal_label`
* `applink.ios_url`, `applink.ios_app_store_id`, `applink.ios_app_name`, `applink.android_url`, `applink.android_package`, `applink.android_app_name`, `applink.windows_phone_url`, `applink.windows_phone_app_id`, `applink.windows_phone_app_name`, `applink.ipad_url`, `applink.ipad_app_store_id`, `applink.ipad_app_name`

To localize any applink fields, you must provide all of them. Learn more about [product deep links](catalog/guides/product-deep-links.md).

For reference, see the [main list of fields for destinations](destination-ads/catalog.md#destination-feed).

## Home Listings

* `name`
* `description`  
* `price`
* `url`
* `image[0].url, image[0].tag[0]`

For reference, see the [main list of fields for home listings](reference/product-catalog/home_listings.md#Creating).

## Vehicles

* `title`
* `description`  
* `price`
*  `sale_price`
* `url`
* `image[0].url, image[0].tag[0]`

For reference, see the [main list of fields for vehicles](auto-ads/guides/catalog.md#vehicle).
