---
title: "Parameters"
source: "https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters"
scraped_at: "2026-09-12T19:05:55.979Z"
---

# Parameters



These parameters consist of all required event data parameters and any additional data parameters the Conversions API needs to use for ads attribution and/or ads delivery optimization.

**Warning:** [The Conversions API](conversions-api.md) now supports web, app, offline, and business messaging events.

Website events shared using the Conversions API require the [`client_user_agent`](conversions-api/parameters/customer-information-parameters.md#client-user-agent), [`action_source`](conversions-api/parameters/server-event.md#action-source), and [`event_source_url`](conversions-api/parameters/server-event.md#event-source-url) parameters, while non-web events **require only** [`action_source`](conversions-api/parameters/server-event.md#action-source). These parameters contribute to improving the quality of events used for ad delivery and may improve campaign performance.

By using the Conversions API, you agree that the [`action_source`](conversions-api/parameters/server-event.md#action-source) parameter is accurate to the best of your knowledge.

### [Main Body Parameters](conversions-api/parameters/main-body.md)

* [`data`](conversions-api/parameters/main-body.md#data)
* [`test_event_code`](conversions-api/parameters/main-body.md#test_event_code)

### [Customer Information Parameters](conversions-api/parameters/customer-information-parameters.md)

* [`em`: Email](conversions-api/parameters/customer-information-parameters.md#em) — Hashing required
* [`ph`: Phone Number](conversions-api/parameters/customer-information-parameters.md#ph) — Hashing required
* [`fn`: First Name](conversions-api/parameters/customer-information-parameters.md#fn) — Hashing required
* [`ln`: Last Name](conversions-api/parameters/customer-information-parameters.md#ln) — Hashing required
* [`ge`: Gender](conversions-api/parameters/customer-information-parameters.md#ge) — Hashing required
* [`db`: Date of Birth](conversions-api/parameters/customer-information-parameters.md#db) — Hashing required
* [`ct`: City](conversions-api/parameters/customer-information-parameters.md#ct) — Hashing required
* [`st`: State](conversions-api/parameters/customer-information-parameters.md#st) — Hashing required
* [`zp`: Zip Code](conversions-api/parameters/customer-information-parameters.md#zp) — Hashing required
* [`country`: Country](conversions-api/parameters/customer-information-parameters.md#country) — Hashing required
* [`external_id`: External ID](conversions-api/parameters/customer-information-parameters.md#external-id) — Hashing recommended
* [`client_ip_address`: Client IP Address](conversions-api/parameters/customer-information-parameters.md#client-ip-address) — Do not hash
* [`client_user_agent`: Client User Agent](conversions-api/parameters/customer-information-parameters.md#client-user-agent) — Do not hash
* [`fbc`: Click ID](conversions-api/parameters/customer-information-parameters.md#fbc) — Do not hash
* [`fbp`: Browser ID](conversions-api/parameters/customer-information-parameters.md#fbp) — Do not hash
* [`subscription_id`: Subscription ID](conversions-api/parameters/customer-information-parameters.md#subscription-id) — Do not hash
* [`fb_login_id`: Facebook Login ID](conversions-api/parameters/customer-information-parameters.md#fb_login_id) — Do not hash
* [`lead_id`: Lead ID](conversions-api/parameters/customer-information-parameters.md#lead_id) — Do not hash
* [`anon_id`: Install ID](conversions-api/parameters/customer-information-parameters.md#anon_id) — Do not hash (_**Note:** This parameter is for app events only_)
* [`madid`: Mobile Advertiser ID](conversions-api/parameters/customer-information-parameters.md#madid) — Do not hash (_**Note:** This parameter is for app events only_)
* [`page_id`: Page ID](conversions-api/parameters/customer-information-parameters.md#page_id) — Do not hash
* [`page_scoped_user_id`: Page scoped user ID](conversions-api/parameters/customer-information-parameters.md#page_scoped_user_id) — Do not hash
* [`ctwa_clid`: Click to WhatsApp ID](conversions-api/parameters/customer-information-parameters.md#ctwa_clid) — Do not hash
* [`ig_account_id`: IG account ID](conversions-api/parameters/customer-information-parameters.md#ig_account_id) — Do not hash
* [`ig_sid`: Click to Instagram ID](conversions-api/parameters/customer-information-parameters.md#ig_sid) — Do not hash

### [Server Event Parameters](conversions-api/parameters/server-event.md)

- [`event_name`](conversions-api/parameters/server-event.md#event-name)
- [`event_time`](conversions-api/parameters/server-event.md#event-time)
- [`user_data`](conversions-api/parameters/server-event.md#user-data)
- [`custom_data`](conversions-api/parameters/server-event.md#custom-data)
- [`event_source_url`](conversions-api/parameters/server-event.md#event-source-url)
- [`opt_out`](conversions-api/parameters/server-event.md#opt-out)
- [`event_id`](conversions-api/parameters/server-event.md#event-id)
- [`action_source`](conversions-api/parameters/server-event.md#action-source)
- [`data_processing_options`](conversions-api/parameters/server-event.md#data-processing-options)
- [`data_processing_options_country`](conversions-api/parameters/server-event.md#data-processing-options-country)
- [`data_processing_options_state`](conversions-api/parameters/server-event.md#data-processing-options-state)
- [`referrer_url`](conversions-api/parameters/server-event.md#referrer-url)
- [`customer_segmentation`](conversions-api/parameters/server-event.md#customer-segmentation)

### [App Data Parameters](conversions-api/parameters/app-data.md)

- [`advertiser_tracking_enabled`](conversions-api/parameters/app-data.md#advertiser-tracking-enabled)
- [`application_tracking_enabled`](conversions-api/parameters/app-data.md#application-tracking-enabled)
- [`extinfo`](conversions-api/parameters/app-data.md#extinfo)
- [`campaign_ids`](conversions-api/parameters/app-data.md#campaign-ids)
- [`install_referrer`](conversions-api/parameters/app-data.md#install-referrer)
- [`installer_package`](conversions-api/parameters/app-data.md#installer-package)
- [`url_schemes`](conversions-api/parameters/app-data.md#url-schemes)
- [`windows_attribution_id`](conversions-api/parameters/app-data.md#windows-attribution-id)
- [`anon_id`](conversions-api/parameters/customer-information-parameters.md#anon_id)
- [`madid`](conversions-api/parameters/customer-information-parameters.md#madid)
- [`vendor_id`](conversions-api/parameters/app-data.md#vendor-id)

_**Note**: See the [Conversions API for App Events](conversions-api/app-events.md) documentation for guidance on integrating app events._  

### [Standard Parameters](conversions-api/parameters/custom-data.md)

See a list of all [standard parameters](conversions-api/parameters/custom-data.md) users can send to Meta.

### [Original Event Data Parameters](conversions-api/parameters/original-event.md)

- [`event_name`](conversions-api/parameters/original-event.md#event-name-oed)
- [`event_time`](conversions-api/parameters/original-event.md#event-time-oed)
- [`order_id`](conversions-api/parameters/original-event.md#order-id-oed)
- [`event_id`](conversions-api/parameters/original-event.md#event-id-oed)

### Conversions API for Lead Optimization

If you integrate your CRM system with the Conversions API for lead events, refer to the [CRM Integration](conversions-api/guides/crm-integration.md) guide for the required fields.

### See Also

- Overview: [`fbp` and `fbc` Parameters](conversions-api/parameters/fbp-and-fbc.md)

## Learn More

- [Conversions API: Documentation](conversions-api.md)

- [Using the Conversions API](conversions-api/using-the-api.md)

- [Meta Privacy and Data Use Guide](https://www.facebook.com/business/m/privacy-and-data#Data-Use-&-Ads)
