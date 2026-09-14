---
title: "Commerce Merchant Settings API"
source: "https://developers.facebook.com/documentation/ads-commerce/catalog/guides/commerce-merchant-settings-api"
scraped_at: "2026-09-12T19:02:04.503Z"
---

# Commerce Merchant Settings API



This API can be used to update commerce merchant settings (CMS) details, such as merchant status, privacy policy URLs, checkout config and Korea Fair Trade Commission (FTC) listing page.

## Prerequisites

To perform requests to this API, you'll need to provide the CMS ID. Also, the checkout config is only available for merchants with a partner integration already set up.

## POST Endpoint

Make a `POST` request to:

```
https://graph.facebook.com/{graph_api_version}/{COMMERCE_MERCHANT_SETTINGS_ID}
```

* {graph_api_version}: The Graph API version (for example, "v20.0")
* {COMMERCE_MERCHANT_SETTINGS_ID}: Your commerce merchant settings ID retrieved from `GET fbe_business/fbe_installs?fbe_external_business_id=<external_business_id>`. More details about how to retrieve this ID is available in this [documentation](https://developers.facebook.com/docs/facebook-business-extension/fbe/guides/get-features#parsing-webhook-at-uninstall).

### Parameters

| Field | Description |
| --- | --- |
| `access_token`<br><br>type: `string` | **Required**<br><br>A valid Graph API access token |
| `merchant_status`<br><br>type: `string` | **Optional.**<br><br>Determines the current status for this merchant. Can be set to `externally_disabled` using this API. |
| `privacy_policy_localized`<br><br>type: `object` | **Optional.**<br><br>Determines the language-specific privacy policy:<br><br>* `url` (string) **required**: The privacy policy URL<br>* `locale` (string) **required**: The privacy policy locale, such as: `en` (English). Note: locale follows BCP 47 format. |
| `korea_ftc_listing`<br><br>type: `string` | **Optional.**<br><br>The URL link to the seller's Korea Fair Trade Commission (FTC) listing page. |
| `checkout_config`<br><br>type: `object` | **Optional.**<br><br>Configures the web checkout experience for merchants. This parameter requires a partner integration to be already set up.<br><br>* `checkout_url` (string) **required**: URL pointing to the merchant's checkout page.<br>* `country_code` (string) **required**: Country code indicating which country this checkout config applies to. |

### Sample cURL Request {#sample-curl-req}

```
curl -X POST \
  "https://graph.facebook.com/v20.0/{COMMERCE_MERCHANT_SETTINGS_ID}" \
  -F "access_token={YOUR_ACCESS_TOKEN}" \
  -F "merchant_status=enabled" \
  -F "privacy_policy_localized[url]=https://mystore.com/privacy" \
  -F "privacy_policy_localized[locale]=ko" \
  -F "korea_ftc_listing=https://www.mystore.com/kftc" \
  -F "checkout_config[checkout_url]=https://mystore.com/checkout" \
  -F "checkout_config[country_code]=KR"
```

Replace:

* `YOUR_ACCESS_TOKEN` with your valid token.
* `{COMMERCE_MERCHANT_SETTINGS_ID}` with your CMS ID (returned during Meta Business Extension onboarding)

## GET Endpoint

Make a `GET` request to:

```
https://graph.facebook.com/{graph_api_version}/{COMMERCE_MERCHANT_SETTINGS_ID}
```

* {graph_api_version}: The Graph API version (for example, "v20.0")
* {COMMERCE_MERCHANT_SETTINGS_ID}: Your commerce merchant settings ID retrieved from `GET fbe_business/fbe_installs?fbe_external_business_id=<external_business_id>`. More details about how to retrieve this ID is available in this [documentation](https://developers.facebook.com/docs/facebook-business-extension/fbe/guides/get-features#parsing-webhook-at-uninstall).

### Fields

#### Basic Fields

* `id`
* `display_name`
* `merchant_status`
* `contact_email`
* `terms`

#### Policy Fields (requires `locale` parameter)

* `privacy_policy_localized`
* `korea_ftc_listing`

#### Configuration Fields (requires `country_code` parameter)

* `checkout_config`
* `cta`
* `shops_ads_setup`

#### Edges/Relationships

* product_catalogs
* setup_status
* tax_settings
* onsite_commerce_merchant
* order_management_apps
* shipping_profiles
* shops_collection_destinations
* shops (requires catalog management permission)

### Sample cURL Request {#sample-curl-req}

```
curl -X GET https://graph.facebook.com/v20.0/{COMMERCE_MERCHANT_SETTINGS_ID} \
-G \
 -d 'access_token=<ACCESS_TOKEN>' \
 -d \
'fields=id,display_name,merchant_status,shops_ads_setup.country_code(KR),checkout_config.country_code(KR)'
```

Replace:

* `YOUR_ACCESS_TOKEN` with your valid token.
* `{COMMERCE_MERCHANT_SETTINGS_ID}` with your CMS ID (returned during Meta Business Extension onboarding)
