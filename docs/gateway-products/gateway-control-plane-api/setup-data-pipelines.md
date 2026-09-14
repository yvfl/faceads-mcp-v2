---
title: "\"Signals Gateway Control Plane API: Data Pipeline and Signals Gateway Pixel\""
source: "https://developers.facebook.com/documentation/ads-commerce/gateway-products/gateway-control-plane-api/setup-data-pipelines"
scraped_at: "2026-09-12T19:20:39.017Z"
---

# "Signals Gateway Control Plane API: Data Pipeline and Signals Gateway Pixel"



Control Plane APIs refer to accounts by their legacy name "tenant". Both are used interchangeably in the sections below.

Once integrated, this set of APIs allows advertisers to perform actions such as:

* Manage data sources, for example, create, view and delete ixel connections
* Activate/deactivate pixel from receiving and publishing events
* Read event counts by, for example, timeframe and event type
* Manage other account settings, for example, define Gateway subdomains and block/unblock domains from receiving/publishing events

`capig_domain` in the API Reference section refers to [AdminDomainName](https://developers.facebook.com/documentation/ads-commerce/gateway-products/gateway-aws-eks/create-instance-partners-agencies) which is specified during stack configuration.

## API and UI Parity

We are enforcing API and UI parity by exposing the same API endpoints used in the Gateway Product UI. However, any API endpoint not covered in the [API Reference](conversions-api/guides/gateway-control-plane-api/reference.md) is subject to change in future development. In order to limit the unexpected impact to the minimum, those uncovered API endpoints return Error code: 418. You can still use the API but at your own risk.

## APIs
**Warning:** **Note**: See the Control Plane API integration guide [for instructions on how to Get an API Access Token](gateway-products/gateway-control-plane-api.md#get-api-access-token).

### [Account Management](gateway-products/gateway-control-plane-api/account-management.md)

* Create Account
* Get Account
* Update Account
* Delete Account
* Account Usage

### [User Management](gateway-products/gateway-control-plane-api/user-management.md)
* Add User With Role
* Change User Roles
* Generate and Send Invitation

### [Pixel Management](gateway-products/gateway-control-plane-api/pixel-management.md)
* Create Pixel Connection
* Delete Pixel Connection
* Get List of Meta Pixel Connections
* Activate / Deactivate Gateway from receiving Pixel events
* Activate / Deactivate Pixel event publishing status
* Activate / Deactivate Pixel event publishing status by event name
* Block / Unblock websites permitted to receive and publish events

### [Account Data Routing Configuration](gateway-products/gateway-control-plane-api/account-data-routing.md)
* Get Data Routing
* Update Data Routing

### [Account Event Metrics](gateway-products/gateway-control-plane-api/account-event-metrics.md)
* Get Account Event Metrics by Time Frame

### [Objects](gateway-products/gateway-control-plane-api/objects.md)

* The set of objects used by the APIs.

### [APIs for Data Pipelines](gateway-products/gateway-control-plane-api/setup-data-pipelines/data-pipelines.md)

* Create Gateway Data Pipeline
* Connect Meta Pixel
* Get Data Pipeline
* Update Pipeline
* Delete Pipeline
* Update Pipeline Filter
* Update Pipeline Destination Filter  

### [APIs for Data Sources](gateway-products/gateway-control-plane-api/setup-data-pipelines/data-sources.md)

* Create Data Source
* Get Data Sources
* Update Data Source
* Delete Data Source
* Generate Gateway Pixel Header Code
* Update Gateway Pixel Data Source Config

### [APIs for Data Destinations](gateway-products/gateway-control-plane-api/setup-data-pipelines/data-destinations.md)

* Create Data Destination
* Get Data Destination
* Update Data Destination
* Delete Data Destination
* Update Meta Conversions API Data Destination Config
* Update HTTP Custom Connect Data Destination Config

### [Data Pipelines Objects](gateway-products/gateway-control-plane-api/setup-data-pipelines/objects.md)

* The set of objects used by the Data Pipelines APIs.
