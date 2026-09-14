---
title: "Business Pages"
source: "https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/business/pages"
scraped_at: "2026-09-12T17:42:28.390Z"
---

# Business Pages



## Reading

You can't perform this operation on this endpoint.

## Creating

You can't perform this operation on this endpoint.

## Updating

You can't perform this operation on this endpoint.

## Deleting

### /{business_id}/pages
You can dissociate a [Business](reference/business.md) from a [Business](reference/business.md) by making a DELETE request to [/{business_id}/pages](reference/business/pages.md).

#### Parameters

| Parameter | Description |
| --- | --- |
| `page_id`<br><br>*Page ID* | Page ID.<br><br>**[required]**<br> |

#### Return Type

```
Struct  {
success: bool,
}
```

#### Error Codes

| Error Code | Description |
| --- | --- |
| 42001 | This Page can't be removed because it's already linked to an Instagram business profile. To remove this Page from Business Manager, go to Instagram and convert to a personal account or change the Page linked to your business profile. |
| 200 | Permissions error |
| 3996 | The page does not belong to this Business Manager. |
| 415 | Two factor authentication required. User have to enter a code from SMS or TOTP code generator to pass 2fac. This could happen when accessing a 2fac-protected asset like a page that is owned by a 2fac-protected business manager. |
| 100 | Invalid parameter |
