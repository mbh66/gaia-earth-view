<div align="center">

# 🌐 Gaia Earth View

### See your bioregion from space, in your browser.

A 3D globe in your browser showing live ecological and environmental data: watersheds, ecoregions, soil health, vegetation indices, and more. Click anywhere on Earth and find out what's happening there.

Built on public satellite data and open-source code.


<a href="https://youtu.be/-8kA5zpooR0">
  <img src="https://i.ytimg.com/vi/-8kA5zpooR0/maxresdefault.jpg" alt="The Gaia Earth View video demo on YouTube" width="100%">
</a>

**Originally forked from Bilawal Sidhu's God's Eye View** *(formerly WorldView)* — https://github.com/bilawalsidhu/gods-eye-view

</div>

---

## What is this?

Gaia Earth View puts a photorealistic 3D Earth in your browser. You can zoom in on any bioregion and pull in live satellite overlays for soil moisture, water retention, vegetation health, and land use. You can trace watersheds, identify ecoregions, and import your own map data.

It was built so that people working in bioregional regeneration can make their work visible: where the rivers flow, how the land connects, what the ecological boundaries actually look like. The demo video walks through the Valley of Grace in the Western Cape, South Africa, but it works anywhere on the planet.

The tool also carries live layers for flights, ships, earthquakes, weather, and public cameras. Those are useful context, but the core purpose is ecological.

---

## Install it

You need two things on your computer before you start: **Node.js** and a **Google Maps API key**. If you have never done either, the steps below walk you through both.

### 1. Install Node.js

Go to [nodejs.org](https://nodejs.org) and download the latest LTS version (24.x). Run the installer and accept the defaults.

To check it worked, open a terminal (on Mac: Terminal app; on Windows: search for "Command Prompt" or "PowerShell") and type:

```bash
node --version
```

You should see something like `v24.14.0` or higher.

### 2. Download this project

In your terminal, run:

```bash
git clone https://github.com/mbh66/gaia-earth-view.git
cd gaia-earth-view
```

If you don't have `git` installed, you can also click the green **Code** button on the GitHub page and choose **Download ZIP**, then unzip it and open a terminal in that folder.

### 3. Get a Google Maps API key

This is the one key you need. It gives you the photorealistic 3D planet.

1. Go to [console.cloud.google.com](https://console.cloud.google.com/).
2. Sign in with a Google account (or create one).
3. Create a new project. Call it something like "Gaia Earth View".
4. In the search bar at the top, search for **Map Tiles API** and enable it.
5. Go to **APIs & Services > Credentials** and click **Create Credentials > API Key**.
6. Copy the key.

**Cost:** Google currently gives you 1,000 free 3D tile sessions per month, each lasting up to three hours. For personal use, you are unlikely to go over that. Set a budget alert under **Billing > Budgets & alerts** so you are notified if usage climbs.

### 4. Set up your key

In the project folder, copy the example environment file:

```bash
cp .env.example .env
```

On Windows, use `copy .env.example .env` instead.

Open the `.env` file in any text editor (Notepad, VS Code, TextEdit) and paste your Google Maps API key on this line:

```
GOOGLE_MAPS_API_KEY=paste_your_key_here
```

Save and close the file.

### 5. Install and run

```bash
npm install
npm run dev
```

Open your browser and go to **http://localhost:4173**. You should see the Earth.

---

## Try these things first

Once the globe loads, here are three things to try that show what the tool does for bioregional work:

**Find your bioregion's ecoregion.** Click anywhere on the map. The tool looks up the One Earth ecoregion classification (185 distinct ecoregions worldwide) and tells you what ecological zone you are in: fynbos shrubland, Kalahari savannah, temperate rainforest, and so on.

**Trace a watershed.** Click on a dam or river junction. Gaia Earth View calculates which rivers flow into that point and which flow downstream from it. You can see the full river basin your bioregion sits within, and how it connects to neighboring regions.

**Import your own map.** If you have a Google Map with pins marking conservation sites, community projects, or points of interest, export it as a KML file (Google Maps lets you do this). Then use the import KML option in Gaia Earth View to load those points onto the 3D globe. The demo uses this to visualize a potential leopard corridor through nature conservation sites.

---

## Optional: add more layers

The globe runs with just the Google Maps key. These free keys unlock additional layers:

| Key | What it adds | Where to get it |
|-----|-------------|-----------------|
| AISStream | Live ship positions worldwide | [aisstream.io](https://aisstream.io) (free signup) |
| NASA FIRMS | Active fire detections | [firms.modaps.eosdis.nasa.gov](https://firms.modaps.eosdis.nasa.gov/api/map_key/) (free) |
| TomTom | Real traffic flow instead of a simulation | [developer.tomtom.com](https://developer.tomtom.com) (free tier) |
| OpenAI | Voice control and AI scene descriptions (optional) | [platform.openai.com](https://platform.openai.com) (pay-as-you-go) |

Add any of these to your `.env` file the same way you added the Google key. Each one is named in `.env.example` with instructions.

---

## Keyboard shortcuts

`1` through `7` switch visual styles (satellite, night vision, thermal, etc.). `H` toggles the heads-up display. `Esc` resets the view.

---

## Troubleshooting

**"npm install" fails.** Check your Node.js version with `node --version`. You need 24.14.x or 26.x.

**The globe is black or won't load.** Your Google Maps API key is probably missing or the Map Tiles API is not enabled. Double-check both in the Google Cloud Console.

**Voice doesn't work.** Voice requires an OpenAI API key. Without one, everything else still works; the mic button just says voice is unavailable.

---

## Going further

The full technical documentation lives in the `docs/` folder:

- [docs/CURRENT-STATE.md](docs/CURRENT-STATE.md) — what every module does
- [docs/PERFORMANCE.md](docs/PERFORMANCE.md) — performance notes
- [docs/KNOWN-ISSUES.md](docs/KNOWN-ISSUES.md) — known bugs and limitations
- [SECURITY.md](SECURITY.md) — how keys are handled and how to share safely on a network
- [DATA_SOURCES.md](DATA_SOURCES.md) — where every data layer comes from
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to contribute changes

---

## Credits

Gaia Earth View is a fork of [God's Eye View](https://github.com/bilawalsidhu/gods-eye-view) by Bilawal Sidhu, adapted for bioregional ecological use. Released under the [MIT License](LICENSE). Bundled datasets and live feeds carry their own terms; see [DATA_SOURCES.md](DATA_SOURCES.md).

> **Note:** This is an exploration and learning tool, not an operational system. Data may be delayed, incomplete, or modeled. Do not use it for navigation, emergency response, or safety-critical decisions.
