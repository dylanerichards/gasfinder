require "json"

# Returns the nearest fuel stations to a point from a local San Francisco
# dataset (db/sf_gas_stations.json), so the app never depends on a flaky live
# API at request time.
#
# DATA SOURCE: the committed dataset is generated from Overture Maps
# (https://docs.overturemaps.org) — current, keyless cloud data — by
# `script/fetch_sf_gas_stations.py` (every place in the SF bbox with
# taxonomy.primary == "gas_station"). Re-run that script to refresh it.
# `.stations` is the single swap point; the rest of this controller
# (haversine sort, limit, JSON shape) is unchanged.
class GasStationsController < ApplicationController
  RESULT_LIMIT = 5
  EARTH_RADIUS_M = 6_371_000.0
  DATA_PATH = Rails.root.join("db/sf_gas_stations.json")

  class << self
    def stations
      @stations ||= load_stations
    end

    # Force a re-read of the dataset from disk. Called after the daily refresh
    # job regenerates db/sf_gas_stations.json so the running process serves the
    # new data without a restart.
    def reload_stations!
      @stations = load_stations
    end

    private

    def load_stations
      JSON.parse(File.read(DATA_PATH), symbolize_names: true).freeze
    rescue Errno::ENOENT, JSON::ParserError => e
      Rails.logger.warn("gas station dataset unavailable: #{e.class}: #{e.message}")
      [].freeze
    end
  end

  def index
    lat = parse_coord(params[:lat], -90.0, 90.0)
    lng = parse_coord(params[:lng], -180.0, 180.0)
    return render(json: []) unless lat && lng

    render json: nearest_stations(lat, lng)
  rescue => e
    Rails.logger.warn("gas_stations failed: #{e.class}: #{e.message}")
    render json: [], status: :ok
  end

  private

  def parse_coord(raw, min, max)
    str = raw.to_s.strip
    return nil unless str.match?(/\A[-+]?\d+(\.\d+)?\z/)

    value = Float(str)
    return nil if value < min || value > max

    value
  rescue ArgumentError, TypeError
    nil
  end

  def nearest_stations(lat, lng)
    self.class.stations
      .map { |s| s.merge(distance_m: haversine_m(lat, lng, s[:lat], s[:lng]).round) }
      .sort_by { |s| s[:distance_m] }
      .first(RESULT_LIMIT)
      .map { |s| present(s) }
  end

  def present(station)
    {
      id: station[:id],
      name: station[:name],
      lat: station[:lat],
      lng: station[:lng],
      distance_m: station[:distance_m],
      brand: station[:brand],
      address: station[:address]
    }
  end

  # Great-circle distance in metres.
  def haversine_m(lat1, lng1, lat2, lng2)
    d_lat = deg2rad(lat2 - lat1)
    d_lng = deg2rad(lng2 - lng1)
    a = (Math.sin(d_lat / 2)**2) +
        (Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * (Math.sin(d_lng / 2)**2))
    EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  end

  def deg2rad(degrees)
    degrees * Math::PI / 180.0
  end
end
