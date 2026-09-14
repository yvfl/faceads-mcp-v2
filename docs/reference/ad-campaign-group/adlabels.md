---
title: "Ad Campaign Group Adlabels"
source: "https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-campaign-group/adlabels"
scraped_at: "2026-09-12T17:42:28.371Z"
---

# Ad Campaign Group Adlabels



## Reading

You can't perform this operation on this endpoint.

## Creating

You can't perform this operation on this endpoint.

## Updating

### /{campaign_id}/adlabels
You can update an [AdLabel](reference/ad-label.md) by making a POST request to [/{campaign_id}/adlabels](reference/ad-campaign-group/adlabels.md).

#### Parameters

| Parameter | Description |
| --- | --- |
| `adlabels`<br><br>*list<Object>* | Specification of ad labels to be associated with the campaign<br><br>**[required]**<br> |
| `execution_options`<br><br>*list<enum{validate_only}>* | **Default value: **`Set`<br>An execution setting<br> `validate_only`: when this option is specified, the API call will not perform the mutation but will run through the validation rules against values of each field. <br>If the call passes validation or review, response will be `{"success": true}`. If the call does not pass, an error will be returned with more details. These options can be used to improve any UI to display errors to the user much sooner, e.g. as soon as a new value is typed into any field corresponding to this ad object, rather than at the upload/save stage, or after review.<br> |

#### Return Type

This endpoint supports [read-after-write](https://developers.facebook.com/docs/graph-api/overview#read-after-write) and will read the node to which you POSTed.

```
Struct  {
success: bool,
}
```

#### Error Codes

| Error Code | Description |
| --- | --- |
| 100 | Invalid parameter |

## Deleting

You can't perform this operation on this endpoint.
