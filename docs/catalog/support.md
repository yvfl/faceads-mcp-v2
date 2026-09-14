---
title: "Troubleshoot Your Data Feed"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/support"
scraped_at: "2026-09-12T19:03:14.719Z"
---

# Troubleshoot Your Data Feed



Use these solutions and guidelines for any data feed issues you might encounter.

## View Suggested Rules {#suggested-rules}

To list all rules associated with a data feed, make an `HTTP GET` call to:

```
https://graph.facebook.com/<API_VERSION>/<PRODUCT_FEED_ID>/rules
```

For details, see [Product Data Feed Rules API, Reference](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed/rules).

You can get suggested rules from Meta to fix errors in your data feed. To see suggested rules for your upload session, follow these steps:

**Step 1**: Retrieve upload sessions:

```
https://graph.facebook.com/<API_VERSION>/<PRODUCT_FEED_ID>/uploads
```

**Step 2**: Retrieve errors for upload session:

```
https://graph.facebook.com/<API_VERSION>/<UPLOAD_SESSION_ID>/errors
```

**Step 3**: Retrieve suggested rules for upload error:

```
curl -i -X GET
 "https://graph.facebook.com/<API_VERSION>/<UPLOAD_ERROR_ID>/suggested_rules?access_token={ACCESS_TOKEN}
```

**Sample Response**

```
"data": [

    "attribute": "description",
    "type": "letter_case_rule",
    "params": [

        "key": "type",
        "value": "capitalize_first"

    ]

]
```

For details, see [Suggested Rules API, Reference](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed-rule-suggestion).

## Apply Rules to Data Feeds {#apply-rules}

To apply rules to a data feed, you need to associate the rule to the data feed.

Make an `HTTP POST` call to:

```
https://graph.facebook.com/<API_VERSION>/<PRODUCT_FEED_ID>/rules?attribute={ATTRIBUTE}&rule_type={RULE_TYPE}&params={PARAMS}
```

**Example**

```
curl -i -X POST
  -d "attribute=google_product_category"
  -d "rule_type=mapping_rule"
  -d "params=%7B'map_from'%3A%20'gcategory'%7D"
  -d "access_token={ACCESS_TOKEN}"
  "https://graph.facebook.com/<API_VERSION>/{PRODUCT_FEED_ID}/rules"
```

**Sample Response**

```
"id": "{RULE_ID}"
```

Format `params` as follows:

| Rule Type | Format | Example | Notes |
| --- | --- | --- | --- |
| Mapping Rule | "map_from": <string> | "map_from": "gavailability" |  |
| Value Mapping Rule | <string> : <string> | "InStock": "in stock" | Maximum number of mappings is limited to 10 and length of strings to 20. |
| Letter Case Rule | "type": one of : "capitalize_first", "capitalize_all", "to_upper", "to_lower" | "type": "capitalize_first" |  |

For details, see [Product Data Feed Rules API, Reference](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed/rules).

## Fix Feed Upload Errors with Rules {#feed-rules}

Fix and prevent ongoing data feed upload errors with rules. You can provide rules that Meta applies to each data feed upload. Specify your rules by the attribute (column) they should apply to, by the type of rule, and by parameters. **You currently cannot use rules with the Batch API.** You can provide these types of rules:

* **Mapping Rule** - Maps attributes (column names) in a data feed file to attributes we can recognize.
* **Value Mapping Rule** - Maps fields (column values) in a data feed file to fields we can recognize.
* **Letter Case Rule** - Change case of words in a field. For example, change all uppercase descriptions to lower case.

For example, you can fix these issues with the **Mapping and Value Mapping Rule**:

* Attribute typos from `gavailability` to `availability`
* Fix unrecognized enums `InStock` to `in stock`
* Price format from `45$` to `45.00 USD`
* Translate Condition: `Neu` under Condition: `New`

You can use the **Letter Case Rule** to address these types of issues:

* Change descriptions in all caps `BRAND NEW WITH LEATHER DETAIL...` to `Brand new with leather detail...`
* Fix titles in all caps `FACEBOOK T-SHIRT` to `Facebook T-shirt`

## Update and Delete Rules {#update-delete-rules}

To change a rule associated with a data feed, make an `HTTP POST` call to update any parameters and `HTTP DELETE` to delete it. **You can only update parameters. If you want to change `attribute` or `rule_type`, you must delete and re-create the rule.**

```
https://graph.facebook.com/<API_VERSION>/<PRODUCT_FEED_RULE_ID>?params={PARAMS}
```

For details, See [Product Data Feed Rule API, Reference](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed-rule).

## Fix Missing Items in a Catalog {#troubleshoot-missing-items}

If Commerce Manager reports that some items in your catalog are missing or can't be found, you may need to check that your Meta pixel or app have been set up properly. You may encounter this error when:

* The `content_id` included in your pixel or app event doesn't match the ID in the catalog's data feed.
* The pixel or app isn't associated to the catalog.
* The item doesn't exist in the catalog.

