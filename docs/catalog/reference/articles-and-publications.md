---
title: "Articles and Publications"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/reference/articles-and-publications"
scraped_at: "2026-09-12T19:03:03.485Z"
---

# Articles and Publications



The Articles and Publications API allows you to manage catalog items such as ebooks, audiobooks, magazines, newspapers, and other written content. You can read, update, and delete individual items using the `/{articles-and-publications-id}` node.

## Permissions

To use this API, your app needs the following permission:

* `catalog_management`

## Reading {#reading}

To retrieve an article or publication item, send a `GET` request:

```
GET /v25.0/{articles-and-publications-id} HTTP/1.1
Host: graph.facebook.com
```

### Fields {#reading-fields}

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | Yes | A unique content ID for the product. Each content ID must appear only once in your catalog. To run Advantage+ catalog ads, this ID must exactly match the content ID for the same product in your Meta Pixel code. Character limit: 100. |
| `retailer_id` | string | Yes | Retailer-provided unique identifier for the article or publication item. |
| `name` | string | Yes | The title of the article or publication. Shown in ads. Character limit: 200. See [title specifications](https://www.facebook.com/business/help/2104231189874655). |
| `description` | string | No | A short summary or abstract of the article or publication. Shown in ads. Use plain text and don't enter text in all capital letters. Character limit: 9999. See [description specifications](https://www.facebook.com/business/help/2302017289821154). |
| `image_url` | string | Yes | The URL for the main image of your product. Shown in ads. Must be in a supported format (JPG/PNG) and at least 500 x 500 pixels. See [image specifications](https://www.facebook.com/business/help/686259348512056). |
| `url` | string | Yes | The link to the specific product page on your business's website where people can learn more about or purchase this product. Links must begin with `http://` or `https://`. |
| `price` | string | No | The individual price of the article or publication. Shown in ads. Do not enter a subscription price. Format the price as a number followed by the 3-letter currency code (ISO 4217 standards). Use a period (`.`) as the decimal point, do not use commas. |
| `sale_price` | string | No | The discounted price of the article or publication if it's on sale. Format the price as a number followed by the 3-letter currency code (ISO 4217 standards). Use a period (`.`) as the decimal point, do not use commas. A sale price is required if you want to use an overlay for discounted prices. |
| `currency` | string | No | ISO 4217 currency code for the price. |
| `brand` | string | No | The name of the publishing entity or platform. Character limit: 100. |
| `publication_category` | enum | No | The format of the publication. Used to recommend your product to the right people. Supported values:<br><br>* `Article`<br>* `Ebook`<br>* `Audiobook`<br>* `Blogpost`<br>* `Book`<br>* `Magazine`<br>* `Newspaper`<br>* `Report`<br>* `Whitepaper`<br>* `Journal`<br>* `Newsletter`<br>* `Other` |
| `date_published` | string | No | Date of first publication. Use the format `YYYY-MM-DD`. |
| `about` | string | No | The subject matter of the publication, such as news, sports, or lifestyle. Character limit: 200. |
| `genre` | array<string> | No | The genre(s) of the publication, such as mystery, biography, or science fiction. Character limit: 200. Max 30 items. |
| `in_language` | string | No | The language of the content. Use language codes from the ISO standard (e.g., `en`). |
| `author` | array<string> | No | The author(s) of the article or publication. Character limit: 200. Max 30 items. |
| `content_rating` | string | No | Official content rating of the article or publication (e.g., 8-12, 13+). Can be shown in ads. Required for restricted audiences in our [Advertising policies](https://www.facebook.com/policies/ads). |
| `award` | array<string> | No | Any notable awards or nominations for the article or publication. Character limit: 200. Max 30 items. |
| `global_unique_identifier` | string | No | Any identifier that represents the article or publication, such as an ISBN. |
| `user_rating` | float | No | The average user rating of the publication. Enter a rating between 0.0 and 5.0, using a single decimal place. Can be shown in ads. |
| `rating_count` | integer | No | The number of readers who have left ratings on the publication. Can be shown in ads. |
| `google_product_category` | string | No | The Google product category for the product. You must enter a supported category from the latest downloadable list available on our [Business Help Center](https://www.facebook.com/business/help/526764014610932). |
| `tags` | array<string> | No | Tags for product organization. |
| `additional_image_urls` | array<string> | No | Additional image URLs for the product beyond the primary image. You can add up to 20 images. |
| `video_urls` | array<string> | No | URLs for videos of your product. Videos can be shown in ads and make your ads more engaging. Must be a direct link to download the video file. You can add up to 20 videos. |
| `custom_label_0` through `custom_label_4` | string | No | Any relevant information you want to add to your ad creative such as in the headline. |
| `custom_number_0` through `custom_number_4` | integer | No | Any number you want to filter products by when you create product sets. Use this to filter by number ranges (is greater than and is less than). Use whole numbers between 0 and 4294967295. Decimals and commas are not supported. |
| `applink_ios_url` | string | No | A deep link to your app on iOS. Used to send people from your ads to your app, if installed. If it isn't installed, redirects to your website or the App Store. |
| `applink_ios_app_store_id` | integer | No | The unique numeric identifier for the app on the Apple App Store. |
| `applink_ios_app_name` | string | No | The official name of the app as it appears on the Apple App Store. |
| `applink_android_url` | string | No | A deep link to your app on Android. Used to send people from your ads to your app, if installed. If it isn't installed, redirects to your website or Google Play. |
| `applink_android_package` | string | No | The unique package identifier for the Android app. |
| `applink_android_class` | string | No | Android activity class name. |
| `applink_android_app_name` | string | No | The official name of the app as it appears on the Google Play Store. |

## Creating {#creating}

To create article or publication items in a catalog, you can use:

* [Product Feed](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed#Creating) — upload items via a scheduled data feed.
* [Items Batch API](reference/product-catalog/items_batch.md) — create or update items in bulk via the API.
* [Product Catalog Articles and Publications edge](catalog/reference/articles-and-publications/catalog-edge.md) — create items individually via the API.

## Updating {#updating}

To update an article or publication item, send a `PUT` request with the fields you want to change:

```
PUT /v25.0/{articles-and-publications-id} HTTP/1.1
Host: graph.facebook.com
Content-Type: application/json

{
  "name": "Updated Publication Title",
  "description": "An insightful guide to modern architecture",
  "image_url": "https://example.com/publication-cover.jpg"
}
```

All fields are optional for partial updates. Only the fields you include in the request body are updated.

For the full list of updatable fields, see the [Fields](#reading-fields) section above.

### Response {#updating-response}

```
{
  "success": true
}
```

## Deleting {#deleting}

To delete an article or publication item, send a `DELETE` request:

```
DELETE /v25.0/{articles-and-publications-id} HTTP/1.1
Host: graph.facebook.com
```

### Response {#deleting-response}

```
{
  "success": true
}
```
