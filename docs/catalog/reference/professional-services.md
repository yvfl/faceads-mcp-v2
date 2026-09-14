---
title: "Professional Services"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/reference/professional-services"
scraped_at: "2026-09-12T19:03:11.234Z"
---

# Professional Services



The Professional Services API allows you to manage service catalog items such as consulting, home services, health and wellness, and other professional services. You can read and update individual items using the `/{professional-services-id}` node.

## Permissions

To use this API, your app needs the following permission:

* `catalog_management`

## Reading {#reading}

To retrieve a professional services item, send a `GET` request:

```
GET /v25.0/{professional-services-id} HTTP/1.1
Host: graph.facebook.com
```

### Fields {#reading-fields}

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | Yes | A unique content ID for the product. Each content ID must appear only once in your catalog. To run Advantage+ catalog ads, this ID must exactly match the content ID for the same product in your Meta Pixel code. Character limit: 100. |
| `retailer_id` | string | Yes | Retailer-provided unique identifier for the service item. |
| `name` | string | Yes | The name of the service. Shown in ads. Character limit: 200. See [title specifications](https://www.facebook.com/business/help/2104231189874655). |
| `description` | string | No | A short and relevant description of the service. Shown in ads. Use plain text and don't enter text in all capital letters. Character limit: 9999. See [description specifications](https://www.facebook.com/business/help/2302017289821154). |
| `image_url` | string | Yes | The URL for the main image of your service. Shown in ads. Must be in a supported format (JPG/PNG) and at least 500 x 500 pixels. See [image specifications](https://www.facebook.com/business/help/686259348512056). |
| `url` | string | Yes | The link to the specific service page on your business's website where people can learn more about or book this service. Links must begin with `http://` or `https://`. |
| `price` | string | No | The price of the service. Shown in ads. Format the price as a number followed by the 3-letter currency code (ISO 4217 standards). Use a period (`.`) as the decimal point, do not use commas. |
| `sale_price` | string | No | The discounted price of the service if it's on sale. Format the price as a number followed by the 3-letter currency code (ISO 4217 standards). Use a period (`.`) as the decimal point, do not use commas. A sale price is required if you want to use an overlay for discounted prices. |
| `currency` | string | No | ISO 4217 currency code for the price. |
| `brand` | string | No | The brand associated with the service. Character limit: 100. |
| `service_category` | string | No | Type of service offered (for example, consulting, cleaning, home services). Used to recommend your service to the right people. |
| `hours_available` | array<string> | No | Hours during which the service is available. Use the format from the OpeningHoursSpecification standard (for example, `["Mo-Fr 08:00-18:00", "Sa 10:00-15:00"]`). |
| `duration` | string | No | Typical length of a service session (for example, "2 hours"). |
| `award` | array<string> | No | Any notable awards won by the service or provider. Character limit: 200. |
| `has_certification` | array<string> | No | Certification information about the service or organization. |
| `user_rating` | float | No | The average user rating of the service. Enter a rating between 0.0 and 5.0, using a single decimal place. Can be shown in ads. |
| `rating_count` | integer | No | The number of users who have left ratings on the service. Can be shown in ads. |
| `address` | object | No | Address of the service location. Contains the following sub-fields: `street_address`, `city`, `region`, `country`, `postal_code`, `latitude`, `longitude`, `neighborhoods` (array). |
| `availability_circle_origin` | object | No | The center point of a circular service area. Contains `latitude` and `longitude` sub-fields. Use with `availability_circle_radius` and `availability_circle_radius_unit`. |
| `availability_circle_radius` | float | No | Radius of the circular service area. Use with `availability_circle_origin` and `availability_circle_radius_unit`. |
| `availability_circle_radius_unit` | enum | No | Unit for the availability radius. Supported values:<br><br>* `km`<br>* `mi` |
| `availability_polygon_coordinates` | array<object> | No | Ordered lat/lng pairs tracing the perimeter of a polygonal service area. Each object contains `latitude` and `longitude` sub-fields. |
| `availability_postal_codes` | array<string> | No | Postal codes where the service is available. |
| `tags` | array<string> | No | Tags for product organization. |
| `additional_image_urls` | array<string> | No | Additional image URLs for the service beyond the primary image. You can add up to 20 images. |
| `video_urls` | array<string> | No | URLs for videos of your service. Videos can be shown in ads and make your ads more engaging. Must be a direct link to download the video file. You can add up to 20 videos. |
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

To create professional services items in a catalog, you can use:

* [Product Feed](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed#Creating) — upload items via a scheduled data feed.
* [Items Batch API](reference/product-catalog/items_batch.md) — create or update items in bulk via the API.
* [Product Catalog Professional Services edge](catalog/reference/professional-services/catalog-edge.md) — create items individually via the API.

## Updating {#updating}

To update a professional services item, send a `PUT` request with the fields you want to change:

```
PUT /v25.0/{professional-services-id} HTTP/1.1
Host: graph.facebook.com
Content-Type: application/json

{
  "name": "Premium Home Cleaning",
  "description": "Professional deep cleaning for homes and apartments",
  "price": "150.00 USD",
  "service_category": "Home Services",
  "duration": "3 hours"
}
```

All fields are optional for partial updates. The API updates only the fields you include in the request body.

For the full list of updatable fields, see the [Fields](#reading-fields) section above.

### Response {#updating-response}

```
{
  "success": true
}
```

## Deleting {#deleting}

To delete a professional services item, send a `DELETE` request:

```
DELETE /v25.0/{professional-services-id} HTTP/1.1
Host: graph.facebook.com
```

### Response {#deleting-response}

```
{
  "success": true
}
```
