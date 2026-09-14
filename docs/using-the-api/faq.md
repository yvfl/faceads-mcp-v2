---
title: "Frequently Asked Questions"
source: "https://developers.facebook.com/documentation/ads-commerce/marketing-api/using-the-api/faq"
scraped_at: "2026-09-12T17:42:28.406Z"
---

# Frequently Asked Questions



## General

**Can I use the API in a production environment without app review?**

To use the Marketing API in production, you must submit your app for review and receive approval. This process involves providing detailed information about how your app will use the API, including the specific permissions and features you intend to access. Once your app is approved, you can use the API in a production environment.

## Authorization and authentication

**How do I create an access token for the Marketing API?**

Access tokens can be generated through the Meta developer portal. Navigate to **Tools** and select **Access Token Tool**. Choose the necessary permissions based on the actions you plan to perform using the API.

See [Authentication](https://developers.facebook.com/docs/marketing-apis/overview/authentication) for more information.

## Ad campaigns

**How do I create a new campaign?**

To create a campaign, send a `POST` request to the `/act_<AD_ACCOUNT_ID>/campaigns` endpoint with parameters such as `name`, `objective`, and `status`.

See [Create an Ad Campaign](get-started/basic-ad-creation/create-an-ad-campaign.md) for more information.

## Ad sets

**Can I change my ad set's budget after it's created?**

Yes, you can update an ad set's budget by sending a `POST` request to the `/act_<AD_ACCOUNT_ID>/adsets` endpoint with the new budget parameters.

## Insights

**What is the best way to analyze my campaign performance?**

Use the [Insights API](insights.md) to make `GET` requests to the `/act_<AD_ACCOUNT_ID>/insights` endpoint. Specify the fields you want (for example, `impressions`, `clicks`, `spend`) and analyze the returned data to assess performance.

## Troubleshooting

**What should I do if my ads are not being approved?**

Review the ad content against Meta's advertising policies. Ensure compliance with all guidelines, and modify any elements that may violate the rules. You can also appeal the decision if you believe your ad was incorrectly disapproved.

**How can I help improve the performance of my ads?**

Regularly monitor performance metrics using the [Insights API](insights.md), conduct A/B testing on creatives, and refine your [audience targeting](audiences.md) based on data insights. Adjust budgets toward high-performing areas for better results.

**What should I do if my API call returns an error code?**

Review the error message returned in the API response. The message will provide context for the error, which can guide your troubleshooting efforts. Check the Meta API [Error Codes](error-reference.md) documentation for detailed explanations.

**How can I get developer support?**

Use the [Platform Bug Reports tool](https://developers.facebook.com/support/bugs/) to file issues and visit the [Meta Developer Community Forum](https://developers.facebook.com/community) to ask questions.
