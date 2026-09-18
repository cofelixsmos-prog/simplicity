const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const crypto = require('crypto');
const express = require('express');
const { requireAuth } = require('../middleware/session');

const CACHE_ROOT = path.join(__dirname, '..', '..', 'data', 'model-cache');

const UPSTREAMS = {
  hf: 'https://huggingface.co',
  gh: 'https://raw.githubusercontent.com',
};

// Hugging Face's large-file CDN (Xet-backed storage) redirects here from the
// huggingface.co request — followed transparently by fetch's default
// redirect:"follow", so no special handling needed beyond allow-listing it
// isn't required at all since Node's fetch doesn't apply CSP.

const UPSTREAM_MAX_ATTEMPTS = 4;
const UPSTREAM_RETRY_DELAY_MS = 1000;

// Distinct-file upstream fetches are capped so a burst of shard requests for
// one model can't open dozens of simultaneous outbound connections. Cache
// *hits* never touch this limit — they're plain disk reads. This differs
// from the earlier (reverted) proxy's global semaphore, which throttled
// every request including cache hits; scoping the limit to "fetches that
// actually go to the network" is the fix.
const MAX_CONCURRENT_UPSTREAM_FETCHES = 4;
let activeUpstreamFetches = 0;
const waitQueue = [];

function acquireSlot() {
  if (activeUpstreamFetches < MAX_CONCURRENT_UPSTREAM_FETCHES) {
    activeUpstreamFetches += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => waitQueue.push(resolve));
}

function releaseSlot() {
  const next = waitQueue.shift();
  if (next) {
    next();
  } else {
    activeUpstreamFetches = Math.max(0, activeUpstreamFetches - 1);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Single-flight: multiple simultaneous requests for the same not-yet-cached
// file (the browser opens several parallel connections per model, and two
// users may download the same model at once) share one upstream fetch
// instead of each starting their own.
const inFlight = new Map();

function cachePathFor(upstreamKey, targetPath) {
  const safe = targetPath.split('/').filter((seg) => seg && seg !== '.' && seg !== '..').join('/');
  return path.join(CACHE_ROOT, upstreamKey, safe);
}

async function fetchUpstream(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Upstream responded ${res.status} for ${url}`);
  }
  return res;
}

// Streams one fetch attempt straight to a temp file. Model weight shards are
// multi-hundred-MB downloads, so a transient network blip mid-stream (the
// realistic failure mode, as opposed to just the initial connect) is
// expected — this throws on any failure so the caller can retry the whole
// attempt from scratch.
async function streamToTempFile(url, tmpFile) {
  const res = await fetchUpstream(url);
  const writeStream = fs.createWriteStream(tmpFile);
  await new Promise((resolve, reject) => {
    const body = res.body;
    if (!body || !body.pipeTo) {
      reject(new Error('Response body is not streamable'));
      return;
    }
    body.pipeTo(new WritableStream({
      write(chunk) {
        return new Promise((res2, rej2) => {
          writeStream.write(Buffer.from(chunk), (err) => (err ? rej2(err) : res2()));
        });
      },
      close() {
        writeStream.end(resolve);
      },
      abort(err) {
        writeStream.destroy();
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    })).catch((err) => {
      writeStream.destroy();
      reject(err);
    });
  });
}

// Downloads the upstream file to a temp path and atomically renames it into
// place on success, so a request that reads the cache file mid-write (or a
// crash mid-download) can never observe a truncated file. Retries the whole
// fetch-and-stream attempt (not just the initial connect) since mid-stream
// drops are the realistic failure mode for large files.
async function populateCache(upstreamKey, targetPath, cacheFile) {
  const url = `${UPSTREAMS[upstreamKey]}/${targetPath}`;
  await acquireSlot();
  try {
    await fsp.mkdir(path.dirname(cacheFile), { recursive: true });
    let lastErr;
    for (let attempt = 1; attempt <= UPSTREAM_MAX_ATTEMPTS; attempt += 1) {
      const tmpFile = `${cacheFile}.tmp-${crypto.randomBytes(6).toString('hex')}`;
      try {
        await streamToTempFile(url, tmpFile);
        await fsp.rename(tmpFile, cacheFile);
        return;
      } catch (err) {
        lastErr = err;
        await fsp.unlink(tmpFile).catch(() => {});
        if (attempt < UPSTREAM_MAX_ATTEMPTS) {
          await delay(UPSTREAM_RETRY_DELAY_MS * attempt);
        }
      }
    }
    throw lastErr;
  } finally {
    releaseSlot();
  }
}

function getOrPopulate(upstreamKey, targetPath, cacheFile) {
  const flightKey = `${upstreamKey}/${targetPath}`;
  if (inFlight.has(flightKey)) return inFlight.get(flightKey);
  const p = populateCache(upstreamKey, targetPath, cacheFile).finally(() => {
    inFlight.delete(flightKey);
  });
  inFlight.set(flightKey, p);
  return p;
}

function makeHandler(upstreamKey) {
  return async function handler(req, res, next) {
    try {
      const splat = req.params.splat;
      const targetPath = Array.isArray(splat) ? splat.join('/') : splat;
      if (!targetPath || targetPath.includes('..')) {
        return res.status(400).json({ error: 'Invalid path.' });
      }
      const cacheFile = cachePathFor(upstreamKey, targetPath);

      let stat;
      try {
        stat = await fsp.stat(cacheFile);
      } catch {
        stat = null;
      }

      if (!stat) {
        await getOrPopulate(upstreamKey, targetPath, cacheFile);
      }

      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      return res.sendFile(cacheFile, (err) => {
        if (err && !res.headersSent) next(err);
      });
    } catch (err) {
      next(err);
    }
  };
}

const router = express.Router();

// Every model-cache route requires an authenticated session, same as the
// rest of the app's data — this isn't meant as a public open proxy.
router.get('/hf/*splat', requireAuth, makeHandler('hf'));
router.get('/gh/*splat', requireAuth, makeHandler('gh'));

module.exports = router;
