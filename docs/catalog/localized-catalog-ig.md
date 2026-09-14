---
title: "Localized Catalog for Instagram Product Tagging"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/localized-catalog-ig"
scraped_at: "2026-09-12T19:02:37.292Z"
---

# Localized Catalog for Instagram Product Tagging



## Overview {#overview}

Use this guide to set up your localized catalog for Product Tagging with multiple languages and countries.

Your [catalog](catalog.md) is an object (or container) of information about your products where you upload your inventory.  

## How it Works

Meta provides localized catalog functionality, enabling you to set up your product catalog to show items in ads or shops for items in different countries. Localizing the currency, the price, and the translated name or description are common cases. You can also give a localized product URL to navigate the customer to your country or language-specific product website.

By adding localization information to your catalog, you can serve localized product information to the users based on their country or language; for example:

* From a single Instagram post — show English/USD to people in the U.S. and Italian/EUR to people in Italy.  See example below.
* Only show Instagram shopping tags in countries for which your catalog has pricing information.

## Set Up Your Localized Catalog

To set up your localized catalog for Instagram Shopping, we recommend to read:

* [Localized Catalog Setup](catalog/localized-catalog/localized-catalog-setup.md)
* [Localized Catalog for Advantage+ Catalog Ads](catalog/localized-catalog-da.md)
* [Set Up a Catalog for Multiple Languages and Countries, Ads Help Center](https://www.facebook.com/business/help/2144286692311411)

## Start Creating Instagram Shopping Posts

### Before You Start
* Work with your Instagram contact to confirm you have read our policy and accepted the Terms of Service (the standard agreement).
* Select a product catalog to use for your Instagram Shopping posts.
* [Add Product Tags](https://help.instagram.com/2022466637835789) in Instagram posts or stories, and share!
* Preview localized product information in Commerce Manager; see [Set Up a Catalog for Multiple Languages and Countries](https://www.facebook.com/business/help/2144286692311411).
* Locate your catalog by name and switch catalogs, if needed. In the Instagram app, tap **Settings** > **Shopping**.

### What You Can Expect

When you add products on Instagram, you can see the product information in your own country or language. Once the post is shared with your audience, they can view product information in their own country or language as you specified in your catalog setup. Language is determined by their phone or app language settings and their country is based on location.

### Who will see my Instagram Shopping tags?
If you have uploaded a country feed to your catalog or set your catalog's default country, via the **Settings** page in Commerce Manager, then your tags are only visible to people in the countries for which you have prices in your catalog.
For example, if you:

1. Choose US as the default country for your catalog
2. Upload USD prices in your main feed
3. Upload GBP prices in your UK override feed

Then:

* People in the US will see your tags with USD prices.
* People in the UK will see your tags with GBP prices.
* People in other countries will see your tags with USD prices.

Any items in your main feed are globally visible unless they have a corresponding override for a specific country.

**Warning:** Note that if you upload items in your main feed in multiple currencies, your items may appear in your tagged post in mixed currencies when globally visible.

## Best Practices
* Make sure that product images satisfy catalog [requirements](https://www.facebook.com/business/help/686259348512056).  
* Make sure that product titles satisfy catalog [requirements](https://www.facebook.com/business/help/2104231189874655?id=663946777378466).
* Make sure that product descriptions satisfy catalog [requirements](https://www.facebook.com/business/help/2302017289821154?id=663946777378466).

## Learn More
* For full details, see [Set Up a Catalog for Multiple Languages and Countries, Ads Help Center](https://www.facebook.com/business/help/2144286692311411)
* [Add Product Tags in Instagram Posts](https://help.instagram.com/2022466637835789)
* [Localized Catalog Setup](catalog/localized-catalog/localized-catalog-setup.md)
* [Localized Catalog for Advantage+ Catalog Ads](catalog/localized-catalog-da.md)
* [Create a Advantage+ Catalog Ad for Multiple Languages and Countries, Ads Help Center](https://www.facebook.com/business/help/2144286692311411?locale=en_US)
* [Build a Creative Template](https://developers.facebook.com/documentation/ads-commerce/marketing-api/dynamic-product-ads/ads-management#create-template)
* [Product Catalog, Marketing API](catalog.md)
* [Scheduled Feeds, Catalog](https://developers.facebook.com/documentation/ads-commerce/catalog/scheduled-feeds)
* [Supported Fields for Advantage+ Catalog Ads](catalog/reference.md#supported-fields)
* [Advantage+ Catalog Ads - Create Ads](https://developers.facebook.com/documentation/ads-commerce/marketing-api/dynamic-product-ads/ads-management)
