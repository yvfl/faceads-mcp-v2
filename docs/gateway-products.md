---
title: "\"Gateway Products: Conversions API Gateway and Signals Gateway\""
source: "https://developers.facebook.com/documentation/ads-commerce/gateway-products"
scraped_at: "2026-09-12T19:19:58.760Z"
---

# "Gateway Products: Conversions API Gateway and Signals Gateway"



The [Conversions API Gateway](gateway-products/conversions-api-gateway.md) and [Signals Gateway](gateway-products/signals-gateway.md) "Gateway Products" share a common set of components and infrastructure that provides the foundation for both. This foundation is usually referred to as the "Gateway Products" in this documentation.

## [Conversions API Gateway](gateway-products/conversions-api-gateway.md)

Efficiently send events from your new or existing Meta Pixels to your Conversions API Gateway, which can then forward them to the Meta Conversions API.

* [Conversions API Gateway: Setup Guide](gateway-products/conversions-api-gateway/setup.md)
* [Conversions API Gateway Data Source Management](gateway-products/conversions-api-gateway/data-source-management.md)

## [Signals Gateway](gateway-products/signals-gateway.md)

Create flexible events pipelines that support various data sources and data destinations.

* [Signals Gateway: Setup Guide](gateway-products/signals-gateway/setup.md)
* [Pipeline Management](gateway-products/signals-gateway/pipeline-management.md)

## Gateway Platform Details

Some of the Gateway Platform's common components include:

* [Account Management](gateway-products/host-management/account-management.md)
* [Host User Management](gateway-products/host-management/user-management.md)
* [Host Settings](gateway-products/host-management/host-settings.md)
* [Control Plane API](gateway-products/gateway-control-plane-api.md)
* [Software Updates](gateway-products/updates.md)

The Gateway Platform architecture consists of the following:

* Server application which receives incoming events, transforms events, and sends them to a destination depending on which pipeline type has been configured
* A web UI where businesses can administer, maintain and monitor their Conversions API Gateway or Signals Gateway server instance

## Gateway Admin UI

Both Gateway products provide a web-based user interface for instance configuration and data management. You can access this UI from: `https://<Gateway Platform Endpoint>/hub/`

## Learn More

* [Signals Gateway](gateway-products/signals-gateway.md)
* [Conversions API Gateway](gateway-products/conversions-api-gateway.md)
