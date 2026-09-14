---
title: "Localized Catalog Setup"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/localized-catalog/localized-catalog-setup"
scraped_at: "2026-09-12T19:02:49.163Z"
---

# Localized Catalog Setup



Use this guide to set up your catalog for localization. See also how to [Set Up a Catalog for Multiple Languages and Countries, Ads Help Center](https://www.facebook.com/business/help/2144286692311411?id=725943027795860).

## Requirements

* You must create a language or country **override data feed** that will contain only the fields (with values) you wish to change.
* You must include an `id` field in your _override data feed_. The `id` for each item must match an `id` in one of your main catalog data feeds and/or the content ID from your pixel.
* You must include an `override` field.
    * For a country override feed, enter the ISO codes of the countries for which you want to provide localized information. The value in the 'override' column should be a [supported ISO country code](https://www.facebook.com/business/help/2144286692311411). (see also [standard ISO country codes](https://www.iso.org/obp/ui/#search).)
    * For a language override feed, enter the ISO codes of the languages for which you want to provide localized information. The value in the `override` column should be a [supported ISO language code](https://www.facebook.com/business/help/2144286692311411). (see also [standard ISO language codes](https://www.iso.org/iso-639-language-codes.html).)
* You can only localize (override) specific fields, not all of them. See [Supported Fields — Localized Catalogs](catalog/reference.md#loc-cat-fields) for a list of supported catalog fields.
* Make sure that product images satisfy catalog [requirements](https://www.facebook.com/business/help/686259348512056).  
* Make sure that product titles satisfy catalog [requirements](https://www.facebook.com/business/help/2104231189874655?id=663946777378466).
* Make sure that product descriptions satisfy catalog [requirements](https://www.facebook.com/business/help/2302017289821154?id=663946777378466).

## Recommendations
As you plan your catalog setup, we ask that you follow these recommendations:

* Although you can include multiple languages in a language feed and multiple countries in a country feed, we recommend that you create your country and language feeds separately.
* If you have a large catalog (over 100k items), you must create one data feed per language or country.
* If you are creating a language feed and a country feed, we recommend that the fields included in each feed be unique to that feed type. For example, do not specify product name in both the language feed and the country feed
* For products (ecommerce), we recommend that you include `title` and `description` in your **language feed** and include `price`, `sale_price`, `sale_price_effective_date`, `availability`, and `link` in your **country feed**.
* As examples, we provide a [language override template](https://lookaside.facebook.com/developers/resources/?id=catalog_language_feed_template.csv) and a [country override template](https://lookaside.facebook.com/developers/resources/?id=catalog_country_feed_template.csv).

### See also
* [Supported Fields — Localized Catalogs](catalog/reference.md#loc-cat-fields)  
* [Feed Formats - Country and Language](#feed-formats)
* [Supported Feed Formats and CSV templates - Catalog](catalog/reference.md#feed-format)

## Step 1: Create Language and Country Feeds

### Feed Types

You can provide localized properties for your catalog items, using additional types of feeds.

| Feed Type | Description | Example |
| --- | --- | --- |
| Country Feed | Contains overrides for specified countries. You can create and upload country feeds using the Commerce Manager or [via the API](#upload-via-api).<br>See [supported feed format](#feed-format-country). | An item can have different prices in different countries. |
| Language Feed | Contains translations for specific fields. You can create and upload language feeds using the Commerce Manager or [via the API](#upload-via-api). See [supported feed format](#feed-format-lang). | An item can have different descriptions in different languages. |
| Language and Country Feed | Intended for advanced use cases where a country feed or language feed is not enough to describe the localization of your items. A language and country feed should only be used for fields that are absolutely necessary.<br><br>You can only create a language and country feed via the API, but you can modify and upload the feed from the Commerce Manager or [via the API](#upload-via-api). The Commerce Manager provides details about each country and language setup.<br><br>**Note**: To localize a field for both language and country, the value in the `override` column should be a [supported ISO language code](https://www.facebook.com/business/help/2144286692311411) and a [supported ISO country code](https://www.facebook.com/business/help/2144286692311411), separated by a '\|' character, for example, `en_XX\|US` | Your product URLs may depend on both the viewer language and country.<br><br>For example: http://www.mysite.com/ca/item12345?lang=fr  <br>_Or_  <br>http://www.mysite.com/ca/fr/item12345<br><br>You can define localized fields for a limit of 350 language and country pairs, per catalog item. |

### Feed Formats {#feed-formats}
#### Country Feed {#feed-format-country}

**Example CSV** — This feed contains country localizations for the United Kingdom (`GB`) and Italy (`IT`).

```csv
id; override; price; link; delete
FB_product_1234; GB; 9.00 GBP; http://www.example.com/en_GB/FB_product_1234; false
FB_product_1234; IT; 10.49 EUR; http://www.example.com/it_IT/FB_product_1234; false
```

**Warning:** `price`, `sale_price`, `unit_price`, `base_price`, `status` (visibility), and `availability` must only be provided in a country feed. These fields cannot be provided in a language feed. This helps ensure customers see the correct localized product data.

#### Language Feed {#feed-format-lang}

**Example CSV** — This feed contains language localizations for French (`fr_XX`) and English (`en_XX`).

```csv
id; override; description; title; delete
FB_product_1234; fr_XX; Le t-shirt American Apparel préféré de tous. Le t-shirt comporte une encolure ajustée de 3/4 pouce au cou, une bande épaule à épaule et un ourlet de 1 pouce sur les manches.; T-shirt Unisexe d'American Apparel; false
FB_product_1234; en_XX ; Everyone's favorite American Apparel T-shirt. The t-shirt features 3/4 inches set-in neck, shoulder to shoulder tape and 1 inch hem on sleeves.; American Apparel Unisex T-Shirt; false
```

#### Language and Country Feed {#feed-format-lang-ctry}

**Example** - This feed contains 'language and country' localizations for French speakers in the U.S. (`fr_XX|US`) and French speakers in Canada (`fr_XX|CA`).

```csv
id; override; url; delete
FB_product_1234; fr_XX|US; http://us.example.com/fr/product_1234; false
FB_product_1234; fr_XX|CA; http://ca.example.com/fr/product_1234; false
```

## Step 2: Check Your Feed - Order of Precedence

When selecting which localized information to show to a user, we check the feed contents in this order:

1. Language and country feed values for the user's spoken languages and home country
2. Language feed values for the user's spoken languages
3. Country feed values for user's home country

## Step 3: Upload Language and Country Feeds

Once you created your feeds, you can choose to upload them manually via Commerce Manager or via the API, as shown below.

### Upload the Feeds via the API {#upload-via-api}

1. Make your feeds available on your server.
2. Link the feeds to your catalog, using an additional `override_type` parameter.

#### Language Feed

**Example** - Upload a Language Feed

```
curl \
  -F 'name=Language feed' \
  -F 'schedule={
    "interval": "DAILY",
    "url": "http:\/\/www.example.com\/sample_language_feed.tsv",
    "hour": 22
  }' \
  -F 'override_type=language'
  -F 'access_token=<ACCESS_TOKEN>' \
  https://graph.facebook.com/<API_VERSION>/<CATALOG_ID>/product_feeds
```

#### Country Feed
**Example** — Upload a Country Feed

```
curl \
  -F 'name=Country Feed' \
  -F 'schedule={
    "interval": "DAILY",
    "url": "http:\/\/www.example.com\/sample_country_feed.tsv",
    "hour": 22
  }' \
  -F 'override_type=country'
  -F 'access_token=<ACCESS_TOKEN>' \
  https://graph.facebook.com/<API_VERSION>/<CATALOG_ID>/product_feeds
```

#### Language and Country Feed

**Example** - Upload the language and country feed

```
curl \
  -F 'name=language and country Feed' \
  -F 'schedule={
        "interval": "DAILY",
        "url": "http:\/\/www.example.com\/sample_language_and_country_feed.tsv",
        "hour": 22
      }' \
  -F 'override_type=language_and_country'
  -F 'access_token=<ACCESS_TOKEN>' \
  https://graph.facebook.com/<API_VERSION>/<CATALOG_ID>/product_feeds
```

**Parameters**

| Parameter | Value |
| --- | --- |
| `url` | Location where we can retrieve the feed file from |
| `interval` | Frequency at which we fetch the feed file |
| `hour` | Hour of the day (based on a 24-hr clock) when we fetch the feed |

## Step 4: Remove Country or Language Information for a Product (Optional)

To remove localized information from an item:

1. Specify a 'delete' column in your country or language feed.
2. Set the value to `true`.

The localization for that product is then removed.

**Warning:** **Note**: You may also `delete` items in your main item feed. When you delete a main item, **all** overrides are removed.

## Step 5: Verify Your Setup in Commerce Manager
Commerce Manager provides details about country and language fields information for each product in the **Items** > **Details** page.

You can also access the international coverage of your entire catalog in the **Items** tab > **International Coverage**.

## Learn More

### Ads Help Center
* [Set Up a Catalog for Multiple Languages and Countries, Ads Help Center](https://www.facebook.com/business/help/2144286692311411)
* [Create a Advantage+ Catalog Ad for Multiple Languages and Countries, Ads Help Center](https://www.facebook.com/business/help/2144286692311411?locale=en_US)
* List of [supported languages and countries](https://www.facebook.com/business/help/2144286692311411)
* List of [supported fields for localized catalogs](catalog/reference.md#loc-cat-fields)

### Instagram
* [Add Product Tags in Instagram Posts](https://help.instagram.com/2022466637835789)
* [Localized Catalog for Instagram Shopping](catalog/localized-catalog-ig.md)

### Marketing API - Catalog
* [Set Up a Catalog for Multiple Languages and Countries, Ads Help Center](https://www.facebook.com/business/help/2144286692311411?id=725943027795860)
* [Localized Catalogs, list of supported fields](catalog/reference.md#loc-cat-fields)
* [Build a Creative Template](https://developers.facebook.com/documentation/ads-commerce/marketing-api/dynamic-product-ads/ads-management#create-template)
* [Catalog, Marketing API](catalog.md)
* [Schedule Feeds](catalog/guides/scheduled-feeds.md)
* [Advantage+ Catalog Ads - Create Ads](https://developers.facebook.com/documentation/ads-commerce/marketing-api/dynamic-product-ads/ads-management)
* [Supported catalog fields](catalog/reference.md#supported-fields)

### ISO Standards
* [ISO country codes](https://www.iso.org/obp/ui/#search)
* [ISO language codes](https://www.iso.org/iso-639-language-codes.html)
