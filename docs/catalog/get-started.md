---
title: "Get Started"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/get-started"
scraped_at: "2026-09-12T19:01:55.635Z"
---

# Get Started



This guide explains how to enhance your catalog so customers can find and buy your items.

## Before you start

Before you start, review these recommendations and guidelines:

* If you manage multiple catalogs for different businesses or want an agency to access your catalogs, set up [Business Manager](https://business.facebook.com/home/accounts?business_id=117943258886315).

* The `catalog_management` permission grants your app the ability to create, read, update, and delete business-owned product catalogs of which the user is an admin. This permission grants access to related endpoints. By default, in developer mode your app can only access product catalogs that admins and developers of the app own. See [Catalog Management Reference](https://developers.facebook.com/docs/facebook-login/permissions#reference-catalog_management).

* For a commerce catalog, before buyers can purchase items from you, you'll need to upload your products information into a [catalog](https://developers.facebook.com/documentation/ads-commerce/commerce-platform/catalog/overview). Learn how to create a new ecommerce catalog using the [Commerce Manager](https://business.facebook.com/products/catalogs/new).

* To update your catalog, your app needs the `business_management` permission.

* To use the [Catalog Batch API](https://developers.facebook.com/documentation/ads-commerce/marketing-api/businessmanager/assets#product_catalog), you need the appropriate [Marketing API Access Level](get-started/authorization.md#limits) and must accept the [Terms of Service](https://business.facebook.com/legal/product_catalog_terms/) by creating your first catalog through [Business Manager](https://business.facebook.com). See [Catalog Reference](reference/product-catalog.md).

## Step 1: Set up your catalog feed

1. Set up your catalog feed using the [supported feed formats](https://developers.facebook.com/documentation/ads-commerce/commerce-platform/catalog/fields#supported-feed-formats). See also [supported feed formats](catalog/reference.md#feed-format), including [Google Sheets](catalog/reference.md#google-sheets) and [feed format to schedule feed fetches](catalog/reference.md#feed-format-use-case).

2. Add inventory to your catalog with a set of [universal attributes](https://developers.facebook.com/documentation/ads-commerce/commerce-platform/catalog/fields#universal-basic-attributes), then add [recommended attributes](https://developers.facebook.com/documentation/ads-commerce/commerce-platform/catalog/fields#universal-basic-attributes) or [additional attributes](https://developers.facebook.com/documentation/ads-commerce/commerce-platform/catalog/categories#additional-attributes) that are specific to the category of your items. See also [supported fields for Advantage+ catalog ads](catalog/reference.md#da-commerce).

**Warning:** To set up your catalog for localized shopping with multiple languages and countries, see [Localized Catalog Setup](catalog/localized-catalog/localized-catalog-setup.md), [Localized Catalog for Advantage+ Catalog Ads](catalog/localized-catalog-da.md), and [Localized Catalog for Instagram Shopping](catalog/localized-catalog-ig.md). See also [localized catalog supported fields](catalog/reference.md#loc-cat-fields).

Learn more about [how to use catalog fields](https://developers.facebook.com/documentation/ads-commerce/commerce-platform/catalog/fields#fields).

## Step 2: Choose a product category
Provide **at least one category** for your items to help customers understand what type of item you're selling:  

* [Google Product Category](https://developers.facebook.com/documentation/ads-commerce/commerce-platform/catalog/categories#google-prod-cat)
* [Facebook Product Category](https://developers.facebook.com/documentation/ads-commerce/commerce-platform/catalog/categories#fb-prod-cat)

**Warning:** If you use onsite checkout, provide one of these category types.

## Step 3: Schedule your feed upload
See [Schedule your feed uploads](catalog/guides/scheduled-feeds.md). For localized catalogs, see [Upload your feeds via the API](catalog/localized-catalog/localized-catalog-setup.md#upload-via-api).

## Learn more {#learn-more}

**About Catalog**

* [Catalogs, Ads Help Center](https://www.facebook.com/business/help/890714097648074?id=725943027795860)
* [How to Use Catalog Fields, Commerce](https://developers.facebook.com/documentation/ads-commerce/commerce-platform/catalog/fields#fields)
* [Supported Fields, Catalog](catalog/reference.md#supported-fields)
* [Universal Attributes](https://developers.facebook.com/documentation/ads-commerce/commerce-platform/catalog/fields#universal-basic-attributes)
* [Create a Data Feed File for Catalog Items](https://www.facebook.com/business/help/1898524300466211?id=725943027795860)
* [Data Feed Specifications for Catalogs](https://www.facebook.com/business/help/120325381656392?id=725943027795860)  
* [Google product category for catalog items](https://www.facebook.com/business/help/526764014610932)
* [Prepare and Set Up Catalog for Advantage+ Catalog Ads, Blueprint](https://www.facebookblueprint.com/student/path/219712?content_id=MRY0h11ihTBfj6p)
* [Live Training: Troubleshoot Catalog for Advantage+ Catalog Ads, Blueprint](https://www.facebookblueprint.com/student/page/549922-troubleshoot-catalog-for-advantage-catalog-ads?content_id=sh69r7qh1rswXYa)

**About Checkout**

* [About Checkout on Facebook and Instagram](https://www.facebook.com/business/help/2509359009104717?id=533228987210412)
* [Checkout on Facebook and Instagram](https://www.facebook.com/business/help/2509359009104717)

**Best Practices and Policies**

* [Best Practices, Commerce Catalog](catalog/best-practices.md)
* [FAQs: Advantage+ Catalog Ads](advantage-catalog-ads/faq.md)
* [Purchase Protection policies and requirements](https://www.facebook.com/policies/purchase_protection)
* [Google's product taxonomy](https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt)
* [Tax calculations](https://developers.facebook.com/documentation/ads-commerce/commerce-platform/best-practices/ship-fulfillment#tax-override-api)
