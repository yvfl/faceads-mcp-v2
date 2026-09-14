---
title: "\"Conversions API Gateway and Signals Gateway Control Plane API: Reference\""
source: "https://developers.facebook.com/documentation/ads-commerce/gateway-products/gateway-control-plane-api/account-event-metrics"
scraped_at: "2026-09-12T19:20:35.777Z"
---

# "Conversions API Gateway and Signals Gateway Control Plane API: Reference"



**Warning:** Starting from Conversions API Gateway and Signals Gateway v2.2.0, up-to-date versions of the Control Plane API reference docs, including examples with sample data, can be accessed inside your gateway UI. To find these docs:

* Click on **Settings**
* Choose **API accounts**
* Click the **API Reference** link at the top of the API accounts page

## Get Account Event Metrics by Time Frame

Gets account specific event metrics at pixel and event level, provided admin has access to manage the account.

#### Schema  

```
POST https://{capig_domain}/capig/graphql/
<hr/>

query HomeViewQuery($tenantId: ID!, $pixelIds: [String!], $timeWindow: Int) {
  tenantQueries(tenantId: $tenantId) {
    eventMetrics(pixelIds: $pixelIds, timeWindowMin: $timeWindow) {
      activity {
        name
        receivedCount
        publishedCount
        lastUpdated
      }
      incoming {
        eventNamesCount
        eventsCount
      }
      outgoing {
        eventNamesCount
        eventsCount
        publishSuccessRate
      }
    }
  }
}
<hr/>
tenantId: ID!
<hr/>
pixelIds: [String!]
<hr/>
timeWindow: Int
```

#### Fields

| Field | Description |
| --- | --- |
| `tenantId`  <br>*ID* | **Required**  <br><br>Unique identifier of the account |
| `pixelIds`  <br>*String* | **Optional**  <br><br>List of Pixel IDs for which event metrics needs to be fetched |
| `timeWindow`  <br>*Int* | **Optional**  <br><br>Time window in minutes (Default value is 60 minutes) |

#### Returns
`EventMetricsSnapshot`

| Field | Description |
| --- | --- |
| `id`  <br>*ID* | Identifier for EventMetricsSnapshot -- always EventTrafficSummary:incoming |
| `incoming`  <br>[*EventTrafficSummary*](conversions-api/guides/gateway-control-plane-api/reference/objects.md#eventtrafficsummary) | Incoming events summary data |
| `outgoing`  <br>[*ConversionsApiPublishSummary*](conversions-api/guides/gateway-control-plane-api/reference/objects.md#capi-pub-summary) | Outgoing events data |
| `activity`  <br>[*EventActivity*](conversions-api/guides/gateway-control-plane-api/reference/objects.md#event-activity) | List of event activity |
| `domainActivity`  <br>[*DomainActivity*](conversions-api/guides/gateway-control-plane-api/reference/objects.md#domain-activity) | List of domain activity |

#### Error Codes

| Code | Description |
| --- | --- |
| 401 | Not authorized to view event metrics |
| 500 | Internal server error |

#### Sample Request

Query

```
query HomeViewQuery($tenantId: ID!, $pixelIds: [String!], $timeWindow: Int) {
 tenantQueries(tenantId: $tenantId) {
   eventMetrics(pixelIds: $pixelIds, timeWindowMin: $timeWindow) {
     activity {
       name
       receivedCount
       publishedCount
       lastUpdated
     }
     incoming {
       eventNamesCount
       eventsCount
     }
     outgoing {
       eventNamesCount
       eventsCount
       publishSuccessRate
     }
   }
 }
}
```

Variables

```
{
 "tenantId": "IaoreXfj",
 "pixelIds": ["18904456377094531"]
}
```

#### Sample Response

```
{
   "data": {
       "tenantQueries": {
           "eventMetrics": {
               "activity": [
                   {
                       "name": "Purchase_PN_Mar22_Events",
                       "receivedCount": 4,
                       "publishedCount": 0,
                       "lastUpdated": "1678753252000"
                   }
               ],
               "incoming": {
                   "eventNamesCount": 1,
                   "eventsCount": 4
               },
               "outgoing": {
                   "eventNamesCount": 0,
                   "eventsCount": 0,
                   "publishSuccessRate": 0.0
               }
           }
       }
   }
}
```

## See Also

* [Conversions API Gateway for Multiple Accounts Control Plane API](conversions-api/guides/gateway-control-plane-api.md)
* [Control Plane API: Reference](conversions-api/guides/gateway-control-plane-api/reference.md)
* [Control Plane API Reference: Account Management](conversions-api/guides/gateway-control-plane-api/reference/account-management.md)
* [Control Plane API Reference: User Management](conversions-api/guides/gateway-control-plane-api/reference/user-management.md)
* [Control Plane API Reference: Pixel Management](conversions-api/guides/gateway-control-plane-api/reference/pixel-management.md)
* [Control Plane API Reference: Account Data Routing Configuration](conversions-api/guides/gateway-control-plane-api/reference/account-data-routing.md)
* [Control Plane API Reference: Objects](conversions-api/guides/gateway-control-plane-api/reference/objects.md)
