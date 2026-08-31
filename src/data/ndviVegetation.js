import * as Cesium from 'cesium';
import { ecoLayerEnabled, ecoLayerDisabled } from './ecoLayerGlobeGuard.js';

/**
 * MODIS Terra NDVI (8-day composite) via NASA GIBS WMTS.
 *
 * Normalized Difference Vegetation Index from the MODIS instrument aboard
 * Terra. Green tones indicate healthy vegetation; brown/tan indicates bare
 * soil or senescence. Updated every 8 days.
 *
 * Source: NASA Global Imagery Browse Services (GIBS)
 * No authentication required.
 */

function gibsDateString(daysAgo = 10) {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return d.toISOString().slice(0, 10);
}

export function createNdviLayer() {
  let _imageryLayer = null;
  let _enabled = false;
  let _lastUpdate = null;

  function buildProvider(dateStr) {
    return new Cesium.WebMapTileServiceImageryProvider({
      url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?TIME=' + dateStr,
      layer: 'MODIS_Terra_NDVI_8Day',
      style: 'default',
      tileMatrixSetID: 'GoogleMapsCompatible_Level9',
      format: 'image/png',
      credit: new Cesium.Credit('NASA GIBS — MODIS Terra NDVI'),
    });
  }

  const layer = {
    id: 'eco-ndvi',
    name: 'Vegetation (NDVI)',
    icon: '🌿',
    source: 'NASA GIBS · MODIS',
    updateInterval: 3600000,

    init(viewer) {
      const provider = buildProvider(gibsDateString(10));
      _imageryLayer = viewer.imageryLayers.addImageryProvider(provider);
      _imageryLayer.show = false;
      _imageryLayer.alpha = 0.7;

      _enabled = false;
      _lastUpdate = null;
      console.log('[Data:NDVI] Initialized');
    },

    enable(viewer) {
      _enabled = true;
      if (_imageryLayer) _imageryLayer.show = true;
      ecoLayerEnabled(viewer);
    },

    disable(viewer) {
      _enabled = false;
      if (_imageryLayer) _imageryLayer.show = false;
      ecoLayerDisabled(viewer);
    },

    async update(viewer) {
      try {
        const dateStr = gibsDateString(10);
        const newProvider = buildProvider(dateStr);

        if (_imageryLayer) {
          viewer.imageryLayers.remove(_imageryLayer, true);
        }
        _imageryLayer = viewer.imageryLayers.addImageryProvider(newProvider);
        _imageryLayer.show = _enabled;
        _imageryLayer.alpha = 0.7;

        _lastUpdate = Date.now();
        console.log(`[Data:NDVI] Updated to date ${dateStr}`);
        return true;
      } catch (e) {
        console.warn('[Data:NDVI] Update error:', e);
        return false;
      }
    },

    destroy(viewer) {
      if (_enabled) ecoLayerDisabled(viewer);
      _enabled = false;
      if (_imageryLayer) {
        viewer.imageryLayers.remove(_imageryLayer, true);
        _imageryLayer = null;
      }
      _lastUpdate = null;
    },

    getStats() {
      return {
        count: _enabled ? 1 : 0,
        lastUpdate: _lastUpdate,
        error: null,
      };
    },
  };

  return layer;
}

const ndviLayer = createNdviLayer();
export default ndviLayer;
