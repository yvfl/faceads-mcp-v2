---
title: "Product Deep Links"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/guides/product-deep-links"
scraped_at: "2026-09-12T19:02:32.110Z"
---

# Product Deep Links



Provide deep links in your feed following the [App Links](https://developers.facebook.com/docs/applinks) specification. Deep link information in your feed takes precedence over any information Facebook collects with App Links metadata with our web crawler.

If you already have deep link information from App Links, you don't need to specify this data. Facebook uses information from App Links to display the correct deep link. To display deep links in your ads, see [Advantage+ Catalog Ads, Ad Template](https://developers.facebook.com/documentation/ads-commerce/marketing-api/dynamic-product-ads/ads-management#adtemplate).

For iOS, only provide iPhone **or** iPad app information if they are different from the general iOS app.

Use a [product group](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-group) to group all [product variants](catalog/guides/product-variants.md). A product group identifies products that are almost identical but have variations such as color, material, size, or pattern. Product groups make it easier to advertise additional colors, styles, or patterns for a particular product. All products in a product group share the same `item_group_id`. In Advantage+ catalog ads, we pick only one item out of the group based on the signal we received from the pixel or app.

**Warning:** For the suggested formats for scheduling data feeds, see the [CSV and TSV sample files](catalog/reference.md#feed-format-use-case) on the catalog reference page.

| Name | Description | Required |
| --- | --- | --- |
| `applink.android_app_name` | The name of the Android app for display.  For example, `Electronic Android`. | No |
| `applink.android_package` | The fully-qualified package name for intent generation.  For example, `com.electronic`. | No |
| `applink.android_url` | The [custom URL scheme](https://developers.facebook.com/docs/android/deep-linking#support-custom-url-schemes-in-your-mobile-app) or [Android App Link](https://developers.facebook.com/docs/android/deep-linking#android-app-links) for your Android app.  For example, `android://electronic` or `https://www.example.com/path/to/component/android`. | No |
| `applink.ios_app_name` | The name of the iOS app for display.  For example, `Electronic iOS`. | No |
| `applink.ios_app_store_id` | The iOS App ID for the App Store.  For example, `1234`. | No |
| `applink.ios_url` | The [custom URL scheme](https://developers.facebook.com/docs/ios/deep-linking#support-custom-url-schemes-in-your-mobile-app) or [Universal Link](https://developers.facebook.com/docs/ios/deep-linking#support-ios-universal-links) for your iOS app.  For example, `ios://electronic` or `https://www.example.com/path/to/component/ios`. | No |
| `applink.ipad_app_name` | The name of the iPad app for display.  For example, `Electronic iPad`. | No |
| `applink.ipad_app_store_id` | The iPad App ID for the App Store.  For example, `9010`. | No |
| `applink.ipad_url` | The [custom URL scheme](https://developers.facebook.com/docs/ios/deep-linking#support-custom-url-schemes-in-your-mobile-app) or [Universal Link](https://developers.facebook.com/docs/ios/deep-linking#support-ios-universal-links) for your iPad app.  For example, `ipad://electronic` or `https://www.example.com/path/to/component/ipad`. | No |
| `applink.iphone_app_name` | The name of the iPhone app for display.  For example, `Electronic iPhone`. | No |
| `applink.iphone_app_store_id` | The iPhone App ID for the App Store.  For example, `5678`. | No |
| `applink.iphone_url` | The [custom URL scheme](https://developers.facebook.com/docs/ios/deep-linking#support-custom-url-schemes-in-your-mobile-app) or [Universal Link](https://developers.facebook.com/docs/ios/deep-linking#support-ios-universal-links) for your iPhone app.  For example, `iphone://electronic` or `https://www.example.com/path/to/component/iphone`. | No |
| `applink.windows_phone_app_name` | The name of the Windows app for display.  For example, `Electronic Windows`. | No |
| `applink.windows_phone_app_id` | The Windows App ID for the app store, as a GUID.  For example, `ee728e01-7727-4168-9c8f-85c7eef40112`. | No |
| `applink.windows_phone_url` | The custom URL scheme for your Windows Phone app.  For example, `windows://electronic`. | No |
