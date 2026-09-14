---
title: "Metadata Tags"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/guides/metadata-tags"
scraped_at: "2026-09-12T19:02:27.778Z"
---

# Metadata Tags



You can optionally set metadata tags in your product feed files. Setting these tags enables Facebook to attribute catalogs using this feed to your app. Once a catalog is attributed to your app, you don't need to include the metadata tags in subsequent feed uploads to that catalog.

Include the following elements as space-delimited comments at the top of TSV/CSV (tab-separated and comma-separated) feeds or inside a `metadata` tag in your XML feeds:

* `ref_application_id` — Your Facebook app ID
* `ref_asset_id` - ID that uniquely identifies this feed in your system

## Feed formats
| Feed Format | Description |
| --- | --- |
| CSV | Sample CSV Feed file with reference information inside the metadata tag.Download (Right-Click > Save Link As) |
| TSV | Sample TSV Feed file with reference information inside the metadata tag. Download (Right-Click > Save Link As) |
| RSS XML | Sample RSS XML Feed file with reference information inside the metadata tag. Download (Right-Click > Save Link As) |
| ATOM XML | Sample Atom XML Feed file with reference information inside the metadata tag. Download (Right-Click > Save Link As) |

#### Example - TSV feed format

```
# ref_application_id <YOUR_APP_ID>
# ref_asset_id <YOUR_ASSET_ID>
id  title  ios_url  ios_app_store_id  ios_app_name  android_url  android_package  android_app_name  windows_phone_url  windows_phone_app_id  windows_phone_app_name  description  google_product_category  product_type  link  image_link  condition  availability  price  sale_price  sale_price_effective_date  gtin  brand  mpn  item_group_id  gender  age_group  color  size  shipping  custom_label_0
DB_1  Dog Bowl In Blue  example-ios://electronic/db_1  123  Electronic Example iOS  example-android://electronic/db_1  com.electronic.example  Electronic Example Android  example-windows://electronic/db_1  64ec0d1b-5b3b-4c77-a86b-5e12d465edc0  Electronic Example Windows  Solid plastic Dog Bowl in marine blue color  Animals > Pet Supplies  Bowls & Dining > Food & Water Bowls  http://www.example.com/bowls/db-1.html  https://www.facebook.com/images/product_image_template.png?id=1  new  in stock  9.99 GBP        Example    DB_GROUP_1          UK::Standard:9.95 GBP  "Made in Waterford, IE"
...
```

#### Example - RSS XML feed format

```
...
<?xml version="1.0"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <metadata>
      <ref_application_id><YOUR_APP_ID></ref_application_id>
      <ref_asset_id><YOUR_ASSET_ID></ref_asset_id>
    </metadata>
  </channel>
</rss>
...
```

#### Example - ATOM XML feed format

```
...
<?xml version="1.0"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <feed>
    <metadata>
      <ref_application_id><YOUR_APP_ID></ref_application_id>
      <ref_asset_id><YOUR_ASSET_ID></ref_asset_id>
    </metadata>
  </feed>
</rss>
...
```
