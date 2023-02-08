import Check from "../Core/Check.js";
import defaultValue from "../Core/defaultValue.js";
import defined from "../Core/defined.js";
import deprecationWarning from "../Core/deprecationWarning.js";
import Event from "../Core/Event.js";
import IonResource from "../Core/IonResource.js";
import RuntimeError from "../Core/RuntimeError.js";
import ArcGisMapServerImageryProvider from "./ArcGisMapServerImageryProvider.js";
import BingMapsImageryProvider from "./BingMapsImageryProvider.js";
import TileMapServiceImageryProvider from "./TileMapServiceImageryProvider.js";
import GoogleEarthEnterpriseMapsProvider from "./GoogleEarthEnterpriseMapsProvider.js";
import MapboxImageryProvider from "./MapboxImageryProvider.js";
import SingleTileImageryProvider from "./SingleTileImageryProvider.js";
import UrlTemplateImageryProvider from "./UrlTemplateImageryProvider.js";
import WebMapServiceImageryProvider from "./WebMapServiceImageryProvider.js";
import WebMapTileServiceImageryProvider from "./WebMapTileServiceImageryProvider.js";

function createFactory(Type) {
  return function (options) {
    return new Type(options);
  };
}

// These values are the list of supported external imagery
// assets in the Cesium ion beta. They are subject to change.
const ImageryProviderMapping = {
  ARCGIS_MAPSERVER: createFactory(ArcGisMapServerImageryProvider),
  BING: createFactory(BingMapsImageryProvider),
  GOOGLE_EARTH: createFactory(GoogleEarthEnterpriseMapsProvider),
  MAPBOX: createFactory(MapboxImageryProvider),
  SINGLE_TILE: createFactory(SingleTileImageryProvider),
  TMS: createFactory(TileMapServiceImageryProvider),
  URL_TEMPLATE: createFactory(UrlTemplateImageryProvider),
  WMS: createFactory(WebMapServiceImageryProvider),
  WMTS: createFactory(WebMapTileServiceImageryProvider),
};

const ImageryProviderAsyncMapping = {
  ARCGIS_MAPSERVER: ArcGisMapServerImageryProvider.fromUrl,
  BING: async (url, options) => {
    const key = options.key;
    delete options.key;
    return BingMapsImageryProvider.fromUrl(url, key, options);
  },
  GOOGLE_EARTH: async (url, options) => {
    const channel = options.channel;
    delete options.channel;
    return GoogleEarthEnterpriseMapsProvider.fromUrl(url, channel, options);
  },
  MAPBOX: (url, options) => {
    return new MapboxImageryProvider({
      url: url,
      ...options,
    });
  },
  SINGLE_TILE: SingleTileImageryProvider.fromUrl,
  TMS: TileMapServiceImageryProvider.fromUrl,
  URL_TEMPLATE: (url, options) => {
    return new UrlTemplateImageryProvider({
      url: url,
      ...options,
    });
  },
  WMS: (url, options) => {
    return new WebMapServiceImageryProvider({
      url: url,
      ...options,
    });
  },
  WMTS: (url, options) => {
    return new WebMapTileServiceImageryProvider({
      url: url,
      ...options,
    });
  },
};

/**
 * @typedef {Object} IonImageryProvider.ConstructorOptions
 *
 * Initialization options for the TileMapServiceImageryProvider constructor
 *
 * @property {Number} [assetId] An ion imagery asset ID. Deprecated.
 * @property {String} [accessToken=Ion.defaultAccessToken] The access token to use.
 * @property {String|Resource} [server=Ion.defaultServer] The resource to the Cesium ion API server.
 */

/**
 * <div class="notice">
 * To construct a IonImageryProvider, call {@link IonImageryProvider.fromAssetId}. Do not call the constructor directly.
 * </div>
 *
 * Provides tiled imagery using the Cesium ion REST API.
 *
 * @alias IonImageryProvider
 * @constructor
 *
 * @param {IonImageryProvider.ConstructorOptions} options Object describing initialization options
 *
 * @example
 * const imageryProvider = await Cesium.IonImageryProvider.fromAssetId(2348902);
 * viewer.imageryLayers.addImageryProvider(imageryProvider);
 *
 * @see IonImageryProvider.fromAssetId
 */
