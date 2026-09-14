---
title: "Catalog Item Types"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/guides/catalog-item-types"
scraped_at: "2026-09-12T19:02:03.650Z"
---

# Catalog Item Types


There are multiple types of catalog items that correspond to different types of objects that can be advertised and/or sold on Meta technologies. Depending on the value of a catalog's [vertical field](reference/product-catalog.md#fields), there are some restrictions as to which item types can or cannot be created.

For example, you can't add an item of type `HOTEL` to a catalog with vertical='commerce'. The table below summarizes the possible options.

| Item Type | Catalog Vertical | Relevant API Endpoints |
| --- | --- | --- |
| DESTINATION | destinations | [destination](https://developers.facebook.com/docs/graph-api/reference/destination)<br><br>[catalog/destinations](reference/product-catalog/destinations.md)<br><br>[product-set/destinations](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-set/destinations) |
| FLIGHT | flights | [flight](https://developers.facebook.com/docs/graph-api/reference/flight)<br><br>[catalog/flights](reference/product-catalog/flights.md)<br><br>[product-set/flights](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-set/flights) |
| HOME_LISTING | home_listings | [home listing](https://developers.facebook.com/docs/graph-api/reference/home-listing)<br><br>[catalog/home_listings](reference/product-catalog/home_listings.md)<br><br>[product-set/home_listings](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-set/home_listings) |
| HOTEL | hotels | [hotel](https://developers.facebook.com/docs/graph-api/reference/hotel)<br><br>[catalog/hotels](reference/product-catalog/hotels.md)<br><br>[product-set/hotels](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-set/hotels) |
| HOTEL_ROOM | hotels | [hotel room](https://developers.facebook.com/docs/graph-api/reference/hotel-room)<br><br>[hotel/hotel_rooms](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/hotel/hotel_rooms) |
| PRODUCT_ITEM | commerce | [product item](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-item)<br><br>[catalog/products](reference/product-catalog/products.md)<br><br>[product-set/products](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-set/products)<br><br>[product_group/products](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-group/products) |
| STORE_PRODUCT_ITEM | commerce |  |
| VEHICLE | vehicles | [vehicle](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/vehicle)<br><br>[catalog/vehicles](reference/product-catalog/vehicles.md)<br><br>[product-set/vehicles](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-set/vehicles) |
| VEHICLE_OFFER | vehicle_offers | [catalog/vehicle_offers](reference/product-catalog/vehicle_offers.md)<br><br>[product-set/vehicle_offers](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-set/vehicle_offers) |
