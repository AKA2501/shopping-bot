import axios from 'axios';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

const AMUL_STORE_ID = '62fa94df8c13af2e242eba16';
const AMUL_DEFAULT_HEADERS = {
  accept: 'application/json, text/plain, */*',
  'accept-language': 'en-US,en;q=0.9',
  base_url: 'https://shop.amul.com/en/browse/protein',
  'cache-control': 'no-cache',
  frontend: '1',
  pragma: 'no-cache',
  priority: 'u=1, i',
  referer: 'https://shop.amul.com/',
  'sec-ch-ua':
    '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'sec-gpc': '1',
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
};

const AMUL_SUBSTORE_IDS = {
  goa: '66506005147d6c73c1110115',
  telangana: '66506004aa64743ceefbed25',
  'pune-br': '66506004a7cddee1b8adb014',
  'solapur-br': '66506004145c16635e6cc914',
  'nashik-br': '66506002c8f2d6e221b91988',
  'aurangabad-br': '66506002aa64743ceefbecf1',
  chhattisgarh: '66506002998183e1b1935f41',
  'mumbai-br': '66506000c8f2d6e221b9193a',
  'dadra-and-nagar-haveli': '6650600062e3d963520d0bc3',
  'west-bengal': '6650600024e61363e088c526',
  odisha: '66505ffeaf6a3c7411d2f62c',
  sikkim: '66505ffe91ab653d60a3df2d',
  tripura: '66505ffe78117873bb53b6ad',
  mizoram: '66505ffd998183e1b1935e21',
  meghalaya: '66505ffd672747740fb389c7',
  nagaland: '66505ffd24e61363e088c4a5',
  manipur: '66505ffbf40e263cf5588098',
  jharkhand: '66505ffb998183e1b1935dee',
  assam: '66505ffb6510ee3d5903fef8',
  bihar: '66505ff9af6a3c7411d2f55f',
  'arunachal-pradesh': '66505ff978117873bb53b643',
  'uttar-pradesh-e': '66505ff924e61363e088c414',
  'up-ncr': '66505ff8c8f2d6e221b9180c',
  uttrakhand: '66505ff8a7cddee1b8adae9d',
  rajasthan: '66505ff824e61363e088c3dd',
  jandk: '66505ff6f40e263cf5587fb5',
  'madhya-pradesh': '66505ff6d9346de216752cd7',
  ladakh: '66505ff6145c16635e6cc7c1',
  haryana: '66505ff5af6a3c7411d2f4b2',
  'tamil-nadu-1': '66505ff578117873bb53b56a',
  delhi: '66505ff5145c16635e6cc74d',
  punjab: '66505ff3998183e1b1935d0e',
  'andhra-pradesh': '66505ff378117873bb53b542',
  pondicherry: '66505ff312a50963f24870e8',
  kerala: '66505ff2998183e1b1935ccd',
  'himachal-pradesh': '66505ff26510ee3d5903fda9',
  chandigarh: '66505ff1672747740fb388ec',
  karnataka: '66505ff0998183e1b1935c75',
  gujarat: '66505ff06510ee3d5903fd42',
  'daman-and-diu': '66505ff024e61363e088c306'
};

const AMUL_PRODUCT_FIELDS = [
  'name',
  'brand',
  'categories',
  'collections',
  'alias',
  'sku',
  'price',
  'compare_price',
  'original_price',
  'images',
  'metafields',
  'discounts',
  'catalog_only',
  'is_catalog',
  'seller',
  'available',
  'inventory_quantity',
  'net_quantity',
  'num_reviews',
  'avg_rating',
  'inventory_low_stock_quantity',
  'inventory_allow_out_of_stock',
  'default_variant',
  'variants',
  'lp_seller_ids'
];

function findFirstArray(payload, depth = 0) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isPlainObject(payload) || depth > 4) {
    return null;
  }

  const preferredKeys = ['products', 'items', 'results', 'data', 'catalog', 'payload'];
  for (const key of preferredKeys) {
    if (key in payload) {
      const found = findFirstArray(payload[key], depth + 1);
      if (found) {
        return found;
      }
    }
  }

  for (const value of Object.values(payload)) {
    const found = findFirstArray(value, depth + 1);
    if (found) {
      return found;
    }
  }

  return null;
}

function isAmulStoreUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.hostname === 'shop.amul.com';
  } catch {
    return false;
  }
}

function buildCookieHeader(setCookieValues = []) {
  return setCookieValues
    .map((value) => value.split(';', 1)[0]?.trim())
    .filter(Boolean)
    .join('; ');
}

function mergeCookieHeaders(existingCookieHeader, setCookieValues = []) {
  const cookieMap = new Map();

  for (const segment of String(existingCookieHeader || '').split(';')) {
    const trimmed = segment.trim();
    if (!trimmed) {
      continue;
    }

    const [key, ...rest] = trimmed.split('=');
    cookieMap.set(key, rest.join('='));
  }

  for (const rawCookie of setCookieValues) {
    const [pair] = String(rawCookie).split(';', 1);
    const trimmed = pair?.trim();
    if (!trimmed) {
      continue;
    }

    const [key, ...rest] = trimmed.split('=');
    cookieMap.set(key, rest.join('='));
  }

  return Array.from(cookieMap.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
}

async function calculateTidHeader(sessionTid) {
  const timestamp = Date.now().toString();
  const randomValue = Math.floor(Math.random() * 1000).toString();
  const encoded = new TextEncoder().encode(
    `${AMUL_STORE_ID}:${timestamp}:${randomValue}:${sessionTid ?? 'undefined'}`
  );
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  const hash = Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');

  return `${timestamp}:${randomValue}:${hash}`;
}

function getAmulOrigin(productUrlBase) {
  return new URL(productUrlBase).origin;
}

function getAmulBrowseUrl(config) {
  return `${getAmulOrigin(config.productUrlBase)}/en/browse/${encodeURIComponent(config.productCategory)}`;
}

function getAmulRequestHeaders(extraHeaders = {}) {
  return {
    ...AMUL_DEFAULT_HEADERS,
    ...extraHeaders
  };
}

async function initAmulSession(config) {
  const browseUrl = getAmulBrowseUrl(config);
  const browseResponse = await axios.get(browseUrl, {
    timeout: config.productRequestTimeoutMs,
    headers: getAmulRequestHeaders({
      referer: `${getAmulOrigin(config.productUrlBase)}/`
    })
  });

  const cookieHeader = buildCookieHeader(browseResponse.headers['set-cookie']);
  if (!cookieHeader) {
    throw new Error('Amul session bootstrap did not return cookies');
  }

  const infoResponse = await axios.get(`${getAmulOrigin(config.productUrlBase)}/user/info.js?_v=${Date.now()}`, {
    timeout: config.productRequestTimeoutMs,
    headers: getAmulRequestHeaders({
      referer: browseUrl,
      cookie: cookieHeader,
      tid: await calculateTidHeader(undefined)
    }),
    responseType: 'text'
  });

  const rawSessionPayload = String(infoResponse.data).replace(/^session\s*=\s*/, '').trim();
  const sessionInfo = JSON.parse(rawSessionPayload);

  return {
    browseUrl,
    cookieHeader: mergeCookieHeaders(cookieHeader, infoResponse.headers['set-cookie']),
    sessionTid: sessionInfo.tid
  };
}

async function searchAmulPincode(config, session) {
  const url =
    `${getAmulOrigin(config.productUrlBase)}/entity/pincode` +
    `?limit=50&filters[0][field]=pincode&filters[0][value]=${encodeURIComponent(config.pincode)}` +
    `&filters[0][operator]=regex&cf_cache=1h`;

  const response = await axios.get(url, {
    timeout: config.productRequestTimeoutMs,
    headers: getAmulRequestHeaders({
      referer: session.browseUrl,
      cookie: session.cookieHeader,
      tid: await calculateTidHeader(session.sessionTid)
    })
  });

  session.cookieHeader = mergeCookieHeaders(session.cookieHeader, response.headers['set-cookie']);

  const records = response.data?.records ?? [];
  if (!records.length) {
    throw new Error(`No Amul pincode record found for ${config.pincode}`);
  }

  return records[0];
}

async function setAmulPincodePreference(config, session, record) {
  const url = `${getAmulOrigin(config.productUrlBase)}/entity/ms.settings/_/setPreferences`;
  const response = await axios.put(
    url,
    {
      data: {
        store: record.substore
      }
    },
    {
      timeout: config.productRequestTimeoutMs,
      headers: getAmulRequestHeaders({
        referer: session.browseUrl,
        cookie: session.cookieHeader,
        tid: await calculateTidHeader(session.sessionTid)
      })
    }
  );

  session.cookieHeader = mergeCookieHeaders(session.cookieHeader, response.headers['set-cookie']);
}

function buildAmulProductsUrl(config, substoreValue) {
  const params = new URLSearchParams();

  for (const field of AMUL_PRODUCT_FIELDS) {
    params.append(`fields[${field}]`, '1');
  }

  params.append('filters[0][field]', 'categories');
  params.append('filters[0][value][0]', config.productCategory);
  params.append('filters[0][operator]', 'in');
  params.append('filters[0][original]', '1');
  params.append('facets', 'true');
  params.append('facetgroup', 'default_category_facet');
  params.append('limit', '32');
  params.append('total', '1');
  params.append('start', '0');
  params.append('cdc', '1m');
  params.append('device_type', 'other');

  if (substoreValue) {
    params.append('substore', substoreValue);
  }

  const query = params.toString().replace(/%5B/g, '[').replace(/%5D/g, ']');
  return `${getAmulOrigin(config.productUrlBase)}/api/1/entity/ms.products?${query}`;
}

function getAmulSubstoreCandidates(substoreAlias) {
  const candidates = [substoreAlias, AMUL_SUBSTORE_IDS[substoreAlias], null];
  return [...new Set(candidates.filter((value) => value !== undefined))];
}

async function fetchAmulProducts(config, logger) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const session = await initAmulSession(config);
    const pincodeRecord = await searchAmulPincode(config, session);
    await setAmulPincodePreference(config, session, pincodeRecord);

    const substoreCandidates = getAmulSubstoreCandidates(pincodeRecord.substore);

    for (const substoreCandidate of substoreCandidates) {
      const productsUrl = buildAmulProductsUrl(config, substoreCandidate);
      logger.info('Fetching Amul products from StoreHippo API', {
        substoreAlias: pincodeRecord.substore,
        substoreCandidate,
        pincode: config.pincode,
        attempt
      });

      const response = await axios.get(productsUrl, {
        timeout: config.productRequestTimeoutMs,
        headers: getAmulRequestHeaders({
          referer: session.browseUrl,
          cookie: session.cookieHeader,
          tid: await calculateTidHeader(session.sessionTid)
        })
      });

      const products = response.data?.data;
      if (!Array.isArray(products)) {
        throw new Error('Amul product API response did not contain a data array');
      }

      logger.info('Fetched Amul products', {
        count: products.length,
        substoreAlias: pincodeRecord.substore,
        substoreCandidate,
        attempt
      });

      if (products.length > 0) {
        return products;
      }
    }

    logger.warn('Amul API returned zero products, retrying with a fresh session', {
      substore: pincodeRecord.substore,
      pincode: config.pincode
    });
  }

  return [];
}

export async function fetchProteinProducts(config, logger) {
  if (isAmulStoreUrl(config.productUrlBase)) {
    return fetchAmulProducts(config, logger);
  }

  const params = {
    category: config.productCategory,
    pincode: config.pincode
  };

  logger.info('Fetching products', {
    productUrlBase: config.productUrlBase,
    category: config.productCategory,
    pincode: config.pincode
  });

  const response = await axios.get(config.productUrlBase, {
    params,
    timeout: config.productRequestTimeoutMs,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'shopping-bot-stock-check/1.0'
    }
  });

  const products = findFirstArray(response.data);
  if (!products) {
    throw new Error('Product API response did not contain a product array');
  }

  logger.info('Fetched raw products', { count: products.length });
  return products;
}
