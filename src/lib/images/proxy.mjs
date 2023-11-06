import { Buffer } from 'buffer';
import { Readable } from 'stream';

import express from 'express'
import {
    createIPX,
    ipxFSStorage,
    ipxHttpStorage,
    createIPXWebServer,
  } from "ipx";

import { log, NETLIFYDEVERR } from "../../utils/command-helpers.mjs"

function readableStreamToNodeStream(readableStream) {
  return new Readable({
    async read() {
      const reader = readableStream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          this.push(Buffer.from(value));
        }
        this.push(null); 
      } catch (error) {
        this.destroy(error);
      }
    }
  });
}

const parseAllDomains = function(config) { 
    const domains = config?.images?.remote_images
    if (!domains) {
        return { errors: [], remoteDomains: [] }
    }

    const remoteDomains = []
    const errors = []

    for (const patternString of domains) {
      try {
        const url = new URL(patternString);
        if (url.hostname) {
          remoteDomains.push(url.hostname);
        } else {
          errors.push(`The URL '${patternString}' does not have a valid hostname.`);
        }
      } catch (error) {
        errors.push(`Invalid URL '${patternString}': ${error.message}`);
      }
    }
  
    return { errors, remoteDomains };
  }

const getErrorMessage = function ({ message }) {
    return message
}

const handleImageDomainsErrors = async function (errors) {
    if (errors.length === 0) {
        return
    }

    const errorMessage = await errors.map(getErrorMessage).join('\n\n')
    log(NETLIFYDEVERR, `Image domains syntax errors:\n${errorMessage}`)
}

export const parseRemoteImageDomains = async function ({ config }) {
    if (!config) {
        return []
    }

    const { errors, remoteDomains } = await parseAllDomains(config)
    await handleImageDomainsErrors(errors)
    
    return remoteDomains
}

export const isImageRequest = function (req) {
  const imageUrlPattern = /^\/\.netlify\/images/
  return imageUrlPattern.test(req.url)
}

const transformImageParams = function (query) {
  const params = {}

  params.w = query.w || query.width || null
  params.h = query.h || query.height || null
  params.quality = query.q || query.quality || null
  params.format = query.fm || null
  params.fit = mapImgixToFitIpx(query.fit)
  // Todo: possibly improve crop handling here
  params.position = query.crop || null 

  return Object.entries(params)
  .filter(([, value]) => value !== null)
  .map(([key, value]) => `${key}_${value}`)
  .join(",");
}

function mapImgixToFitIpx(fit) {
  const fitMapping = {
    // IPX doesn't have equivalent. 
    clamp: null, 
    clip: 'contain',
    crop: 'cover', 
    max: 'inside',
    min: 'outside', 
    scale: 'fill'
  }

  return fitMapping[fit] ?? 'contain'
}

export const initializeProxy = async function ({ config }) {
  const remoteDomains = await parseRemoteImageDomains({ config })
 
  const ipx = createIPX({
    storage: ipxFSStorage({ dir: "./public" }),
    httpStorage: ipxHttpStorage({ domains: remoteDomains }),
  });

  const handler = createIPXWebServer(ipx);
  const app = express()

  app.use("/.netlify/images", async (req, res,) => {
    const { url, ...query } = req.query;
    const modifiers = await transformImageParams(query);
    const path = `/${modifiers}/${encodeURIComponent(url)}`;
    const newUrl = new URL(path, "http://n/"); 
    const ipxResponse = await handler(new Request(newUrl), res);
    res.status(ipxResponse.status);
    ipxResponse.headers.forEach((value, name) => {
        res.setHeader(name, value);
    });

    const nodeStream = readableStreamToNodeStream(ipxResponse.body);
    nodeStream.pipe(res)
})

return app
}