function IonImageryProvider(options) {
  options = defaultValue(options, defaultValue.EMPTY_OBJECT);

  /**
   * The default alpha blending value of this provider, with 0.0 representing fully transparent and
   * 1.0 representing fully opaque.
   *
   * @type {Number|undefined}
   * @default undefined
   */
  this.defaultAlpha = undefined;

  /**
   * The default alpha blending value on the night side of the globe of this provider, with 0.0 representing fully transparent and
   * 1.0 representing fully opaque.
   *
   * @type {Number|undefined}
   * @default undefined
   */
  this.defaultNightAlpha = undefined;

  /**
   * The default alpha blending value on the day side of the globe of this provider, with 0.0 representing fully transparent and
   * 1.0 representing fully opaque.
   *
   * @type {Number|undefined}
   * @default undefined
   */
  this.defaultDayAlpha = undefined;

  /**
   * The default brightness of this provider.  1.0 uses the unmodified imagery color.  Less than 1.0
   * makes the imagery darker while greater than 1.0 makes it brighter.
   *
   * @type {Number|undefined}
   * @default undefined
   */
  this.defaultBrightness = undefined;

  /**
   * The default contrast of this provider.  1.0 uses the unmodified imagery color.  Less than 1.0 reduces
   * the contrast while greater than 1.0 increases it.
   *
   * @type {Number|undefined}
   * @default undefined
   */
  this.defaultContrast = undefined;

  /**
   * The default hue of this provider in radians. 0.0 uses the unmodified imagery color.
   *
   * @type {Number|undefined}
   * @default undefined
   */
  this.defaultHue = undefined;

  /**
   * The default saturation of this provider. 1.0 uses the unmodified imagery color. Less than 1.0 reduces the
   * saturation while greater than 1.0 increases it.
   *
   * @type {Number|undefined}
   * @default undefined
   */
  this.defaultSaturation = undefined;

  /**
   * The default gamma correction to apply to this provider.  1.0 uses the unmodified imagery color.
   *
   * @type {Number|undefined}
   * @default undefined
   */
  this.defaultGamma = undefined;

  /**
   * The default texture minification filter to apply to this provider.
   *
   * @type {TextureMinificationFilter}
   * @default undefined
   */
  this.defaultMinificationFilter = undefined;

  /**
   * The default texture magnification filter to apply to this provider.
   *
   * @type {TextureMagnificationFilter}
   * @default undefined
   */
  this.defaultMagnificationFilter = undefined;

  this._ready = false;
  this._tileCredits = undefined;
  this._errorEvent = new Event();

  const assetId = options.assetId;
  if (defined(assetId)) {
    deprecationWarning(
      "IonImageryProvider options.assetId",
      "options.assetId was deprecated in CesiumJS 1.102.  It will be removed in 1.104.  Use IonImageryProvider.fromAssetId instead."
    );

    IonImageryProvider._initialize(this, assetId, options);
  }
}

Object.defineProperties(IonImageryProvider.prototype, {
  /**
   * Gets a value indicating whether or not the provider is ready for use.
   * @memberof IonImageryProvider.prototype
   * @type {Boolean}
   * @readonly
   * @deprecated
   */
  ready: {
    get: function () {
      deprecationWarning(
        "IonImageryProvider.ready",
        "IonImageryProvider.ready was deprecated in CesiumJS 1.102.  It will be removed in 1.104.  Use IonImageryProvider.fromAssetId instead."
      );
      return this._ready;
    },
  },

  /**
   * Gets a promise that resolves to true when the provider is ready for use.
   * @memberof IonImageryProvider.prototype
   * @type {Promise.<Boolean>}
   * @readonly
   * @deprecated
   */
  readyPromise: {
    get: function () {
      deprecationWarning(
        "IonImageryProvider.readyPromise",
        "IonImageryProvider.readyPromise was deprecated in CesiumJS 1.102.  It will be removed in 1.104.  Use IonImageryProvider.fromAssetId instead."
      );
      return this._readyPromise;
    },
  },

  /**
   * Gets the rectangle, in radians, of the imagery provided by the instance.
   * @memberof IonImageryProvider.prototype
   * @type {Rectangle}
   * @readonly
   */
  rectangle: {
    get: function () {
      return this._imageryProvider.rectangle;
    },
  },

  /**
   * Gets the width of each tile, in pixels.
   * @memberof IonImageryProvider.prototype
   * @type {Number}
   * @readonly
   */
  tileWidth: {
    get: function () {
      return this._imageryProvider.tileWidth;
    },
  },

  /**
   * Gets the height of each tile, in pixels.
   * @memberof IonImageryProvider.prototype
   * @type {Number}
   * @readonly
   */
  tileHeight: {
    get: function () {
      return this._imageryProvider.tileHeight;
    },
  },

  /**
   * Gets the maximum level-of-detail that can be requested.
   * @memberof IonImageryProvider.prototype
   * @type {Number|undefined}
   * @readonly
   */
  maximumLevel: {
    get: function () {
      return this._imageryProvider.maximumLevel;
    },
  },

  /**
   * Gets the minimum level-of-detail that can be requested. Generally,
   * a minimum level should only be used when the rectangle of the imagery is small
   * enough that the number of tiles at the minimum level is small.  An imagery
   * provider with more than a few tiles at the minimum level will lead to
   * rendering problems.
   * @memberof IonImageryProvider.prototype
   * @type {Number}
   * @readonly
   */
  minimumLevel: {
    get: function () {
      return this._imageryProvider.minimumLevel;
    },
  },

  /**
   * Gets the tiling scheme used by the provider.
   * @memberof IonImageryProvider.prototype
   * @type {TilingScheme}
   * @readonly
   */
  tilingScheme: {
    get: function () {
      return this._imageryProvider.tilingScheme;
    },
  },

  /**
   * Gets the tile discard policy.  If not undefined, the discard policy is responsible
   * for filtering out "missing" tiles via its shouldDiscardImage function.  If this function
   * returns undefined, no tiles are filtered.
   * @memberof IonImageryProvider.prototype
   * @type {TileDiscardPolicy}
   * @readonly
   */
  tileDiscardPolicy: {
    get: function () {
      return this._imageryProvider.tileDiscardPolicy;
    },
  },

  /**
   * Gets an event that is raised when the imagery provider encounters an asynchronous error.  By subscribing
   * to the event, you will be notified of the error and can potentially recover from it.  Event listeners
   * are passed an instance of {@link TileProviderError}.
   * @memberof IonImageryProvider.prototype
   * @type {Event}
   * @readonly
   */
  errorEvent: {
    get: function () {
      return this._errorEvent;
    },
  },

  /**
   * Gets the credit to display when this imagery provider is active.  Typically this is used to credit
   * the source of the imagery.
   * @memberof IonImageryProvider.prototype
   * @type {Credit}
   * @readonly
   */
  credit: {
    get: function () {
      return this._imageryProvider.credit;
    },
  },

  /**
   * Gets a value indicating whether or not the images provided by this imagery provider
   * include an alpha channel.  If this property is false, an alpha channel, if present, will
   * be ignored.  If this property is true, any images without an alpha channel will be treated
   * as if their alpha is 1.0 everywhere.  When this property is false, memory usage
   * and texture upload time are reduced.
   * @memberof IonImageryProvider.prototype
   * @type {Boolean}
   * @readonly
   */
  hasAlphaChannel: {
    get: function () {
      return this._imageryProvider.hasAlphaChannel;
    },

    /**
     * Gets the proxy used by this provider.
     * @memberof IonImageryProvider.prototype
     * @type {Proxy}
     * @readonly
     * @default undefined
     */
    proxy: {
      get: function () {
        return undefined;
      },
    },
  },
});

