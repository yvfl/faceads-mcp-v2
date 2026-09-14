---
title: "Product Variants"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/guides/product-variants"
scraped_at: "2026-09-12T19:02:32.941Z"
---

# Product Variants



You create product variants by adding multiple products grouped by the same `item_group_id` field. This field typically corresponds to the parent SKU, although you can use any other ID to group variants together.

**Note:** All variants for a given product `item_group_id` **must have populated every variant field** (for example, size, color, gender, and pattern). For custom variants, you can use the `additional_variant_attribute` field.

Make sure the `item_group_id` has the same value across all sizes and colors, and that images and external links match the color of the item.

**Incorrect** — “CoolShirt123” is sent as a parent SKU and the color field is not populated. Because each line item in the field spec needs to be its own product, this is an incorrect way of setting up products.
| ID | Name | Color | Price | item_group_id |
| --- | --- | --- | --- | --- |
| CoolShirt123 | Cool shirt (parent) |  | $9.99 | CoolShirt123 |
| CoolShirt123_red | Cool Shirt - Red | red | $9.99 | CoolShirt123 |
| CoolShirt123_blue | Cool Shirt - Blue | blue | $9.99 | CoolShirt123 |

**Correct** — This example shows the correct way to set up products. The name of the product and the `item_group_id` fields match (so that the name does not change when variants are selected, but images do). Both of the items below would roll into one “virtual” parent item.
| ID | Name | Color | Price | item_group_id |
| --- | --- | --- | --- | --- |
| CoolShirt123_red | Cool Shirt | red | $9.99 | CoolShirt123 |
| CoolShirt123_blue | Cool Shirt | blue | $9.99 | CoolShirt123 |

For details about the fields, see [Reference](catalog/reference.md).

## Product group variants example
You can specify variants for a product in the form of a product group. An example of variants is a tee-shirt with 3 sizes (S, M, and L) and 4 colors (Red, Yellow, Blue, and Green). In this case, you can create a product group (with retailer id as tee-shirt and 12 individual products consisting of the variant options (S+Red, M+Red, L+Red, S+Yellow, M+Yellow, L+Yellow, S+Blue, M+Blue, L+Blue, S+Green, M+Green, L+Green).

Include these columns for the `product_group` in the product feed. This example excludes the other required columns to keep this example simple, but you need to specify them in the actual feed file.

| ID | item_group_id | Size | Color |
| --- | --- | --- | --- |
| tee-shirt-S-Red | tee-shirt | S | Red |
| tee-shirt-M-Red | tee-shirt | M | Red |
| tee-shirt-L-Red | tee-shirt | L | Red |
| tee-shirt-S-Yellow | tee-shirt | S | Yellow |
| tee-shirt-M-Yellow | tee-shirt | M | Yellow |
| tee-shirt-L-Yellow | tee-shirt | L | Yellow |
| tee-shirt-S-Blue | tee-shirt | S | Blue |
| tee-shirt-M-Blue | tee-shirt | M | Blue |
| tee-shirt-L-Blue | tee-shirt | L | Blue |
| tee-shirt-S-Green | tee-shirt | S | Green |
| tee-shirt-M-Green | tee-shirt | M | Green |
| tee-shirt-L-Green | tee-shirt | L | Green |
