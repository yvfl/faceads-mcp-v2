---
title: "Catalog Integration Using Meta Business SDK"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/get-started/integrate-via-meta-sdk"
scraped_at: "2026-09-12T19:01:56.540Z"
---

# Catalog Integration Using Meta Business SDK



You can use the [Meta Business SDK](https://developers.facebook.com/docs/business-sdk/getting-started) for Catalog API Integration. It provides an easy way, with boilerplate code, to call available catalog APIs. Meta SDKs are available for Java, Python, Node.js, PHP and Ruby languages.

## Requirements

* Application ID -- A unique ID generated for an app during the app creation flow. [Learn more](https://developers.facebook.com/docs/development/create-an-app).
* Access token -- A string that identifies a user, app, or Page and can be used by the app to make graph API calls. [Learn more](https://developers.facebook.com/documentation/facebook-login/guides/access-tokens).
* Catalog ID – Your catalog identifier.

## Step 1: Install the SDK

Follow [these instructions](https://developers.facebook.com/docs/business-sdk/getting-started) to install the SDK for your preferred language.

## Step 2: Make an API Call

You can make API calls using the objects and functions included in the SDK. Here are some sample API calls:

### Upload Products

### PHP SDK
```
Api::init($app_id, $app_secret, $access_token);

// Create Product Items using Items Batch API
$catalog = new ProductCatalog($catalog_id);
$response = $catalog->createItemsBatch(
 array(),
 array(
 "item_type" => "PRODUCT_ITEM",
   "requests" => array(
     // Item 1 - Create Item
     array(
       "method" => "create",
       "data" => array(
         "id" => "retailer_id_1",
         "title" => "Product Title",
         "description" => "Product Description",
         "brand" => "BrandName",
         "price" => "20.00 USD",
         "image_link" => "image_url",
         "availability" => "in stock",
         "link" => "http://productlink.com/product/retailer_id",
       )
     ),
     // Item 2 - Update item with retailer_id_2
     array(
       "method" => "update",
       "data" => array(
         "id" => "retailer_id_2",
         "title" => "Product Title 2",
       )
     ),
     // Item 3 - Delete item with retailer_id_3
     array(
       "method" => "delete",
       "data" => array(
         "id" => "retailer_id_3",
       )
     )
   )
)
)
```

### Node.js Business SDK
```
const bizSdk = require('facebook-nodejs-business-sdk');

const access_token = '<ACCESS_TOKEN>';
const catalog_id = '<CATALOG_ID>';

const FacebookAdsApi = bizSdk.FacebookAdsApi.init(access_token)
const ProductCatalog = bizSdk.ProductCatalog;
const catalog = new ProductCatalog(catalog_id);
catalog.createItemsBatch(
 [],
 {
   "item_type" : "PRODUCT_ITEM",
   "requests" : [
     // Item 1 - Create Item
     {
       "method" : "create",
       "data" : {
         "id" : "retailer_id_1",
         "title" : "Product Title",
         "description" : "Product Description",
         "brand" : "BrandName",
         "price" : "20.00 USD",
         "image_link" : "image_url",
         "availability" : "in stock",
         "link" : "http://productlink.com/product/retailer_id",
       }
     },
     // Item 2 - Update item with retailer_id_2
     {
       "method" : "update",
       "data" : {
         "id" : "retailer_id_2",
         "title" : "Product Title 2",
       }
     },
     // Item 3 - Delete item with retailer_id_3
     {
       "method" : "delete",
       "data" : {
         "id" : "retailer_id_3",
       }
     }
   ]
 }
)
.then((response) => {
 console.log(response.handles);
})
.catch((error) => {
 console.log(error);
});
```

### Fetch Products

### PHP SDK
```
Api::init($app_id, $app_secret, $access_token);

// Get all products in a catalog
$catalog = new ProductCatalog($catalog_id);
$cursor = $catalog->getProducts();
//$cursor->setUseImplicitFetch(true); Set true for Auto Scroll

while ($cursor->valid()) {
   echo $cursor->current()->{ProductItemFields::NAME}.PHP_EOL;
   echo $cursor->current()->{ProductItemFields::ID}.PHP_EOL;
   $cursor->next();
}

$cursor->end(); // Set cursor to the end of the lst
$cursor->fetchAfter(); // Fetch the next page
$cursor->next(); // Move the cursor to the next item

while ($cursor->valid()) {
   echo $cursor->current()->{ProductItemFields::NAME}.PHP_EOL;
   echo $cursor->current()->{ProductItemFields::ID}.PHP_EOL;
   $cursor->next();
}
```

### Node.js Business SDK
```
const bizSdk = require('facebook-nodejs-business-sdk');

const access_token = '<ACCESS_TOKEN>';
const catalog_id = '<CATALOG_ID>';

const FacebookAdsApi = bizSdk.FacebookAdsApi.init(access_token)
const FacebookAdsApi = bizSdk.FacebookAdsApi.init(access_token)
const ProductCatalog = bizSdk.ProductCatalog;
const ProductItem = bizSdk.ProductItem;

const catalog = new ProductCatalog(catalog_id);
catalog.getProducts([ProductItem.Fields.name, ProductItem.Fields.price], { limit: 2 })
.then((products) => {
 console.log(products.length);
 for (const product of products) {
   console.log(product.name, product.price);
 }
 if(products.hasNext()) {
   products.next().then((products) => {
     // process products
   });
 }
})
```

## Learn More

View the Meta Business SDK source code at Github.

* [Java Business SDK](https://github.com/facebook/facebook-java-business-sdk)
* [Node.js Business SDK](https://github.com/facebook/facebook-nodejs-business-sdk)
* [PHP Business SDK](https://github.com/facebook/facebook-php-business-sdk)
* [Python Business SDK](https://github.com/facebook/facebook-python-business-sdk)
* [Ruby Business SDK](https://github.com/facebook/facebook-ruby-business-sdk)