Learn more [here](https://www.facebook.com/business/help/644889989181423).

Learn more about troubleshooting your feed with [Blueprint](https://www.facebookblueprint.com/student/collection/240330/path/210150?content_id=UHg8KZLJqKp7LPU).

## Request a Data Feed Upload Error Report {#data-feed-upload-report}

### Advantage+ Catalog Ads

You can use the Data Feed Upload Error Report API to request a full error report for any feed upload session. Once we receive the request, we run a background job to prepare these errors and store them in a CSV file.

To request a full error report, use `POST /{upload_session_id}/error_report`.

The report contains information about:

* Retailer ID of the item that had an error
* Error message
* Error severity (`FATAL` if the error caused item to be rejected, `WARNING` if item was uploaded but with an error)
* Field names on which this error was thrown
* Capabilities that are being affected by this error; for example, errors affecting Advantage+ catalog ads that contain `'da'` within this column
* If the error blocks capability (`true`/`false`); for example, if the error prevents the item from being shown on this surface

**Request**

```
curl -i -X POST \
  -F 'access_token=ACCESS_TOKEN' \
  https://graph.facebook.com/<API_VERSION>/<upload session ID>/error_report
```

**Response**
The response indicates if the request was successful or not:

```
{
  "success": bool,
}
```

### Commerce

Getting a sampling of errors and warnings is often sufficient to fix most product feed upload issues. However, you may need the full list of errors to do deeper analysis. To download a full list of errors and warnings, you must first query the most recent upload session (see section above).

You can request the full error report to be generated for a given upload session ID.

**Request**

```curl
GET https://graph.facebook.com/vX.X/{upload-session-id}/?fields=error_report
```

**Response**

```json
{
  "error_report": {
    "report_status": "WRITE_FINISHED",
    "file_handle": "{link-to-the-file-location}"
  },
  "id": "493476498092860"
}
```

You should find a URL that you can download (for example, with wget, curl, and so on). The downloaded file will contain the full error report.

If you get this error: "Cannot access an object not managed by the business owning this app", please make sure that the app you're using belongs to the business (**Business Settings** > **Account** > **Apps**).  

In case the report is not ready, repeat the last call after a few seconds. You can then download the report itself.

## Get the Error Report Status {#status-error-report}

Once a report has been requested, use `GET /{upload_session_id}?fields=error_report` to get the status of the error report.

**Example**

```
curl -i -X GET \
 https://graph.facebook.com/<API_VERSION>/<upload session ID>?fields=error_report&access_token=ACCESS_TOKEN
```

**Response**

```
{
  "error_report": {
    "report_status": string,
    "file_handle": string, // if available
  }
  "id": "332552650711532 (https://developers.facebook.com/tools/explorer/690422434302374?method=GET&path=332552650711532%3Ffields%3Derror_report&version=v3.2#)"
}
```

#### Possible Values - Returned Status {#possible-values}

| Value | Description |
| --- | --- |
| `NOT_REQUESTED` | The error report for this data feed upload has not been requested. |
| `REQUESTED` | The request was received and is being processed. |
| `CREATED` | The report creation was successful and is waiting to be written to a CSV file. |
| `WRITE_FINISHED` | The report file has been prepared and is ready to be downloaded. |
| `SESSION_DATA_NOT_FOUND` | There was no data found for this data feed upload session, it is likely that there were no items processed for this feed upload. |
| `ERROR_REPORT_OUTDATED` | The error report is older than 30 days and is no longer available. |
| `FATAL_ERROR` | Something went wrong on our end while trying to prepare this error report. You can request for an error report to retry. |

**Note**: A CDN URL using this error report can be downloaded and will be returned as "file_handle" when the status of the `error_report` is `WRITE_FINISHED`.

## Manage Product Feed Upload Errors
### Advantage+ Catalog Ads {#errors-da}

Read the [Product Feed Upload Errors documentation](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed-upload/errors). See also [Handling Product Feed Upload Errors, Commerce Platform](#errors-commerce).

#### Request

To get errors and warning from a feed upload, you must first query for recent upload sessions.

```
GET https://graph.facebook.com/vX.X/{product-feed-id}/uploads
Token: PAGE_ACCESS_TOKEN
```

Then, use `upload_session_id` to retrieve errors and warnings.

```
GET https://graph.facebook.com/vX.X/{upload-session-id}/errors
Token: PAGE_ACCESS_TOKEN
```

#### Sample Response

A `fatal` severity here means the item cannot be ingested by Meta; a `warning` severity means some recommended attributes are missing or malformed.

```json
{
  "data": [
    {
      "id": 1510567479166488,
      "summary": "A required field is missing: price.",
      "description": "Products need to have prices to run in ads. Include a price for each product in your data feed file and upload it again. Prices must include cost and an ISO currency code (for example: 10 USD instead of $10 for American dollars).",
      "severity": "fatal",
      "samples": {
        "data": [
          {
            "row_number": 2,
            "retailer_id": "yj9bpbpub5t8t22kgbq6",
            "id": "1677559492523068"
          },
          {
            "row_number": 5,
            "retailer_id": "ujn33tvbyv2vmdpo7ecb",
            "id": "1529743440653137"
          }
        ]
      }
    },
    {
      "id": 275241589314958,
      "summary": "GTIN is incorrectly formatted",
      "description": "Check that the GTIN (Global Trade Identification Number) for each of your products is in the correct format. Accepted types include UPC, EAN, JAN, and ISBN.",
      "severity": "warning",
      "samples": {
        "data": [
          {
            "row_number": 4,
            "retailer_id": "bxwb1pho9o43uxjxikcg",
            "id": "538700559625644"
          }
        ]
      }
    }
  ]
}
```

### Commerce {#errors-commerce}
Read the [Product Feed Upload Errors documentation](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed-upload/errors). See also [how to manage product feed Upload Errors, Advantage+ Catalog Ads](#errors-da).

We recommend that you check catalog upload errors and warnings after each upload session. You can achieve this by going to the **Diagnostics** section of your [Commerce Manager](https://business.facebook.com/products), or use the Feed API to request a sampling of errors and warnings. Start by first querying for recent upload sessions.

Learn more about resolving Diagnostic warnings and errors in Commerce Manager with [Blueprint](https://www.facebookblueprint.com/student/collection/240330/path/210150?content_id=UHg8KZLJqKp7LPU).

#### Request

```curl
GET https://graph.facebook.com/vX.X/{product-feed-id}/uploads
```

#### Sample Response

```json
{
  "data": [
    {
      "id": "493476498092860",
      "start_time": "2019-07-15T12:38:36+0000",
      "end_time": "2019-07-15T12:38:47+0000"
    }
  ]
}
```

Then, use the value returned in the `id` field to retrieve **a sampling** of errors and warnings.

#### Request

```curl
GET https://graph.facebook.com/vX.X/{upload-session-id}/errors
```

#### Sample Response

A `fatal` severity here means the item cannot be ingested by Meta; a `warning` severity means some recommended attributes are missing or malformed.

```json
{
  "data": [
    {
      "id": 1510567479166488,
      "summary": "A required field is missing: price.",
      "description": "Products need to have prices to run in ads. Include a price for each product in your data feed file and upload it again. Prices must include cost and an ISO currency code (for example: 10 USD instead of $10 for American dollars).",
      "severity": "fatal",
      "samples": {
        "data": [
          {
            "row_number": 2,
            "retailer_id": "yj9bpbpub5t8t22kgbq6",
            "id": "1677559492523068"
          },
          {
            "row_number": 5,
            "retailer_id": "ujn33tvbyv2vmdpo7ecb",
            "id": "1529743440653137"
          }
        ]
      }
    },
    {
      "id": 275241589314958,
      "summary": "GTIN is incorrectly formatted",
      "description": "Check that the GTIN (Global Trade Identification Number) for each of your products is in the correct format. Accepted types include UPC, EAN, JAN, and ISBN.",
      "severity": "warning",
      "samples": {
        "data": [
          {
            "row_number": 4,
            "retailer_id": "bxwb1pho9o43uxjxikcg",
            "id": "538700559625644"
          }
        ]
      }
    }
  ]
}
```

## Learn More

* [Troubleshoot Data Feeds, Ads Help Center](https://www.facebook.com/business/help/2041876302542944)
* [Catalog and Signals Quality](catalog/guides/cat-signals-quality.md)
* [Data Feed Fields and Specifications for Catalogs, Ads Help Center](https://www.facebook.com/business/help/120325381656392)
* [Catalog and Signals Quality](catalog/guides/cat-signals-quality.md)
* [Catalog Batch API, Advantage+ Catalog Ada](catalog/guides/manage-catalog-items/catalog-batch-api.md)
* [Catalog Batch API, commerce](catalog/guides/manage-catalog-items/catalog-batch-api.md#batch-api-commerce)
* [Data Feed, Reference](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed)
* [Data Feeds in Catalog, Reference](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed)
* [Feed API, Reference](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed)
* [Scheduled Data Feed Fetch, Reference](catalog/guides.md#scheduled-feed-fetches)
* [Filter Rules, Reference](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-set#filterrules)
* [Product Catalog Batch, Reference](reference/product-catalog/batch.md)
* [Product Catalog Items Batch, Reference](reference/product-catalog/items_batch.md)
* [Product Catalog Check Batch Request Status, Reference](reference/product-catalog/check_batch_request_status.md)
* [Product Feed Schedule, Reference](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed-schedule)
* [Product Feed Upload, Reference](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-feed/uploads)
* [Product Item, Reference](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/product-item)
* [Product Search in Catalog, Reference](reference/product-catalog/products.md)
* [Live Training on Catalog, Blueprint](https://www.facebookblueprint.com/student/collection/240330/path/210150?content_id=3AB46yBUG6YtkZC)
