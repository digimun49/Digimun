# Google Search Console Setup Guide for Digimun Pro

## Step 1: Verify Site Ownership

1. Go to [Google Search Console](https://search.google.com/search-console/)
2. Click "Add Property"
3. Choose "URL prefix" and enter: `https://digimun.pro`
4. Choose one of these verification methods:
   - **HTML file upload** (recommended): Download the verification HTML file and upload it to your site root on Netlify
   - **DNS record**: Add the TXT record Google provides to your domain DNS settings
   - **Google Analytics**: If your Google Analytics tag (G-JX5B39M7G4) is already tracking, this may auto-verify

## Step 2: Submit Your Sitemap

1. In Google Search Console, go to "Sitemaps" in the left sidebar
2. Enter `sitemap.xml` in the "Add a new sitemap" field
3. Click "Submit"
4. Verify it shows "Success" status and 129+ URLs discovered

## Step 3: Request Indexing for Key Pages

After sitemap submission, request indexing for your most important pages first:

1. Go to "URL Inspection" in the left sidebar
2. Enter each URL below and click "Request Indexing":
   - `https://digimun.pro/`
   - `https://digimun.pro/blog`
   - `https://digimun.pro/reviews`
   - `https://digimun.pro/about`
   - `https://digimun.pro/how-it-works`
   - `https://digimun.pro/faq`
   - `https://digimun.pro/pro-bot-details`
   - `https://digimun.pro/DigimunX-details`
   - `https://digimun.pro/auto-hedger-details`
   - `https://digimun.pro/future-signals-details`
   - `https://digimun.pro/money-management`
   - `https://digimun.pro/binary-options-trading`
   - `https://digimun.pro/ai-trading-signals`
   - `https://digimun.pro/trading-bots`

Note: Google limits indexing requests, so start with the most important pages above and let the crawler discover the rest via the sitemap.

## Step 4: Monitor Performance

1. Check the "Performance" tab after 3-7 days to see search impressions and clicks
2. Review "Coverage" to ensure pages are being indexed without errors
3. Check "Core Web Vitals" for any performance issues Google detects

## Tips

- Indexing can take 1-4 weeks for new pages
- The sitemap is automatically available at `https://digimun.pro/sitemap.xml`
- The robots.txt file at `https://digimun.pro/robots.txt` already allows all search engine crawlers
- Re-submit the sitemap after adding new blog posts or pages
