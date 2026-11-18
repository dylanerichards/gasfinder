require "net/http"
require "json"

# Finds the nearest fuel stations to a point via OpenStreetMap's Overpass API.
# Kept server-side (like GeocodeController) so we send a proper User-Agent and
# never expose any user identity — only the coordinates are forwarded.
#
# DATA SOURCE: Overpass (amenity=fuel) is reliable, keyless and consistent with
# the existing Nominatim proxy. The project's long-term intent is Overture Maps
# POIs via DuckDB; `fetch_candidates` is the single swap point — replace its body
# with an Overture/DuckDB query that returns the same candidate shape and the
# rest of this controller (haversine sort, limit, JSON shape) is unchanged.
class GasStationsController < ApplicationController
  USER_AGENT = "GasFinder/1.0 (San Francisco gas station finder)".freeze
  OVERPASS_URL = "https://overpass-api.de/api/interpreter".freeze
  # Try a tight radius first; widen once if the city block is sparse.
  SEARCH_RADII_M = [ 2500, 6000 ].freeze
  RESULT_LIMIT = 5
  EARTH_RADIUS_M = 6_371_000.0

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
    candidates = []
    SEARCH_RADII_M.each do |radius|
      candidates = fetch_candidates(lat, lng, radius)
      break if candidates.length >= RESULT_LIMIT
    end

    candidates
      .map { |c| c.merge(distance_m: haversine_m(lat, lng, c[:lat], c[:lng])) }
      .sort_by { |c| c[:distance_m] }
      .first(RESULT_LIMIT)
      .map { |c| present(c) }
  end

  # The one data-source seam. Swap this body for an Overture Maps / DuckDB query
  # to change providers; callers only rely on the candidate hash shape
  # ({ id:, name:, lat:, lng:, brand:, address: }) it returns.
  def fetch_candidates(lat, lng, radius_m)
    uri = URI(OVERPASS_URL)
    req = Net::HTTP::Post.new(uri)
    req["User-Agent"] = USER_AGENT
    req.content_type = "application/x-www-form-urlencoded"
    req.body = URI.encode_www_form(data: overpass_query(lat, lng, radius_m))

    res = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true, open_timeout: 4, read_timeout: 12) do |http|
      http.request(req)
    end
    return [] unless res.is_a?(Net::HTTPSuccess)

    parse_elements(JSON.parse(res.body))
  end

  # lat/lng/radius_m are validated numerics, so interpolation here is injection-safe.
  def overpass_query(lat, lng, radius_m)
    <<~OVERPASSQL
      [out:json][timeout:25];
      (
        node["amenity"="fuel"](around:#{radius_m},#{lat},#{lng});
        way["amenity"="fuel"](around:#{radius_m},#{lat},#{lng});
      );
      out center tags;
    OVERPASSQL
  end

  def parse_elements(payload)
    elements = payload["elements"]
    return [] unless elements.is_a?(Array)

    elements.filter_map { |el| build_candidate(el) }
  end

  def build_candidate(element)
    center = element["center"] || {}
    lat = (element["lat"] || center["lat"])&.to_f
    lng = (element["lon"] || center["lon"])&.to_f
    return nil unless lat && lng

    tags = element["tags"] || {}
    {
      id: "osm-#{element['type']}-#{element['id']}",
      name: station_name(tags),
      lat: lat,
      lng: lng,
      brand: tags["brand"].presence,
      address: street_address(tags)
    }
  end

  def station_name(tags)
    tags["name"].presence || tags["brand"].presence || tags["operator"].presence || "Gas station"
  end

  def street_address(tags)
    street = tags["addr:street"].presence
    return nil unless street

    [ tags["addr:housenumber"].presence, street ].compact.join(" ")
  end

  def present(candidate)
    {
      id: candidate[:id],
      name: candidate[:name],
      lat: candidate[:lat],
      lng: candidate[:lng],
      distance_m: candidate[:distance_m].round,
      brand: candidate[:brand],
      address: candidate[:address]
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
