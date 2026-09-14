---
title: "Microdata Tags"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/guides/microdata-tags"
scraped_at: "2026-09-12T19:02:28.730Z"
---

# Microdata Tags



[Microdata](https://en.wikipedia.org/wiki/Microdata_(HTML)) is an HTML specification used to nest metadata within existing content on webpages. Microdata uses a supporting vocabulary to describe an item and name-value pairs to assign values to its properties.

You can use microdata tags on your website to provide information about your products using a standardized format. We support these 3 formats:

* **[OpenGraph](#opengraph)** — Place the microdata in the `head` element of your website.
* **[Schema.org](#schema-org)** — Place the microdata across the product page where the products are located.
* **[JSON-LD for Schema.org](#json-ld)** — Place the microdata within the script tag (see the example below).

Depending on the type of protocol you choose, the microdata needs to be in the right location on your website.

**Note:** To test if your microdata tags are working, use this [microdata debugger tool](https://business.facebook.com/ads/microdata/debug).

**Warning:** If you update microdata on your website, your product information won't be updated in Commerce Manager until your pixel has fired at least once, meaning that someone has interacted with that item on your website. If the product doesn't receive any traffic on your website after you update its microdata, it won't be updated in your catalog.

## OpenGraph

Pixel-based catalogs use activity from your pixel to add products to your catalog. Before you can successfully add a product to your catalog, you first need to add required tags that include information about the product ("microdata") on its product page.
See [required and optional tags for OpenGraph](catalog/reference.md#og-tags).

**Warning:** Currently, only ecommerce catalogs can be created, leveraging the Facebook pixel.

**Example** - OpenGraph

```
<meta property="og:title" content="Facebook T-Shirt">
<meta property="og:description" content="Unisex Facebook T-shirt, Small">
<meta property="og:url" content="https://example.org/facebook">
<meta property="og:image" content="https://example.org/facebook.jpg">
<meta property="product:brand" content="Facebook">
<meta property="product:availability" content="in stock">
<meta property="product:condition" content="new">
<meta property="product:price:amount" content="7.99">
<meta property="product:price:currency" content="USD">
<meta property="product:retailer_item_id" content="facebook_tshirt_001">
<meta property="product:item_group_id" content="fb_tshirts">
```

## Schema.org {#schema-org}

See [required tags for Schema.org](catalog/reference.md#schema-og-required-tags).

**Example** - Schema.org

```
<div itemscope itemtype="http://schema.org/Product">
  <meta itemprop="brand" content="facebook">
  <meta itemprop="name" content="Facebook T-Shirt">
  <meta itemprop="description" content="Unisex Facebook T-shirt, Small">
  <meta itemprop="productID" content="facebook_tshirt_001">
  <meta itemprop="url" content="https://example.org/facebook">
  <meta itemprop="image" content="https://example.org/facebook.jpg">
  <div itemprop="value" itemscope itemtype="http://schema.org/PropertyValue">
    <span itemprop="propertyID" content="item_group_id"></span>
    <meta itemprop="value" content="fb_tshirts"></meta>
  </div>
  <div itemprop="offers" itemscope itemtype="http://schema.org/Offer">
    <link itemprop="availability" href="http://schema.org/InStock">
    <link itemprop="itemCondition" href="http://schema.org/NewCondition">
    <meta itemprop="price" content="7.99">
    <meta itemprop="priceCurrency" content="USD">
  </div>
</div>
```

## JSON-LD for Schema.org {#json-ld}  

See [required tags for JSON-LD for Schema.org](catalog/reference.md#json-ld).

**Example** — JSON-LD for Schema.org

```
<script type="application/ld+json">
{
  "@context":"https://schema.org",
  "@type":"Product",
  "productID":"facebook_tshirt_001",
  "name":"Facebook T-Shirt",
  "description":"Unisex Facebook T-shirt, Small",
  "url":"https://example.org/facebook",
  "image":"https://example.org/facebook.jpg",
  "brand":"facebook",
  "offers": [
    {
      "@type": "Offer",
      "price": "7.99",
      "priceCurrency": "USD",
      "itemCondition": "https://schema.org/NewCondition",
      "availability": "https://schema.org/InStock"
    }
  ],
  "additionalProperty": [{
    "@type": "PropertyValue",
    "propertyID": "item_group_id",
    "value": "fb_tshirts"
  }]
}
</script>
```

## Learn More

* [Microdata Debugger Tool](https://business.facebook.com/ads/microdata/debug)
* [Reference, Catalog](catalog/reference.md)