// This is here for backwards compatibility
IonImageryProvider._initialize = function (provider, assetId, options) {
  const endpointResource = IonResource._createEndpointResource(
    assetId,
    options
  );

  // A simple cache to avoid making repeated requests to ion for endpoints we've
  // already retrieved. This exists mainly to support Bing caching to reduce
  // world imagery sessions, but provides a small boost of performance in general
  // if constantly reloading assets
  const cacheKey = assetId.toString() + options.accessToken + options.server;
  let promise = IonImageryProvider._endpointCache[cacheKey];
  if (!defined(promise)) {
    promise = endpointResource.fetchJson();
    IonImageryProvider._endpointCache[cacheKey] = promise;
  }

  provider._readyPromise = promise.then(function (endpoint) {
    if (endpoint.type !== "IMAGERY") {
      return Promise.reject(
        new RuntimeError(`Cesium ion asset ${assetId} is not an imagery asset.`)
      );
    }

    let imageryProvider;
    const externalType = endpoint.externalType;
    if (!defined(externalType)) {
      imageryProvider = new TileMapServiceImageryProvider({
        url: new IonResource(endpoint, endpointResource),
      });
    } else {
      const factory = ImageryProviderMapping[externalType];

      if (!defined(factory)) {
        return Promise.reject(
          new RuntimeError(
            `Unrecognized Cesium ion imagery type: ${externalType}`
          )
        );
      }
      imageryProvider = factory(endpoint.options);
    }

    provider._tileCredits = IonResource.getCreditsFromEndpoint(
      endpoint,
      endpointResource
    );

    imageryProvider.errorEvent.addEventListener(function (tileProviderError) {
      //Propagate the errorEvent but set the provider to this instance instead
      //of the inner instance.
      tileProviderError.provider = provider;
      provider._errorEvent.raiseEvent(tileProviderError);
    });

    provider._imageryProvider = imageryProvider;
    // readyPromise is deprecated. This is here for backwards compatibility
    return Promise.resolve(imageryProvider._readyPromise).then(function () {
      provider._ready = true;
      return true;
    });
  });
};

