import { getAssetFromKV, mapRequestToAsset } from '@cloudflare/kv-asset-handler'

/**
 * The DEBUG flag will do two things:
 * 1. return plaintext errors instead of HTML views for errors
 * 2. disable cache control headers
 */
const DEBUG = false // Set to true for debugging, false for production

addEventListener('fetch', event => {
  try {
    event.respondWith(handleEvent(event))
  } catch (e) {
    if (DEBUG) {
      return event.respondWith(
        new Response(e.message || e.toString(), {
          status: 500,
        }),
      )
    }
    event.respondWith(new Response('Internal Error', { status: 500 }))
  }
})

async function handleEvent(event) {
  const url = new URL(event.request.url)
  let options = {}

  // You can add custom logic to map requests to different assets if needed.
  // For example, if you wanted to serve assets from a subdirectory like /assets/*
  // options.mapRequestToAsset = handlePrefix(/^\/assets/)

  try {
    if (DEBUG) {
      // Customize caching for DEBUG mode
      options.cacheControl = {
        bypassCache: true,
      }
    }

    // Optional: If you want SPA-like behavior (serve index.html for non-file paths)
    // options.mapRequestToAsset = req => {
    //   const defaultAssetKey = mapRequestToAsset(req);
    //   let newUrl = new URL(defaultAssetKey.url);
    //   // If the path doesn't have an extension, assume it's a path to an HTML file.
    //   if (!newUrl.pathname.split('/').pop().includes('.')) {
    //     newUrl.pathname = `${newUrl.pathname.replace(/\/$/, "")}/index.html`;
    //   }
    //   return new Request(newUrl.toString(), defaultAssetKey);
    // };

    const page = await getAssetFromKV(event, options)
    const response = new Response(page.body, page)

    // Add some security headers
    response.headers.set('X-XSS-Protection', '1; mode=block')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('Referrer-Policy', 'unsafe-url') // Consider 'strict-origin-when-cross-origin'
    // response.headers.set('Content-Security-Policy', "default-src 'self'"); // Configure as needed

    return response

  } catch (e) {
    // If asset not found, try to serve 404.html (if you have one)
    if (!DEBUG) {
      try {
        const notFoundResponse = await getAssetFromKV(event, {
          mapRequestToAsset: req => new Request(`${new URL(req.url).origin}/404.html`, req),
        })
        return new Response(notFoundResponse.body, { ...notFoundResponse, status: 404 })
      } catch (e) {
        // Fall through to 500 if 404.html also not found or other error
      }
    }
    return new Response(e.message || e.toString(), { status: 500 })
  }
}