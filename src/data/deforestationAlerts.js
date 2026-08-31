import * as Cesium from 'cesium';
import { ecoLayerEnabled, ecoLayerDisabled } from './ecoLayerGlobeGuard.js';

/**
 * OPERA Land Surface Disturbance Alerts (DIST-ALERT-HLS) via NASA GIBS WMTS.
 *
 * Detects vegetation disturbance — deforestation, fire damage, land clearing —
 * from Harmonized Landsat Sentinel-2 (HLS) data at 30 m resolution. Updated
 * every 2–5 days globally. Color index shows confirmed and provisional
 * disturbance alerts.
 *
 * Source: NASA GIBS — OPERA Project (JPL)
 * No authentication required.
 */

function gibsDateString(daysAgo = 5) {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return d.toISOString().slice(0, 10);
}

export function createDeforestationLayer() {
  let _imageryLayer = null;
  let _enabled = false;
  let _lastUpdate = null;

  function buildProvider(dateStr) {
    return new Cesium.WebMapTileServiceImageryProvider({
      url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?TIME=' + dateStr,
      layer: 'OPERA_L3_DIST-ALERT-HLS_Color_Index',
      style: 'default',
      tileMatrixSetID: 'GoogleMapsCompatible_Level12',
      format: 'image/png',
      credit: new Cesium.Credit('NASA GIBS — OPERA DIST-ALERT-HLS'),
    });
  }

  const layer = {
    id: 'eco-deforestation',
    name: 'Deforestation Alerts',
    icon: '🪓',
    source: 'NASA GIBS · OPERA',
    updateInterval: 3600000,

    init(viewer) {
      const provider = buildProvider(gibsDateString(5));
      _imageryLayer = viewer.imageryLayers.addImageryProvider(provider);
      _imageryLayer.show = false;
      _imageryLayer.alpha = 0.8;

      _enabled = false;
      _lastUpdate = null;
      console.log('[Data:Deforestation] Initialized');
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
        const dateStr = gibsDateString(5);
        const newProvider = buildProvider(dateStr);

        if (_imageryLayer) {
          viewer.imageryLayers.remove(_imageryLayer, true);
        }
        _imageryLayer = viewer.imageryLayers.addImageryProvider(newProvider);
        _imageryLayer.show = _enabled;
        _imageryLayer.alpha = 0.8;

        _lastUpdate = Date.now();
        console.log(`[Data:Deforestation] Updated to date ${dateStr}`);
        return true;
      } catch (e) {
        console.warn('[Data:Deforestation] Update error:', e);
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

const deforestationLayer = createDeforestationLayer();
export default deforestationLayer;
