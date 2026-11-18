# Gas Finder · San Francisco

Find the nearest gas station in San Francisco and get walking or driving
turn-by-turn directions to it.

**Live:** https://serene-bayou-74363-4b94bb71b5f2.herokuapp.com/

## What it does

- **Set your location** — browser geolocation, a curated SF landmark, or a live
  address search.
- **See the 5 nearest gas stations** — listed with distances and plotted on a map.
- **Pick a destination** — manually, or auto-pick the station with the **shortest
  walk** or **shortest drive**.
- **Get directions** — turn-by-turn walking or driving, with the route drawn on
  the map.

## Stack

Rails 8 · Vite · React 19 · Tailwind v4 · Leaflet · SQLite (ephemeral). Deployed
on Heroku; CI on GitHub Actions; tested with RSpec (request + Capybara/Cuprite
system specs). No API keys and no paid services — geocoding (Nominatim), gas-station
data (a committed OpenStreetMap snapshot), and routing (OSRM) are all keyless and
proxied through Rails.


## Known tradeoffs

- **Directions are a static preview, not live GPS navigation** — there's no
  turn-by-turn "navigation mode" that follows you and re-routes (a much larger
  feature: continuous geolocation, step tracking, re-routing).
- **Gas-station data is a local OSM snapshot** (`db/sf_gas_stations.json`) rather
  than a live query — the public Overpass API kept failing (502 "at capacity"), so
  we pulled the data locally for instant, reliable results (at the cost of
  freshness).

The layout is responsive and verified on mobile.


## Running locally

Requires Ruby (see `.ruby-version`) and Node (see `.node-version`).

```bash
bundle install
npm install
bin/dev            # runs Puma + Vite together (Procfile.dev)
```

Then open the app (Puma prints the port). `bin/dev` runs the Rails server and the
Vite dev server side by side.

## Tests & checks

```bash
bundle exec rspec       # request + system specs (system specs need Chrome)
bundle exec rubocop     # lint (rubocop-rails-omakase)
bin/brakeman            # security scan
```

A pre-push hook (`.githooks/pre-push`) runs all three before every push —
enable it with `git config core.hooksPath .githooks`.

## Deploying

Heroku, database-free (nothing is persisted). Buildpacks are `heroku/nodejs` then
`heroku/ruby`; set `RAILS_MASTER_KEY` from `config/master.key`, then:

```bash
git push heroku main
```
