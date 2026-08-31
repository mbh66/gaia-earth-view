import * as Cesium from 'cesium';
import { ecoLayerEnabled, ecoLayerDisabled } from './ecoLayerGlobeGuard.js';

/**
 * SMAP L4 Gross Primary Productivity via NASA GIBS WMTS.
 *
 * The SMAP L4 Carbon product (SPL4CMDL) provides modeled Gross Primary
 * Production (GPP) at 9 km resolution — the total amount of carbon fixed
 * by vegetation through photosynthesis per unit area per day.
 *
 * Higher values (greens) indicate more active carbon fixation.
 * Lower values (browns/tans) indicate dormant or absent vegetation.
 *
 * This is the closest satellite-derived proxy for "is the bioregion
 * metabolizing" — a direct measure of ecosystem productivity independent
 * of observer effort.
 *
 * Source: NASA Global Imagery Browse Services (GIBS)
 * Product: SPL4CMDL (SMAP L4 Carbon Model Data Latency)
 * No authentication required.
 */

function gibsDateString(daysAgo = 60) {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return d.toISOString().slice(0, 10);
}

export function createGppLayer() {
  let _imageryLayer = null;
  let _enabled = false;
  let _lastUpdate = null;

  function buildProvider(dateStr) {
    return new Cesium.WebMapTileServiceImageryProvider({
      url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?TIME=' + dateStr,
      layer: 'SMAP_L4_Mean_Gross_Primary_Productivity',
      style: 'default',
      tileMatrixSetID: 'GoogleMapsCompatible_Level6',
      format: 'image/png',
      credit: new Cesium.Credit('NASA GIBS — SMAP L4 Gross Primary Productivity'),
    });
  }

  const layer = {
    id: 'eco-gpp',
    name: 'Gross Primary Productivity',
    icon: '🌳',
    source: 'NASA GIBS · SMAP',
    description: 'Carbon fixed by vegetation through photosynthesis (gC/m²/day). SMAP L4 model at 9 km resolution.',
    updateInterval: 3600000,

    init(viewer) {
      const provider = buildProvider(gibsDateString(60));
      _imageryLayer = viewer.imageryLayers.addImageryProvider(provider);
      _imageryLayer.show = false;
      _imageryLayer.alpha = 0.7;

      _enabled = false;
      _lastUpdate = null;
      console.log('[Data:GPP] Initialized');
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
        console.log(`[Data:GPP] Updated to date ${dateStr}`);
        return true;
      } catch (e) {
        console.warn('[Data:GPP] Update error:', e);
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

const gppLayer = createGppLayer();
export default gppLayer;
