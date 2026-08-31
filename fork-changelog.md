# God's Eye View — Fork Changelog

All modifications from the upstream [bilawalsidhu/gods-eye-view](https://github.com/bilawalsidhu/gods-eye-view) (now Gaia Earth View). This document covers the ecological data layers added as Stage 1 of a bioregional spatial intelligence system, plus the debugging and configuration corrections applied to make them render.

---

## The Problem These Changes Solve

GEV uses Google Photorealistic 3D Tiles as its default surface. The Cesium globe is hidden (`viewer.scene.globe.show = false`) because the 3D tileset provides its own opaque terrain. Cesium `ImageryLayer` objects render on the globe surface, so they are invisible in photoreal mode: the globe is hidden, and the 3D tiles occlude it even if shown.

The solution is a "globe guard" module that, when any ecological raster layer is toggled on, hides the 3D tileset, shows the Cesium globe, and adds an OpenStreetMap base layer for geographic context. When all ecological layers are toggled off, photoreal mode is restored.

---

## New Files

### `src/data/ecoLayerGlobeGuard.js`

Rendering mode switch between Google 3D Tiles and the Cesium globe. Shared by all raster ecological layers.

- `ecoLayerEnabled(viewer)` — called by each eco layer's `enable()`. On first activation: hides 3D tileset, shows globe, adds OSM base layer at imagery index 0.
- `ecoLayerDisabled(viewer)` — called by each eco layer's `disable()`. When the reference count reaches zero: removes OSM base, restores globe and tileset to their previous state.
- Acquires the Google 3D tileset reference from `window.__godsEyeView.tileset` (set in `main.js`). Retries on each `ecoLayerEnabled` call if the global was not yet populated during early init.

### `src/data/ndviVegetation.js`

MODIS Terra Normalized Difference Vegetation Index, 8-day composite. Green tones indicate healthy vegetation; brown/tan indicates bare soil or senescence.

| Field | Value |
|---|---|
| Layer ID | `eco-ndvi` |
| GIBS Layer | `MODIS_Terra_NDVI_8Day` |
| TileMatrixSet | `GoogleMapsCompatible_Level9` |
| Format | `image/png` |
| Date offset | 10 days (composite processing latency) |
| Alpha | 0.7 |
| Update interval | 1 hour |

### `src/data/soilMoisture.js`

SMAP L4 Analyzed Surface Soil Moisture at 9 km resolution. Blue tones indicate wet soils; brown/tan indicates dry conditions.

| Field | Value |
|---|---|
| Layer ID | `eco-soil-moisture` |
| GIBS Layer | `SMAP_L4_Analyzed_Surface_Soil_Moisture` |
| TileMatrixSet | `GoogleMapsCompatible_Level6` |
| Format | `image/png` |
| Date offset | 60 days (SMAP L4 processing latency) |
| Alpha | 0.7 |
| Update interval | 1 hour |

**Critical note:** SMAP L4 products require `GoogleMapsCompatible_Level6`, not Level9. The 9 km native resolution maps to zoom level 6. GIBS returns `TILEMATRIXSET is invalid for LAYER` if you use Level9. SMAP L4 data also has approximately 60 days of processing latency — a date offset shorter than that produces 404 responses.

### `src/data/deforestationAlerts.js`

OPERA DIST-ALERT-HLS vegetation disturbance detection at 30 m resolution. Covers deforestation, fire damage, and land clearing from Harmonized Landsat Sentinel-2 data.

| Field | Value |
|---|---|
| Layer ID | `eco-deforestation` |
| GIBS Layer | `OPERA_L3_DIST-ALERT-HLS_Color_Index` |
| TileMatrixSet | `GoogleMapsCompatible_Level12` |
| Format | `image/png` |
| Date offset | 5 days |
| Alpha | 0.8 |
| Update interval | 1 hour |

Global Forest Watch tiles (`tiles.globalforestwatch.org`) were evaluated first but return 403 — they require authentication. OPERA DIST-ALERT-HLS on GIBS is the free, auth-free alternative.

### `src/data/surfaceWater.js`

JRC Global Surface Water occurrence layer (v1.4, 2021 update). Static dataset covering 1984–present from the full Landsat archive. Pixel intensity encodes the percentage of time water was present.

| Field | Value |
|---|---|
| Layer ID | `eco-surface-water` |
| Provider | `Cesium.UrlTemplateImageryProvider` (not GIBS) |
| Tile URL | `https://storage.googleapis.com/global-surface-water/tiles2021/occurrence/{z}/{x}/{y}.png` |
| Zoom range | 0–13 |
| Alpha | 0.7 |
| Update interval | 0 (static dataset) |

This layer uses Google Cloud Storage XYZ tiles, not the NASA GIBS WMTS endpoint. Different provider pattern from the other raster layers.

### `src/data/grossPrimaryProductivity.js`

SMAP L4 Gross Primary Productivity — the total amount of carbon fixed by vegetation through photosynthesis.

| Field | Value |
|---|---|
| Layer ID | `eco-gpp` |
| GIBS Layer | `SMAP_L4_Mean_Gross_Primary_Productivity` |
| TileMatrixSet | `GoogleMapsCompatible_Level6` |
| Format | `image/png` |
| Date offset | 60 days (SMAP L4 Carbon processing latency) |
| Alpha | 0.7 |
| Update interval | 1 hour |

Same SMAP L4 constraints as Soil Moisture: Level6 tile matrix, 60-day data latency.

### `src/data/netEcosystemExchange.js`

SMAP L4 Net Ecosystem CO2 Exchange — the balance between carbon absorbed by photosynthesis and carbon released by respiration. Negative values indicate a net carbon sink; positive values indicate a net carbon source.

| Field | Value |
|---|---|
| Layer ID | `eco-nee` |
| GIBS Layer | `SMAP_L4_Mean_Net_Ecosystem_Exchange` |
| TileMatrixSet | `GoogleMapsCompatible_Level6` |
| Format | `image/png` |
| Date offset | 60 days (SMAP L4 Carbon processing latency) |
| Alpha | 0.7 |
| Update interval | 1 hour |

### `src/data/watershedDelineation.js`

Click-driven watershed boundary and upstream river network overlay using the mghydro.com Global Watersheds API (MERIT-Basins data, University of Tokyo, 90 m resolution).

| Field | Value |
|---|---|
| Layer ID | `eco-watershed` |
| Type | Vector overlay (GeoJSON), not raster imagery |
| API | `https://mghydro.com/app/watershed_api` and related endpoints |
| Globe guard | Not used — entities render on top of both 3D tiles and globe |

This layer is structurally different from the raster layers. When enabled, it registers a click handler on the globe. Clicking a point queries the mghydro.com API for the watershed boundary, upstream river network, and downstream flowpath, then renders them as styled GeoJSON polygons and polylines via `Cesium.GeoJsonDataSource`. Rivers are color-coded by Strahler stream order.

---

## Modified Files

### `src/data/localLayers.js`

Added imports for all seven ecological layer modules and appended them to the default export array:

```javascript
import surfaceWaterLayer from './surfaceWater.js';
import ndviLayer from './ndviVegetation.js';
import soilMoistureLayer from './soilMoisture.js';
import deforestationLayer from './deforestationAlerts.js';
import watershedDelineationLayer from './watershedDelineation.js';
import gppLayer from './grossPrimaryProductivity.js';
import neeLayer from './netEcosystemExchange.js';
import ecoregionBoundariesLayer from './ecoregionBoundaries.js';
import googleMyMapsLayer from './googleMyMaps.js';

export default [
  datacenters,
  dams,
  submarineCablesLayer,
  fires,
  surfaceWaterLayer,
  ndviLayer,
  soilMoistureLayer,
  deforestationLayer,
  watershedDelineationLayer,
  gppLayer,
  neeLayer,
  ecoregionBoundariesLayer,
  googleMyMapsLayer,
];
```

### `src/data/layerState.js`

Added seven token entries for URL hash state persistence, inserted alphabetically by ID among the existing entries:

```javascript
Object.freeze({ id: 'eco-deforestation', token: 'k', disposition: 'enabled-only' }),
Object.freeze({ id: 'eco-ndvi', token: 'n', disposition: 'enabled-only' }),
Object.freeze({ id: 'eco-soil-moisture', token: 'j', disposition: 'enabled-only' }),
Object.freeze({ id: 'eco-surface-water', token: 'h', disposition: 'enabled-only' }),
Object.freeze({ id: 'eco-watershed', token: 'y', disposition: 'enabled-only' }),
Object.freeze({ id: 'eco-gpp', token: 'p', disposition: 'enabled-only' }),
Object.freeze({ id: 'eco-nee', token: 'z', disposition: 'enabled-only' }),
Object.freeze({ id: 'eco-ecoregion', token: 'l', disposition: 'enabled-only' }),
Object.freeze({ id: 'google-mymaps', token: 'o', disposition: 'enabled-only' }),
```

Token allocation after these additions: `a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z` are used. All single-letter tokens allocated.

All data sources are public, auth-free endpoints. The KML overlay layer uses a Vite dev-server proxy (`/api/google/kml`) to follow NetworkLinks in Google My Maps exports.

---

## Default Camera View

Changed the default camera from flying to Austin, TX to a full globe view centered at (20°E, 10°N) at 20,000 km altitude with a nadir pitch. The `flyToAustin(viewer)` call in `src/main.js` was replaced with:

```javascript
viewer.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(20, 10, 20000000),
  orientation: {
    heading: 0,
    pitch: Cesium.Math.toRadians(-90),
    roll: 0,
  },
});
```

---

## New Dependencies

| Package | Version | Purpose |
|---|---|---|
| `@tmcw/togeojson` | 7.1.2 | Converts KML XML documents to GeoJSON FeatureCollections |
| `jszip` | latest | Unpacks KMZ files (which are zip archives containing KML) |

---

## Layer Module Contract

Each ecological layer follows the GEV data layer interface:

```javascript
{
  id: string,          // unique identifier, prefixed 'eco-'
  name: string,        // display name in the UI panel
  icon: string,        // emoji icon
  source: string,      // attribution string
  updateInterval: ms,  // periodic refresh interval (0 = static)

  init(viewer),        // create imagery provider, add layer with show=false
  enable(viewer),      // set show=true, call ecoLayerEnabled(viewer)
  disable(viewer),     // set show=false, call ecoLayerDisabled(viewer)
  update(viewer),      // rebuild provider with fresh date, swap imagery layer
  destroy(viewer),     // clean up, call ecoLayerDisabled if still enabled
  getStats(),          // return { count, lastUpdate, error }
}
```

The manager calls `init()` lazily on first enable, not at registration time. The full lifecycle on user toggle is: `init()` → `enable()` → `update()`.

---

## GIBS WMTS Integration Notes

Three things a forker needs to know about NASA GIBS tile configuration:

**1. Tile matrix sets are product-specific.** MODIS products use `GoogleMapsCompatible_Level9`. OPERA products use `GoogleMapsCompatible_Level12`. SMAP L4 products (Soil Moisture, GPP, NEE) use `GoogleMapsCompatible_Level6`. Using the wrong matrix set returns a `TILEMATRIXSET is invalid for LAYER` error. The matrix set corresponds to the native spatial resolution: 9 km SMAP data maps to zoom level 6, 250 m MODIS to level 9, 30 m OPERA HLS to level 12.

**2. Date offsets vary by product.** SMAP L4 products have approximately 60 days of processing latency. MODIS 8-day composites need about 10 days. OPERA DIST-ALERT needs about 5 days. Requesting a date more recent than the latest available data returns 404 tiles.

**3. The GIBS capabilities endpoint is the source of truth.** The `worldview-options-eosdis` GitHub repo contains layer metadata but does not list WMTS parameters (format, matrixSet). Those come from the GIBS GetCapabilities document at `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml`.

**4. URL construction.** The TIME parameter is appended to the base WMTS URL as a KVP parameter: `wmts.cgi?TIME=YYYY-MM-DD`. Cesium's `WebMapTileServiceImageryProvider` appends its own path segments for layer, style, tilematrix, tilerow, tilecol.

---

## File Summary

| File | Status | Purpose |
|---|---|---|
| `src/data/ecoLayerGlobeGuard.js` | New | Globe/3D tile rendering mode switch |
| `src/data/ndviVegetation.js` | New | MODIS NDVI vegetation index |
| `src/data/soilMoisture.js` | New | SMAP L4 soil moisture |
| `src/data/deforestationAlerts.js` | New | OPERA vegetation disturbance alerts |
| `src/data/surfaceWater.js` | New | JRC global surface water occurrence |
| `src/data/grossPrimaryProductivity.js` | New | SMAP L4 gross primary productivity |
| `src/data/netEcosystemExchange.js` | New | SMAP L4 net ecosystem CO2 exchange |
| `src/data/watershedDelineation.js` | New | Click-driven watershed delineation (vector) |
| `src/data/ecoregionBoundaries.js` | New | Click-driven ecoregion identification (vector) |
| `src/data/googleMyMaps.js` | New | KML/KMZ file overlay (user-supplied file, togeojson + GeoJsonDataSource) |
| `src/data/localLayers.js` | Modified | Added imports and registrations for all 10 layers |
| `src/data/layerState.js` | Modified | Added 9 URL hash token entries |
| `vite.config.js` | Modified | Added `googleMapsKmlProxy()` for KML NetworkLink proxy |

### `src/data/ecoregionBoundaries.js`

Click-driven terrestrial ecoregion identification using the RESOLVE Ecoregions 2017 dataset (Dinerstein et al., BioScience 2017). Queries the Esri Living Atlas FeatureServer with the clicked coordinate and renders the ecoregion polygon with biome-specific fill colors.

| Field | Value |
|---|---|
| Layer ID | `eco-ecoregion` |
| Type | Vector overlay (GeoJSON), not raster imagery |
| API | `https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/Resolve_Ecoregions/FeatureServer/0/query` |
| Globe guard | Not used — entities render on top of both 3D tiles and globe |
| Auth | None (public endpoint) |

Returns ecoregion name, biome name and number, biogeographic realm, and Nature Needs Half conservation status. Polygon fill is color-coded by biome (14 biomes, semi-transparent). Follows the same click-driven pattern as `watershedDelineation.js`.

### `src/data/googleMyMaps.js`

Generic KML/KMZ file overlay. Users toggle the layer on, pick (or drag-and-drop) a `.kml` or `.kmz` file, and see its placemarks, lines, and polygons rendered on the globe. Works with exports from Google My Maps, Google Earth, QGIS, ArcGIS, and any other KML source.

| Field | Value |
|---|---|
| Layer ID | `google-mymaps` |
| Type | Vector overlay (KML converted to GeoJSON via `@tmcw/togeojson`, rendered with `Cesium.GeoJsonDataSource`) |
| Proxy | `/api/google/kml` (Vite dev-server, for following KML NetworkLinks) |
| Globe guard | Not used — entities render on top of both 3D tiles and globe |
| Auth | None |

The layer converts KML to GeoJSON using `@tmcw/togeojson`, then renders through `Cesium.GeoJsonDataSource` with `clampToGround: true` — the same proven pipeline used by the watershed and ecoregion layers. KMZ files are unpacked via `jszip`. Google My Maps KML exports contain a `<NetworkLink>` wrapper rather than inline placemarks; the layer detects these and fetches the actual KML through the `/api/google/kml` Vite proxy to avoid CORS restrictions. Point entities get `disableDepthTestDistance: Number.POSITIVE_INFINITY` so they render above Google 3D Tiles.

The layer injects a file picker and drag-and-drop zone into its toggle row (the `getRowControls` API only supports chips and legend swatches, so the controls are injected directly via DOM query on `[data-layer-id="google-mymaps"]`).

### `vite.config.js` — Google Maps KML Proxy

Added `googleMapsKmlProxy()` function and registered it in the plugins array. General-purpose KML fetch proxy at `/api/google/kml` that accepts a `url` query parameter and returns the KML content with CORS headers. Used by the KML overlay layer to follow `<NetworkLink>` elements in Google My Maps exports, which point to remote URLs that don't serve CORS headers.


