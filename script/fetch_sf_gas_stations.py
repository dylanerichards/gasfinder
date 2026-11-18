#!/usr/bin/env python3
"""Regenerate db/sf_gas_stations.json from Overture Maps.

Overture Maps (https://docs.overturemaps.org) is the project's intended data
source: current, keyless, cloud-hosted GeoParquet. This pulls every place in the
San Francisco bounding box, keeps the gas stations (taxonomy.primary ==
"gas_station"), and writes them in the shape GasStationsController expects:
{ id, name, brand, address, lat, lng }.

One-time setup (overturemaps can't be --user-installed under Homebrew Python):
    python3 -m venv .venv && .venv/bin/pip install overturemaps

Run:
    .venv/bin/python script/fetch_sf_gas_stations.py
"""
import json
import os
import subprocess
import sys
import tempfile

# west, south, east, north — same SF box the geocode/station search use.
SF_BBOX = "-122.5247,37.7034,-122.3366,37.8324"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "db", "sf_gas_stations.json")


def download_places(path):
    subprocess.run(
        [sys.executable, "-m", "overturemaps", "download",
         f"--bbox={SF_BBOX}", "-f", "geojsonseq", "-t", "place", "-o", path],
        check=True,
    )


def brand_name(props):
    brand = props.get("brand")
    if isinstance(brand, dict):
        return (brand.get("names") or {}).get("primary")
    return None


def is_gas_station(props):
    taxonomy = props.get("taxonomy") or {}
    return taxonomy.get("primary") == "gas_station" or props.get("basic_category") == "gas_station"


def transform(path):
    stations = []
    with open(path) as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            feature = json.loads(line)
            props = feature["properties"]
            if not is_gas_station(props):
                continue
            lng, lat = feature["geometry"]["coordinates"][:2]
            brand = brand_name(props)
            address = ((props.get("addresses") or [{}])[0] or {}).get("freeform")
            name = (props.get("names") or {}).get("primary") or brand or "Gas station"
            stations.append({
                "id": f"ov-{props.get('id') or feature.get('id')}",
                "name": name,
                "brand": brand,
                "address": address,
                "lat": round(float(lat), 6),
                "lng": round(float(lng), 6),
            })
    stations.sort(key=lambda s: s["name"].lower())
    return stations


def main():
    handle = tempfile.NamedTemporaryFile(suffix=".geojsonseq", delete=False)
    tmp_path = handle.name
    handle.close()
    try:
        download_places(tmp_path)
        stations = transform(tmp_path)
    finally:
        os.remove(tmp_path)

    with open(OUT, "w") as out:
        json.dump(stations, out, indent=2, ensure_ascii=False)
        out.write("\n")
    print(f"Wrote {len(stations)} gas stations to {OUT}")


if __name__ == "__main__":
    main()
