---
title: "Activities"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/reference/activities"
scraped_at: "2026-09-12T19:02:56.545Z"
---

# Activities



The Activities API allows you to manage catalog items such as concerts, sporting events, guided tours, and other bookable activities. You can read, update, and delete individual items using the `/{activity-id}` node.

## Permissions

To use this API, your app needs the following permission:

* `catalog_management`

## Reading {#reading}

To retrieve an activity item, send a `GET` request:

```
GET /v25.0/{activity-id} HTTP/1.1
Host: graph.facebook.com
```

### Fields {#reading-fields}

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | Yes | A unique content ID for the activity. Each content ID must appear only once in your catalog. To run Advantage+ catalog ads, this ID must exactly match the content ID for the same activity in your Meta Pixel code. Character limit: 100. |
| `retailer_id` | string | Yes | Retailer-provided unique identifier for the activity item. |
| `name` | string | Yes | A specific and relevant title for the activity. Shown in ads. Character limit: 200. See [title specifications](https://www.facebook.com/business/help/2104231189874655). |
| `description` | string | Yes | A short and relevant description of the activity. Shown in ads. Use plain text and don't enter text in all capital letters. Character limit: 9999. See [description specifications](https://www.facebook.com/business/help/2302017289821154). |
| `image_url` | string | Yes | The URL for the main image of your activity. Shown in ads. Must be in a supported format (JPG/PNG) and at least 500 x 500 pixels. See [image specifications](https://www.facebook.com/business/help/686259348512056). |
| `url` | string | Yes | The link to the specific page on your business's website where people can learn more about or book this activity. Links must begin with http:// or https://. |
| `price` | string | No | The price of the activity. Shown in ads. Format the price as a number followed by the 3-letter currency code (ISO 4217 standards). Use a period (.) as the decimal point. Do not use commas. |
| `sale_price` | string | No | The discounted price of the activity if it's on sale. Format the price as a number followed by the 3-letter currency code (ISO 4217 standards). Use a period (.) as the decimal point. Do not use commas. A sale price is required if you want to use an overlay for discounted prices. |
| `currency` | string | No | ISO 4217 currency code for the price. |
| `brand` | string | No | The name of the activity provider, organizer, or seller. Character limit: 100. |
| `activity_category` | string | No | The type of activity. Used to recommend your content to the right people. Supported values: Comedy, Concert, Conference, Sports, Theater, Tour, Transfer, Other. |
| `activity_sub_categories` | array<string> | No | A more specific subcategory of the activity, such as Rock or Pop for concerts, or Football or Cricket for sports. Use commas to separate multiple entries. Character limit: 100. |
| `activity_date` | string | No | The scheduled date when the activity will take place. For one-off activities only. Use the format YYYY-MM-DD. |
| `performers` | array<string> | No | The main performers, speakers or guides for the activity, such as a musician or actor. Use commas to separate multiple names. Character limit: 200. |
| `user_rating` | float | No | The average user rating of the activity. Enter a rating between 0.0 and 5.0, using a single decimal place. Can be shown in ads. |
| `rating_count` | integer | No | The number of users who have left ratings on the activity. Can be shown in ads. |
| `location_names` | array<string> | No | The name of the venue or location where the activity takes place. Use commas to separate multiple locations. Character limit: 200. |
| `in_languages` | array<string> | No | The language of the content or performance. Use language codes from the ISO 639 standard. Use commas to separate multiple entries. |
| `address` | object | No | Address of the activity location. Contains the following sub-fields: city, country. |
| `availability_circle_origin` | object | No | The center point of a circular availability area. Contains latitude and longitude sub-fields. Use with availability_circle_radius and availability_circle_radius_unit. |
| `availability_circle_radius` | float | No | Radius of the circular availability area. Minimum: 1 km or 0.6 mi, maximum: 255 km or 158.4 mi. Use with availability_circle_origin and availability_circle_radius_unit. Only one area type (circle, polygon, or postal codes) should be defined per product. |
| `availability_circle_radius_unit` | enum | No | The unit of distance for the availability radius, in kilometres (km) or miles (mi). Supported values: km, mi. Use with availability_circle_origin and availability_circle_radius. |
| `availability_polygon_coordinates` | array<object> | No | Ordered lat/lng pairs tracing the perimeter of a polygonal availability area. Each object contains latitude and longitude sub-fields. |
| `availability_postal_codes` | array<string> | No | Postal codes where the activity is available. |
| `status` | string | No | Controls whether the activity is active or archived in your catalog. Only active items can be shown to people in your ads, shops, or other channels. Supported values: active, archived. Items are active by default. This field was previously called `visibility`. |
| `tags` | array<string> | No | Tags for product organization. |
| `additional_image_urls` | array<string> | No | Additional image URLs for the activity beyond the primary image. You can add up to 20 images. |
| `video_urls` | array<string> | No | URLs for videos of your activity. Videos can be shown in ads and make your ads more engaging. Must be a direct link to download the video file. You can add up to 20 videos. |
| `custom_label_0 through custom_label_4` | string | No | Any relevant information you want to add to your ad creative such as in the headline. |
| `custom_number_0 through custom_number_4` | integer | No | Any number you want to filter products by when you create product sets. Use this to filter by number ranges (is greater than and is less than). Use whole numbers between 0 and 4294967295. Decimals and commas are not supported. |
| `applink_ios_url` | string | No | A deep link to your app on iOS. Used to send people from your ads to your app, if installed. If it isn't installed, redirects to your website or the App Store. |
| `applink_ios_app_store_id` | integer | No | The unique numeric identifier for the app on the Apple App Store. |
| `applink_ios_app_name` | string | No | The official name of the app as it appears on the Apple App Store. |
| `applink_android_url` | string | No | A deep link to your app on Android. Used to send people from your ads to your app, if installed. If it isn't installed, redirects to your website or Google Play. |
| `applink_android_package` | string | No | The unique package identifier for the Android app. |
| `applink_android_class` | string | No | Android activity class name. |
| `applink_android_app_name` | string | No | The official name of the app as it appears on the Google Play Store. |

## Creating {#creating}

To create activity items in a catalog, you can use:

* [Product Feed](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed#Creating) — upload items via a scheduled data feed.
* [Items Batch API](reference/product-catalog/items_batch.md) — create or update items in bulk via the API.
* [Product Catalog Activities edge](catalog/reference/activities/catalog-edge.md) — create items individually via the API.

## Updating {#updating}

To update an activity item, send a `PUT` request with the fields you want to change:

```
PUT /v25.0/{activity-id} HTTP/1.1
Host: graph.facebook.com
Content-Type: application/json

{
  "name": "Jasper's City Highlights Tour",
  "description": "Discover the city's most iconic landmarks on a guided walking tour with an expert local guide. Suitable for all ages.",
  "activity_category": "Tour",
  "performers": "Alex Smith,Jordan Lee",
  "activity_date": "2026-09-15"
}
```

All fields are optional for partial updates. Only the fields included in the request body will be updated.

For the full list of updatable fields, see the [Fields](#reading-fields) section above.

### Response {#updating-response}

```
{
  "id": "ACT-001"
}
```

## Deleting {#deleting}

To delete an activity item, send a `DELETE` request:

```
DELETE /v25.0/{activity-id} HTTP/1.1
Host: graph.facebook.com
```

### Response {#deleting-response}

```
{
  "id": "ACT-001"
}
```
