---
title: "Diagnostics API"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/guides/diagnostics-api"
scraped_at: "2026-09-12T19:02:05.330Z"
---

# Diagnostics API



The Diagnostics API, through the EVENT_SOURCE_ISSUES error type, offers a daily updated comprehensive view of Meta Pixel and/or app issues that could be impacting ad performance. This feature allows advertisers to identify and address significant health issues within their catalog effectively. The issues are related to missing requirements or wrong setup for running [Advantage+ Catalog Ads](https://developers.facebook.com/docs/meta-pixel/get-started/advantage-catalog-ads)

The API provides detailed insights and guidance on resolving these issues, ensuring that advertisers can maintain optimal performance and health of their ad campaigns.

**Note:** **Note**: See the [Catalog Diagnostics reference documentation](reference/product-catalog/diagnostics.md) for more about the parameters and fields that can be used to call the API.

## Prerequisites

Before using the Diagnostics API, you will need to have:

* [catalog_management](https://developers.facebook.com/docs/permissions#c) permissions
* [Pixel view access](https://www.facebook.com/business/help/279059996069252?id=2042840805783715) and [catalog view access](https://www.facebook.com/business/help/1953352334878186?id=2042840805783715) should be granted

## How to Fetch Event-Source Issues

You can fetch event source issues by making a request to the following endpoint:

```
curl -X GET \
https://graph.facebook.com/{product-catalog-id}/diagnostics?types=["EVENT_SOURCE_ISSUES"] \
-F "access_token=<ACCESS_TOKEN>"
```

## Issue Types and Guidance for Resolving Them

When executing the API call, you may encounter one or more of the following issue types related to event source issues:

| Issue Type | Description | Recommended Action | Further Instructions |
| --- | --- | --- | --- |
| APP_HAS_NO_AEM_SETUP | App not set up for Aggregated Event Measurement | Make sure your app is eligible for Aggregated Event Measurement. |  |
| CATALOG_NOT_CONNECTED_TO_EVENT_SOURCE | Catalog not connected to Meta Pixel or app SDK | Connect your catalog to a Meta Pixel or app SDK to use it for ads. | [Learn how to connect](https://www.facebook.com/business/help/1044262445604547) a Meta Pixel or Facebook SDK to a catalog in Commerce Manager. |
| DELETED_ITEM | Deleted items still interacting with website | Add deleted products back to increase match rate. | Add deleted products back to your catalog. |
| INVALID_CONTENT_ID | Invalid content IDs | Check that content IDs are correctly formatted with no extra numbers or symbols. | Check your content IDs. |
| MISSING_EVENT | No purchase events received in last 7 days | Check that pixel is set up correctly and sending events from website. | Use Meta pixel helper to check if you're sending the correct event from your website. |
| NO_CONTENT_ID | Missing content IDs | Include one or more unique IDs for item or product group in code. | Check your code. |

## Response
After executing the above Diagnostics API call, you should receive a response in the following format:

```
{
 type: "EVENT_SOURCE_ISSUES",
 severity: "MUST_FIX",
 title: "Your catalog or its products have critical issues affecting your match rate.",
subtitle: "Fix these issues first to increase your match rate.",
 error_code: 3379017,
 number_of_affected_items: 15,
 diagnostics: [
   {
     type: "INVALID_CONTENT_ID",
     description: "788 items need to be fixed",
     call_to_action: "For more details please go to Commerce Manager",
     action_uri: "https://business.facebook. com/commerce/catalogs",
     details: "Valid content IDs for interacted products in your website are required to match products to this catalog.",
     instructions: ["Valid content IDs for interacted products in your website are required to match products to this catalog."],
     event_source_id: 532113215325335,
     event_source_type: "Pixel",
     event_name: "Lead",
     error_code: 1989420,
     number_of_affected_items: 788,
     sample_affected_items: [
       {
         num_events: 788
     content_id: "49839823",
       }
     ]
   }
```

### Fields

| Name | Type | Description |
| --- | --- | --- |
| `data` | array | An array containing one object with information about the issues. |
| `type` | string | The type of issue, which is "EVENT_SOURCE_ISSUES". |
| `severity` | string | The severity of the issue, which can be either "MUST_FIX" or "WARNING". |
| `title` | string | A brief description of the issue. |
| `subtitle` | string | Additional information about the issue. |
| `error_code` | integer | A unique identifier for the error. |
| `number_of_affected_items` | integer | The number of items affected by the issue. |
| `diagnostics` | array | An array containing objects with more detailed information about the issue. |
| `type` | string | One of more specific types of EVENT_SOURCE_ISSUES. |
| `description` | string | A more detailed description of the issue. |
| `call_to_action` | string | Information on what action to take to resolve the issue. |
| `details` | string | Additional details about the issue. |
| `instructions` | array | An array of instructions on how to fix the issue. |
| `error_code` | integer | A unique identifier for the error. |
| `action_url` | string | A URL that provides more information about the issue and how to resolve it. |
| `event_source_id` | integer | The ID of the event source that is experiencing the issue. |
| `event_source_type` | string | The type of event source that is experiencing the issue. |
| `event_name` | string | The name of the event that is experiencing the issue. |
| `sample_affected_items` | array | An array containing one object with sample affected items. |
| `content_id` | string | The ID of the affected item. |
| `content_url` | string | The URL of the affected item. |
| `num_events` | integer | The number of events associated with the affected item. |

## Post-Response Actions

After receiving the response from the Diagnostics API and filtering by EVENT_SOURCE_ISSUES, you should:

* Review the list of pixel issues and prioritize those that require immediate attention.
* Follow the guidance provided in the API response to resolve each issue.
* Verify that the issues have been resolved and your pixel is functioning correctly.

## Additional Resources

* [Catalog Diagnostics reference documentation](reference/product-catalog/diagnostics.md)
