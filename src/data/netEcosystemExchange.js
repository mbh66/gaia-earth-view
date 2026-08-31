import * as Cesium from 'cesium';
import { ecoLayerEnabled, ecoLayerDisabled } from './ecoLayerGlobeGuard.js';

/**
 * SMAP L4 Net Ecosystem CO2 Exchange via NASA GIBS WMTS.
 *
 * The SMAP L4 Carbon product (SPL4CMDL) provides modeled Net Ecosystem
 * Exchange (NEE) at 9 km resolution — the balance between carbon uptake
 * by photosynthesis and carbon release by respiration and decomposition.
 *
 * Negative values (greens/blues) indicate a net carbon SINK — the land
 * is absorbing more CO2 than it releases.
 * Positive values (reds/oranges) indicate a net carbon SOURCE — the land
 * is releasing more CO2 than it absorbs.
 *
 * The sign of this value answers a single question: is this bioregion
 * giving or taking?
 *
 * Source: NASA Global Imagery Browse Services (GIBS)
 * Product: SPL4CMDL (SMAP L4 Carbon Model Data Latency)
 * No authentication required.
 */

function gibsDateString(daysAgo = 60) {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return d.toISOString().slice(0, 10);
}

export function createNeeLayer() {
  let _imageryLayer = null;
  let _enabled = false;
  let _lastUpdate = null;

  function buildProvider(dateStr) {
    return new Cesium.WebMapTileServiceImageryProvider({
      url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?TIME=' + dateStr,
      layer: 'SMAP_L4_Mean_Net_Ecosystem_Exchange',
      style: 'default',
      tileMatrixSetID: 'GoogleMapsCompatible_Level6',
      format: 'image/png',
      credit: new Cesium.Credit('NASA GIBS — SMAP L4 Net Ecosystem CO₂ Exchange'),
    });
  }

  const layer = {
    id: 'eco-nee',
    name: 'Net Ecosystem CO₂ Exchange',
    icon: '🔄',
    source: 'NASA GIBS · SMAP',
    description: 'Net CO₂ exchange between land and atmosphere (gC/m²/day). Negative = carbon sink, positive = carbon source. SMAP L4 model at 9 km resolution.',
    updateInterval: 3600000,

    init(viewer) {
      const provider = buildProvider(gibsDateString(60));
      _imageryLayer = viewer.imageryLayers.addImageryProvider(provider);
      _imageryLayer.show = false;
      _imageryLayer.alpha = 0.7;

      _enabled = false;
      _lastUpdate = null;
      console.log('[Data:NEE] Initialized');
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
        console.log(`[Data:NEE] Updated to date ${dateStr}`);
        return true;
      } catch (e) {
        console.warn('[Data:NEE] Update error:', e);
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

const neeLayer = createNeeLayer();
export default neeLayer;
