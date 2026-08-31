import * as Cesium from 'cesium';
import { ecoLayerEnabled, ecoLayerDisabled } from './ecoLayerGlobeGuard.js';

/**
 * JRC Global Surface Water — occurrence layer (v1.4, 2021 update).
 *
 * Public tiles from the European Commission Joint Research Centre.
 * Shows where surface water has been detected over the full Landsat archive
 * (1984–present). Pixel intensity encodes the percentage of time water was
 * present: brighter = more persistent water bodies.
 *
 * No authentication required.
 */

const TILE_URL = 'https://storage.googleapis.com/global-surface-water/tiles2021/occurrence/{z}/{x}/{y}.png';

export function createSurfaceWaterLayer() {
  let _imageryLayer = null;
  let _enabled = false;
  let _lastUpdate = null;

  const layer = {
    id: 'eco-surface-water',
    name: 'Surface Water',
    icon: '💧',
    source: 'JRC Global Surface Water',
    updateInterval: 0,

    init(viewer) {
      const provider = new Cesium.UrlTemplateImageryProvider({
        url: TILE_URL,
        minimumLevel: 0,
        maximumLevel: 13,
        credit: new Cesium.Credit('EC JRC / Google — Global Surface Water'),
      });

      _imageryLayer = viewer.imageryLayers.addImageryProvider(provider);
      _imageryLayer.show = false;
      _imageryLayer.alpha = 0.7;

      _enabled = false;
      _lastUpdate = null;
      console.log('[Data:SurfaceWater] Initialized');
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
      _lastUpdate = Date.now();
      return true;
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

const surfaceWaterLayer = createSurfaceWaterLayer();
export default surfaceWaterLayer;
