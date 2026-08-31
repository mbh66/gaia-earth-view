import * as Cesium from 'cesium';
import { ecoLayerEnabled, ecoLayerDisabled } from './ecoLayerGlobeGuard.js';

/**
 * SMAP L4 Analyzed Surface Soil Moisture via NASA GIBS WMTS.
 *
 * The Soil Moisture Active Passive (SMAP) L4 product provides modeled
 * surface soil moisture at 9 km resolution. Blue tones indicate wet soils;
 * brown/tan indicates dry conditions.
 *
 * Source: NASA Global Imagery Browse Services (GIBS)
 * No authentication required.
 */

function gibsDateString(daysAgo = 60) {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return d.toISOString().slice(0, 10);
}

export function createSoilMoistureLayer() {
  let _imageryLayer = null;
  let _enabled = false;
  let _lastUpdate = null;

  function buildProvider(dateStr) {
    return new Cesium.WebMapTileServiceImageryProvider({
      url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?TIME=' + dateStr,
      layer: 'SMAP_L4_Analyzed_Surface_Soil_Moisture',
      style: 'default',
      tileMatrixSetID: 'GoogleMapsCompatible_Level6',
      format: 'image/png',
      credit: new Cesium.Credit('NASA GIBS — SMAP L4 Soil Moisture'),
    });
  }

  const layer = {
    id: 'eco-soil-moisture',
    name: 'Soil Moisture',
    icon: '🌱',
    source: 'NASA GIBS · SMAP',
    updateInterval: 3600000,

    init(viewer) {
      const provider = buildProvider(gibsDateString(60));
      _imageryLayer = viewer.imageryLayers.addImageryProvider(provider);
      _imageryLayer.show = false;
      _imageryLayer.alpha = 0.7;

      _enabled = false;
      _lastUpdate = null;
      console.log('[Data:SoilMoisture] Initialized');
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
        const dateStr = gibsDateString(60);
        const newProvider = buildProvider(dateStr);

        if (_imageryLayer) {
          viewer.imageryLayers.remove(_imageryLayer, true);
        }
        _imageryLayer = viewer.imageryLayers.addImageryProvider(newProvider);
        _imageryLayer.show = _enabled;
        _imageryLayer.alpha = 0.7;

        _lastUpdate = Date.now();
        console.log(`[Data:SoilMoisture] Updated to date ${dateStr}`);
        return true;
      } catch (e) {
        console.warn('[Data:SoilMoisture] Update error:', e);
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

const soilMoistureLayer = createSoilMoistureLayer();
export default soilMoistureLayer;
