---
title: "Ad Account Async Batch Requests"
source: "https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-account/async_batch_requests"
scraped_at: "2026-09-12T17:42:28.361Z"
---

# Ad Account Async Batch Requests



## Reading

You can't perform this operation on this endpoint.

## Creating

### /act_{ad_account_id}/async_batch_requests
You can make a POST request to *async_batch_requests* edge from the following paths:

- [/act_{ad_account_id}/async_batch_requests](reference/ad-account/async_batch_requests.md)

When posting to this edge, a [Campaign](reference/ad-campaign-group.md) will be created.

#### Parameters

| Parameter | Description |
| --- | --- |
| `adbatch`<br><br>*list<Object>* | JSON encoded batch reqeust<br><br>**[required]**<br><br><br>`name` *string*<br>**[required]**<br><br><br>`relative_url` *string*<br>**[required]**<br><br><br>`body` *UTF-8 encoded string*<br>**[required]**<br> |
| `name`<br><br>*UTF-8 encoded string* | Name of the batch request for tracking purposes.<br><br>**[required]**<br> |

#### Return Type

This endpoint supports [read-after-write](https://developers.facebook.com/docs/graph-api/overview#read-after-write) and will read the node represented by *id* in the return type.

```
Struct  {
id: numeric string,
}
```

#### Error Codes

| Error Code | Description |
| --- | --- |
| 194 | Missing at least one required parameter |
| 100 | Invalid parameter |
| 2500 | Error parsing graph query |

## Updating

You can't perform this operation on this endpoint.

## Deleting

You can't perform this operation on this endpoint.