/**
 * Creates a provider for tiled imagery using the Cesium ion REST API.
 *
 * @param {Number} assetId  An ion imagery asset ID.
 * @param {IonImageryProvider.ConstructorOptions} options Object describing initialization options.
 * @returns {Promise<IonImageryProvider>} A promise which resolves to the created IonImageryProvider.
 *
 * @example
 * const imageryProvider = await Cesium.IonImageryProvider.fromAssetId(2348902);
 * viewer.imageryLayers.addImageryProvider(imageryProvider);
 *
 * @exception {RuntimeError} Cesium ion assetId is not an imagery asset
 * @exception {RuntimeError} Unrecognized Cesium ion imagery type
 */
IonImageryProvider.fromAssetId = async function (assetId, options) {
  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.number("assetId", assetId);
  //>>includeEnd('debug');

  options = defaultValue(options, defaultValue.EMPTY_OBJECT);
  const endpointResource = IonResource._createEndpointResource(
    assetId,
    options
  );

  // A simple cache to avoid making repeated requests to ion for endpoints we've
  // already retrieved. This exists mainly to support Bing caching to reduce
  // world imagery sessions, but provides a small boost of performance in general
  // if constantly reloading assets
  const cacheKey = assetId.toString() + options.accessToken + options.server;
  let promise = IonImageryProvider._endpointCache[cacheKey];
  if (!defined(promise)) {
    promise = endpointResource.fetchJson();
    IonImageryProvider._endpointCache[cacheKey] = promise;
  }

  const endpoint = await promise;
  if (endpoint.type !== "IMAGERY") {
    throw new RuntimeError(
      `Cesium ion asset ${assetId} is not an imagery asset.`
    );
  }

  let imageryProvider;
  const externalType = endpoint.externalType;
  if (!defined(externalType)) {
    imageryProvider = await TileMapServiceImageryProvider.fromUrl(
      new IonResource(endpoint, endpointResource)
    );
  } else {
    const factory = ImageryProviderAsyncMapping[externalType];

    if (!defined(factory)) {
      throw new RuntimeError(
        `Unrecognized Cesium ion imagery type: ${externalType}`
      );
    }
    const url = endpoint.options.url;
    delete endpoint.options.url;
    imageryProvider = await factory(url, endpoint.options);
  }

  const provider = new IonImageryProvider(options);

  imageryProvider.errorEvent.addEventListener(function (tileProviderError) {
    //Propagate the errorEvent but set the provider to this instance instead
    //of the inner instance.
    tileProviderError.provider = provider;
    provider._errorEvent.raiseEvent(tileProviderError);
  });

  provider._tileCredits = IonResource.getCreditsFromEndpoint(
    endpoint,
    endpointResource
  );

  provider._imageryProvider = imageryProvider;
  provider._ready = true;
  provider._readyPromise = Promise.resolve(true);

  return provider;
};

/**
 * Gets the credits to be displayed when a given tile is displayed.
 * @function
 *
 * @param {Number} x The tile X coordinate.
 * @param {Number} y The tile Y coordinate.
 * @param {Number} level The tile level;
 * @returns {Credit[]} The credits to be displayed when the tile is displayed.
 */
IonImageryProvider.prototype.getTileCredits = function (x, y, level) {
  const innerCredits = this._imageryProvider.getTileCredits(x, y, level);
  if (!defined(innerCredits)) {
    return this._tileCredits;
  }

  return this._tileCredits.concat(innerCredits);
};

/**
 * Requests the image for a given tile.
 * @function
 *
 * @param {Number} x The tile X coordinate.
 * @param {Number} y The tile Y coordinate.
 * @param {Number} level The tile level.
 * @param {Request} [request] The request object. Intended for internal use only.
 * @returns {Promise.<ImageryTypes>|undefined} A promise for the image that will resolve when the image is available, or
 *          undefined if there are too many active requests to the server, and the request should be retried later.
 */
IonImageryProvider.prototype.requestImage = function (x, y, level, request) {
  return this._imageryProvider.requestImage(x, y, level, request);
};

/**
 * Asynchronously determines what features, if any, are located at a given longitude and latitude within
 * a tile. This function is optional, so it may not exist on all ImageryProviders.
 *
 * @function
 *
 * @param {Number} x The tile X coordinate.
 * @param {Number} y The tile Y coordinate.
 * @param {Number} level The tile level.
 * @param {Number} longitude The longitude at which to pick features.
 * @param {Number} latitude  The latitude at which to pick features.
 * @return {Promise.<ImageryLayerFeatureInfo[]>|undefined} A promise for the picked features that will resolve when the asynchronous
 *                   picking completes.  The resolved value is an array of {@link ImageryLayerFeatureInfo}
 *                   instances.  The array may be empty if no features are found at the given location.
 *                   It may also be undefined if picking is not supported.
 */
IonImageryProvider.prototype.pickFeatures = function (
  x,
  y,
  level,
  longitude,
  latitude
) {
  return this._imageryProvider.pickFeatures(x, y, level, longitude, latitude);
};

//exposed for testing
IonImageryProvider._endpointCache = {};
export default IonImageryProvider;
