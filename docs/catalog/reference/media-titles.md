---
title: "Media Titles"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/reference/media-titles"
scraped_at: "2026-09-12T19:03:07.676Z"
---

# Media Titles



The Media Title API allows you to manage streaming media content items (movies, TV shows, music) in a product catalog. You can read, update, and delete individual media title items using the `/{media-title-id}` node.

## Permissions

To use this API, your app needs the following permission:

* `catalog_management`

## Reading {#reading}

To retrieve a media title item, send a `GET` request:

```
GET /v25.0/{media-title-id} HTTP/1.1
Host: graph.facebook.com
```

### Fields {#reading-fields}

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | Yes | A unique content ID for the item. Each content ID must appear only once in your catalog. To run Advantage+ catalog ads, this ID must exactly match the content ID for the same product in your Meta Pixel code. Character limit: 100. |
| `retailer_id` | string | Yes | Retailer-provided unique identifier for the media title. |
| `name` | string | Yes | The title of the product. Shown in ads. Character limit: 200. See [title specifications](https://www.facebook.com/business/help/2104231189874655). |
| `description` | string | No | A short and relevant description of the product such as a plot summary for a movie. Shown in ads. Use plain text and don't enter text in all capital letters. Character limit: 9999. See [description specifications](https://www.facebook.com/business/help/2302017289821154). |
| `image_url` | string | Yes | The URL for the main image of your product. Shown in ads. Must be in a supported format (JPG/PNG) and at least 500 x 500 pixels. See [image specifications](https://www.facebook.com/business/help/686259348512056). |
| `url` | string | Yes | The link to the specific product page on your business's website, where people can learn more about or buy this item. Links must begin with `http://` or `https://`. |
| `price` | string | No | The individual price of the media. Shown in ads. Do not enter a subscription price. Format the price as a number followed by the 3-letter currency code (ISO 4217 standards). Use a period (`.`) as the decimal point, do not use commas. |
| `sale_price` | string | No | The discounted price of the media if it's on sale. Format the price as a number followed by the 3-letter currency code (ISO 4217 standards). Use a period (`.`) as the decimal point, do not use commas. A sale price is required if you want to use an overlay for discounted prices. |
| `currency` | string | No | ISO 4217 currency code for the price. |
| `brand` | string | No | The streaming service or platform where this product is available. Character limit: 100. |
| `media_category` | enum | No | The content category of the product. Used to recommend your products to the right audiences. Values: `Movie`, `Music`, `TV Show`, `Other`. |
| `genre` | array<string> | No | The media genre such as action or comedy. Used to recommend your products to the right people. Character limit: 200. |
| `content_rating` | string | No | Official rating of a media title. Can be shown in ads. Required for restricted audiences in our [Advertising policies](https://www.facebook.com/policies/ads). |
| `release_date` | string | No | The release date of the product. Use the format `YYYY-MM-DD`. |
| `director` | array<string> | No | A director of a production like a movie or radio show. Character limit: 200. |
| `actor` | array<string> | No | An actor in a production such as a movie or TV show. Character limit: 200. |
| `award` | array<string> | No | Any notable awards or nominations. Character limit: 200. |
| `featuring` | array<string> | No | The names of key individuals involved in the production of the media title such as artists or producers. Character limit: 200. |
| `production_company` | array<string> | No | The production company or studio that created the product. Character limit: 200. |
| `duration` | string | No | The duration of the product. Use the format `HH-MM-SS` (ISO 8601 standard). For example: `02-34-15`. |
| `global_unique_identifier` | string | No | Any identifier that represents a work of film or television. For example: EIDR (Entertainment Identifier Registry). |
| `tags` | array<string> | No | Tags for product organization. |
| `additional_image_urls` | array<string> | No | Additional image URLs for the media title beyond the primary image. You can add up to 20 images. |
| `video_urls` | array<string> | No | URLs for videos of your product. Videos can be shown in ads and make your ads more engaging. Must be a direct link to download the video file. You can add up to 20 videos. |
| `custom_label_0` through `custom_label_4` | string | No | Any relevant information you want to add to your ad creative such as in the headline. |
| `custom_number_0` through `custom_number_4` | integer | No | Any number you want to filter products by when you create product sets. Use this to filter by number ranges (is greater than and is less than). Use whole numbers between 0 and 4294967295. Decimals and commas are not supported. |
| `applink_ios_url` | string | No | A deep link to your app on iOS. Used to send people from your ads to your app, if installed. If it isn't installed, redirects to your website or the App Store. |
| `applink_ios_app_store_id` | integer | No | iOS App Store ID for the app. |
| `applink_ios_app_name` | string | No | Name of the iOS app. |
| `applink_android_url` | string | No | A deep link to your app on Android. Used to send people from your ads to your app, if installed. If it isn't installed, redirects to your website or Google Play. |
| `applink_android_package` | string | No | Android package name (e.g., `com.example.app`). |
| `applink_android_class` | string | No | Android activity class name. |
| `applink_android_app_name` | string | No | Name of the Android app. |

## Creating {#creating}

To create media title items in a catalog, you can use:

* [Product Feed](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed#Creating) — upload items using a scheduled data feed.
* [Items Batch API](reference/product-catalog/items_batch.md) — create or update items in bulk using the API.
* [Product Catalog Media Titles edge](catalog/reference/media-titles/catalog-edge.md) — create items individually using the API.

## Updating {#updating}

To update a media title item, send a `PUT` request with the fields you want to change:

```
PUT /v25.0/{media-title-id} HTTP/1.1
Host: graph.facebook.com
Content-Type: application/json

{
  "name": "Updated Title",
  "description": "A thrilling action movie",
  "image_url": "https://example.com/image.jpg"
}
```

All fields are optional for partial updates. The API updates only the fields included in the request body.

### Update parameters {#updating-params}

| Field | Type | Description |
| --- | --- | --- |
| `name` | string | Name of the media title. |
| `description` | string | Description of the media title. |
| `image_url` | string | URL of the primary image for the media title. |
| `url` | string | URL where the media title can be viewed or purchased. |
| `price` | integer | Price in the smallest currency unit (e.g., cents). |
| `sale_price` | integer | Sale price in the smallest currency unit. |
| `currency` | string | ISO 4217 currency code for the price. |
| `brand` | string | Brand name of the media title. |
| `media_category` | string | Media category classification. |
| `genre` | array<string> | List of genres. Max 30 items. |
| `content_rating` | string | Official content rating (e.g., PG-13, R, TV-MA). |
| `release_date` | string | Release date of the media title. |
| `director` | array<string> | List of directors. Max 30 items. |
| `actor` | array<string> | List of actors. Max 30 items. |
| `award` | array<string> | List of awards received. Max 30 items. |
| `featuring` | array<string> | List of featured artists or guests. Max 30 items. |
| `production_company` | array<string> | List of production companies. Max 30 items. |
| `duration` | string | Duration of the media title (e.g., 120 min, PT2H). |
| `global_unique_identifier` | string | Global unique identifier (e.g., EIDR, ISAN). |
| `tags` | string | Comma-separated tags for product organization (e.g., `"label1,label2"`). |
| `additional_image_urls` | array<string> | Additional image URLs for the media title. |
| `video_urls` | array<string> | Video URLs. Max 20 items. |
| `custom_label_0` through `custom_label_4` | string | Custom label fields. |
| `custom_number_0` through `custom_number_4` | integer | Custom number fields. |

### Update response {#updating-response}

```
{
  "success": true
}
```

## Deleting {#deleting}

To delete a media title item, send a `DELETE` request:

```
DELETE /v25.0/{media-title-id} HTTP/1.1
Host: graph.facebook.com
```

### Delete response {#deleting-response}

```
{
  "success": true
}
```
