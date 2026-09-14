---
title: "Apps and Software"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/reference/apps-and-software"
scraped_at: "2026-09-12T19:02:59.948Z"
---

# Apps and Software



The Apps and Software API allows you to manage app and software catalog items such as mobile apps, desktop software, and games. You can read, update, and delete individual items using the `/{apps-and-software-id}` node.

## Permissions

To use this API, your app needs the following permission:

* `catalog_management`

## Reading {#reading}

To retrieve an app or software item, send a `GET` request:

```
GET /v25.0/{apps-and-software-id} HTTP/1.1
Host: graph.facebook.com
```

### Fields {#reading-fields}

The following table lists the fields of an app or software item.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | Yes | A unique content ID for the product. Each content ID must appear only once in your catalog. To run Advantage+ catalog ads, this ID must exactly match the content ID for the same product in your Meta Pixel code. Character limit: 100. |
| `retailer_id` | string | Yes | Retailer-provided unique identifier for the app or software item. |
| `name` | string | Yes | The name of the product. Shown in ads. Character limit: 200. See [title specifications](https://www.facebook.com/business/help/2104231189874655). |
| `description` | string | No | A short and relevant description of the product. Shown in ads. Use plain text and don't enter text in all capital letters. Character limit: 9999. See [description specifications](https://www.facebook.com/business/help/2302017289821154). |
| `image_url` | string | Yes | The URL for the main image of your product. Shown in ads. Must be in a supported format (JPG/PNG) and at least 500 x 500 pixels. See [image specifications](https://www.facebook.com/business/help/686259348512056). |
| `url` | string | Yes | The link to the specific product page on your business's website where people can learn more about or buy this product. Links must begin with `http://` or `https://`. |
| `price` | string | No | The individual price of the app or software. Shown in ads. Don't enter a subscription price. Format the price as a number followed by the 3-letter currency code (ISO 4217 standards). Use a period (`.`) as the decimal point. Don't use commas. |
| `sale_price` | string | No | The discounted price of the app or software if it's on sale. Format the price as a number followed by the 3-letter currency code (ISO 4217 standards). Use a period (`.`) as the decimal point. Don't use commas. A sale price is required if you want to use an overlay for discounted prices. |
| `currency` | string | No | ISO 4217 currency code for the price. |
| `brand` | string | No | The name of the publisher of the product. Character limit: 100. |
| `app_category` | enum | No | Type of application. Used to recommend your product to the right people. Supported values:<br><br>* `Games`<br>* `Productivity`<br>* `Social`<br>* `Entertainment`<br>* `Education`<br>* `Utilities`<br>* `Lifestyle`<br>* `Health & Fitness`<br>* `Business`<br>* `Other` |
| `app_subcategory` | string | No | Subcategory of the application, such as arcade game. Used to recommend your product to the right people. Character limit: 200. |
| `content_rating` | string | No | Official rating of a product. Can be shown in ads. Required for restricted audiences in our [Advertising policies](https://www.facebook.com/policies/ads). |
| `developer` | string | No | The name of the developer of the product. Character limit: 100. |
| `genre` | array<string> | No | The genre or style of the game or app, such as action or puzzle. Character limit: 200. |
| `user_rating` | float | No | The average user rating the application has. Enter a rating between 0.0 to 5.0, using a single decimal place. Can be shown in ads. |
| `rating_count` | integer | No | The number of users who have left ratings on the application. Can be shown in ads. |
| `operating_system` | array<enum> | No | The operating system or device on which the game or app can be used. Supported values:<br><br>* `iOS`<br>* `Android`<br>* `Windows`<br>* `macOS`<br>* `Linux`<br>* `Chrome OS`<br>* `Web`<br>* `Other` |
| `google_product_category` | string | No | The Google product category for the product. You must enter a supported category from the latest downloadable list available on our [Business Help Center](https://www.facebook.com/business/help/526764014610932). |
| `fb_product_category` | string | No | The Facebook product category for the product. You must enter a supported category from the latest downloadable list available on our [Business Help Center](https://www.facebook.com/business/help/526764014610932). |
| `tags` | array<string> | No | Tags for product organization. |
| `additional_image_urls` | array<string> | No | Additional image URLs for the product beyond the primary image. You can add up to 20 images. |
| `video_urls` | array<string> | No | URLs for videos of your product. Videos can appear in ads. Must be a direct link to download the video file. You can add up to 20 videos. |
| `custom_label_0` through `custom_label_4` | string | No | Any relevant information you want to add to your ad creative such as in the headline. |
| `custom_number_0` through `custom_number_4` | integer | No | Any number you want to filter products by when you create product sets. Use this to filter by number ranges (is greater than and is less than). Use whole numbers between 0 and 4294967295. Don't use decimals or commas. |
| `applink_ios_url` | string | No | A deep link to your app on iOS. Used to send people from your ads to your app, if installed. If it isn't installed, redirects to your website or the App Store. |
| `applink_ios_app_store_id` | integer | No | The unique numeric identifier for the app on the Apple App Store. |
| `applink_ios_app_name` | string | No | The official name of the app as it appears on the Apple App Store. |
| `applink_android_url` | string | No | A deep link to your app on Android. Used to send people from your ads to your app, if installed. If it isn't installed, redirects to your website or Google Play. |
| `applink_android_package` | string | No | The unique package identifier for the Android app. |
| `applink_android_class` | string | No | Android activity class name. |
| `applink_android_app_name` | string | No | The official name of the app as it appears on the Google Play Store. |

## Creating {#creating}

To create app or software items in a catalog, you can use:

* [Product Feed](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed#Creating) — upload items via a scheduled data feed.
* [Items Batch API](reference/product-catalog/items_batch.md) — create or update items in bulk via the API.
* [Product Catalog Apps and Software edge](catalog/reference/apps-and-software/catalog-edge.md) — create items individually via the API.

## Updating {#updating}

To update an app or software item, send a `PUT` request with the fields you want to change:

```
PUT /v25.0/{apps-and-software-id} HTTP/1.1
Host: graph.facebook.com
Content-Type: application/json

{
  "name": "Updated App Name",
  "description": "A powerful productivity app",
  "image_url": "https://example.com/app-icon.jpg"
}
```

All fields are optional for partial updates. The request updates only the fields you include in the request body.

For the full list of updatable fields, see the [Fields](#reading-fields) section above.

### Update response {#updating-response}

A successful update returns the following response:

```
{
  "success": true
}
```

## Deleting {#deleting}

To delete an app or software item, send a `DELETE` request:

```
DELETE /v25.0/{apps-and-software-id} HTTP/1.1
Host: graph.facebook.com
```

### Delete response {#deleting-response}

A successful deletion returns the following response:

```
{
  "success": true
}
```
