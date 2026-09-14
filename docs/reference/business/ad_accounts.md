---
title: "Business Ad Accounts"
source: "https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/business/ad_accounts"
scraped_at: "2026-09-12T17:42:28.383Z"
---

# Business Ad Accounts



## Reading

You can't perform this operation on this endpoint.

## Creating

You can't perform this operation on this endpoint.

## Updating

You can't perform this operation on this endpoint.

## Deleting

### /{business_id}/ad_accounts
You can dissociate a [Business](reference/business.md) from a [Business](reference/business.md) by making a DELETE request to [/{business_id}/ad_accounts](reference/business/ad_accounts.md).

#### Parameters

| Parameter | Description |
| --- | --- |
| `adaccount_id`<br><br>*string* | Ad account ID.<br><br>**[required]**<br> |

#### Return Type

```
Struct  {
success: bool,
}
```

#### Error Codes

| Error Code | Description |
| --- | --- |
| 100 | Invalid parameter |
| 368 | The action attempted has been deemed abusive or is otherwise disallowed |
