/**
 * Globe visibility guard for ecological imagery layers.
 *
 * GEV hides the Cesium globe in photoreal mode — Google Photorealistic 3D Tiles
 * provide their own opaque surface that completely occludes any ImageryLayer
 * painted on the globe beneath. When ecological raster layers are toggled on,
 * this guard:
 *   1. Hides the Google 3D Tileset so the globe surface is visible.
 *   2. Shows the Cesium globe.
 *   3. Adds a simple base-map imagery layer (OpenStreetMap) so the eco data
 *      has geographic context instead of a blank ellipsoid.
 *
 * When the last eco layer is disabled, the guard restores photoreal mode.
 */

import * as Cesium from 'cesium';

let _viewer = null;
let _tileset = null;
let _activeCount = 0;
let _previousGlobeShow = false;
let _previousTilesetShow = true;
let _baseLayer = null;

export function initGlobeGuard(viewer) {
  _viewer = viewer;
  _activeCount = 0;
  _previousGlobeShow = viewer.scene.globe.show;

  // Find the tileset from the GEV global
  const gev = window.__godsEyeView;
  if (gev && gev.tileset) {
    _tileset = gev.tileset;
    _previousTilesetShow = _tileset.show;
  }
}

export function ecoLayerEnabled(viewer) {
  if (!_viewer) initGlobeGuard(viewer);

  // Re-acquire tileset reference if we missed it during early init
  if (!_tileset) {
    const gev = window.__godsEyeView;
    if (gev && gev.tileset) {
      _tileset = gev.tileset;
      _previousTilesetShow = _tileset.show;
    }
  }

  if (_activeCount === 0) {
    // Snapshot current state before switching
    _previousGlobeShow = _viewer.scene.globe.show;
    if (_tileset) _previousTilesetShow = _tileset.show;

    // Hide 3D tiles — they occlude the globe surface
    if (_tileset) _tileset.show = false;

    // Show the globe so imagery layers are visible
    _viewer.scene.globe.show = true;

    // Add an OSM base layer at index 0 for geographic context
    if (!_baseLayer) {
      const osmProvider = new Cesium.OpenStreetMapImageryProvider({
        url: 'https://tile.openstreetmap.org/',
      });
      _baseLayer = new Cesium.ImageryLayer(osmProvider);
      _viewer.imageryLayers.add(_baseLayer, 0);
    }

    console.log('[EcoGuard] Activated — globe on, 3D tiles off, OSM base added');
  }
  _activeCount++;
}

export function ecoLayerDisabled(viewer) {
  if (!_viewer) return;
  _activeCount = Math.max(0, _activeCount - 1);
  if (_activeCount === 0) {
    // Remove the OSM base layer
    if (_baseLayer) {
      _viewer.imageryLayers.remove(_baseLayer, true);
      _baseLayer = null;
    }

    // Restore previous state
    _viewer.scene.globe.show = _previousGlobeShow;
    if (_tileset) _tileset.show = _previousTilesetShow;

    console.log('[EcoGuard] Deactivated — restored photoreal mode');
  }
}
