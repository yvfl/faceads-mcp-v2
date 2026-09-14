---
title: "Product Categories"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/guides/product-categories"
scraped_at: "2026-09-12T19:02:31.398Z"
---

# Product Categories



Providing high quality information about your products helps customers discover your items and make well-informed purchase decisions.

## When to Use Product Categories {#how-it-works}

A product category is a taxonomy that describes the specific type of items you sell. For example, **Apparel & Accessories > Clothing > Shirts & Tops**. There are two types of optional categories you can add for items in your catalog: Google product category (GPC) or Facebook product category (FPC).

In general, we recommend adding a GPC for each product. GPC may contribute to improving your ad performance and can be used to:

* Create product sets by filtering categories
* Determine whether items require a size (US only)
* Set up custom return windows per category (US only)

As an alternative, FPC can be used to:

* Determine whether items require a size (US only)
* Override the [tax category](https://www.facebook.com/business/help/1768310879858675) automatically assigned to an item by Meta (US only)

Learn more about [how to add a Google or Facebook product category for items in your catalog](https://www.facebook.com/business/help/526764014610932) (Help Center article).

**Note:** Product category is only relevant for products (ecommerce), not for other types of catalog inventory.

## Product Category Taxonomies

To enhance your catalog and help customers discover your items online, enter a [Google product category (GPC)](#google-prod-cat) or [Facebook product category (FPC)](#fb-prod-cat) for your items and then add more information specific to each category. FPC and GPC are taxonomies that organize items for sale into categories and subcategories. You can use FPC, GPC, or both. Provide the most specific category possible for each item.

### Google Product Category {#google-prod-cat}

The Google product category (GPC) (`google_product_category`) represents the item according to the [Google's product taxonomy](https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt).  

Use the category's taxonomy path or its category ID number, listed [here](https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt?fbclid=IwAR0US1k8zZOLliqA-fOM5pMQn3YcVU8-Vog-GpcYqqCqwMXxyiLt31aUYoo).

Example: `Apparel & Accessories > Clothing > Shirts & Tops` or `212`

### Facebook Product Category {#fb-prod-cat}

The Facebook product category represents the item according to the Facebook product taxonomy. This taxonomy organizes products for sale into categories and subcategories. For example, **Health & Beauty** > **Beauty** > **Makeup** > **Eye Makeup** > **Mascara**.

To provide a Facebook product category for your items:

1. Add the `fb_product_category` field in your data feed file.
2. In this field, enter a supported category from the list below. Facebook product categories are available in [multiple languages](https://www.facebook.com/business/help/526764014610932).
3. Download the list of categories in your language below; for example, **U.S. English ([Plain text (.txt)](https://www.facebook.com/products/categories/en_US.txt) \| [Spreadsheet (.csv)](http://facebook.com/products/categories/en_US.csv))**.

For each category, you can provide either the taxonomy path (such as **Health & Beauty** > **Beauty** > **Makeup** > **Eye Makeup** > **Mascara**) or the category ID number (such as **281**). Category names are not case sensitive.

When you provide a Facebook product category, you can also use additional fields specific to that category to provide more detailed information about your items.

## Tax Calculations {#tax-calculations}

We automatically assign a category to each item in your catalog based on its title, description and other details. Alternatively, you can provide a Facebook product category for each item yourself, which overrides our automatic category assignment. Tax rates and taxability for specific product categories vary based on state laws.

Learn more about how we determine [sales tax](https://www.facebook.com/business/help/1768310879858675) (Help Center article).

## Category-Specific Fields {#cat-spec-fields}

We recommend providing more information about your products to help customers discover your products and make purchase decisions.
**Note:** When using category-specific fields, sellers must provide a category identifier — a Google product category or a Facebook product category.

**Success:** The recommended category-specific fields are all optional. You can also use additional attributes by category.

| Recommended | Additional |
| --- | --- |
| [Apparel & Accessories](https://developers.facebook.com/documentation/ads-commerce/commerce-platform/catalog/categories/cloth-access#rec-cloth-access) | [Apparel & Accessories](https://developers.facebook.com/documentation/ads-commerce/commerce-platform/catalog/categories/cloth-access#add-cloth-access) |
| [Home](https://developers.facebook.com/documentation/ads-commerce/commerce-platform/catalog/categories/home#rec-home) | [Home](https://developers.facebook.com/documentation/ads-commerce/commerce-platform/catalog/categories/home#add-home) |
| [Jewelry & Watches](https://developers.facebook.com/documentation/ads-commerce/commerce-platform/catalog/categories/jewelry#rec-jewelry-watches) | [Jewelry & Watches](https://developers.facebook.com/documentation/ads-commerce/commerce-platform/catalog/categories/jewelry#add-jewelry-watches) |
| [Health & Beauty](https://developers.facebook.com/documentation/ads-commerce/commerce-platform/catalog/categories/health-beauty#rec-health-beauty) | [Health & Beauty](https://developers.facebook.com/documentation/ads-commerce/commerce-platform/catalog/categories/health-beauty#add-health-beauty) |
| [Electronics](https://developers.facebook.com/documentation/ads-commerce/commerce-platform/catalog/categories/electronics#rec-electronics) | [Electronics](https://developers.facebook.com/documentation/ads-commerce/commerce-platform/catalog/categories/electronics#add-electronics) |
| [Baby Products](https://developers.facebook.com/documentation/ads-commerce/commerce-platform/catalog/categories/baby#rec-baby-products) | [Baby Products](https://developers.facebook.com/documentation/ads-commerce/commerce-platform/catalog/categories/baby#add-baby-products) |

## Learn More

### Policies and Requirements
* [Purchase Protection policies and requirements](https://www.facebook.com/policies/purchase_protection)

### About Tax
* [Tax calculations](#tax-calculations)
* [About tax settings in Commerce Manager, Help Center](https://www.facebook.com/business/help/1768310879858675)

### Enhance Your Catalog
* [Best Practices, Commerce Catalog](catalog/best-practices.md)
* [How to Use Catalog Fields](https://developers.facebook.com/documentation/ads-commerce/commerce-platform/catalog/fields#fields)
* [Supported Fields, Catalog](catalog/reference.md#supported-fields)
* [Universal Attributes](https://developers.facebook.com/documentation/ads-commerce/commerce-platform/catalog/fields#universal-basic-attributes)
* [Create a Data Feed File for Catalog Items, Help Center](https://www.facebook.com/business/help/1898524300466211?id=725943027795860)
* [Data Feed Specifications for Catalogs, Help Center](https://www.facebook.com/business/help/120325381656392?id=725943027795860)
* [Checkout on Facebook and Instagram, Help Center](https://www.facebook.com/business/help/2509359009104717)

### Taxonomies and Categories
* [Google's product taxonomy](https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt)
* [Facebook product categories, in multiple languages](https://www.facebook.com/business/help/526764014610932)
* [Google product category for catalog items, Help Center](https://www.facebook.com/business/help/526764014610932)

### About Checkout
* [About Checkout on Facebook and Instagram, Business Help Center](https://www.facebook.com/business/help/2509359009104717?id=533228987210412)
