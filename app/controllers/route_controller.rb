require "net/http"
require "json"

# Proxies turn-by-turn routing to the public OSRM instances hosted at
# routing.openstreetmap.de. Kept server-side so we send a generic User-Agent,
# never expose any user identity, validate the input and rescue upstream errors
# — the browser only ever talks to this app.
class RouteController < ApplicationController
  USER_AGENT = "GasFinder/1.0".freeze

  # OSRM profile hosts + path segments, keyed by travel mode.
  PROFILES = {
    "drive" => { host: "routed-car", path: "driving" },
    "walk" => { host: "routed-foot", path: "walking" }
  }.freeze

  # 8-point compass labels for the opening "Head …" instruction.
  COMPASS = %w[north northeast east southeast south southwest west northwest].freeze

  def index
    mode = parse_mode(params[:mode])
    from_lat = parse_coord(params[:from_lat], -90.0, 90.0)
    from_lng = parse_coord(params[:from_lng], -180.0, 180.0)
    to_lat = parse_coord(params[:to_lat], -90.0, 90.0)
    to_lng = parse_coord(params[:to_lng], -180.0, 180.0)

    unless from_lat && from_lng && to_lat && to_lng
      return render(json: { error: "Invalid coordinates." }, status: :ok)
    end

    route = cached_route(mode, from_lat, from_lng, to_lat, to_lng)
    return render(json: { error: "Couldn't load directions." }, status: :ok) unless route

    expires_in 1.hour, public: true
    render json: route
  rescue => e
    Rails.logger.warn("route failed: #{e.class}: #{e.message}")
    render json: { error: "Couldn't load directions." }, status: :ok
  end

  private

  # Routes are deterministic, so cache by mode + rounded coordinates. skip_nil
  # keeps upstream failures out of the cache so they can be retried. No-op in
  # test (:null_store); per-dyno :memory_store in production.
  def cached_route(mode, from_lat, from_lng, to_lat, to_lng)
    key = format("route/v1/%s/%.5f,%.5f;%.5f,%.5f", mode, from_lat, from_lng, to_lat, to_lng)
    Rails.cache.fetch(key, expires_in: 6.hours, skip_nil: true) do
      fetch_route(mode, from_lat, from_lng, to_lat, to_lng)
    end
  end

  def parse_mode(raw)
    mode = raw.to_s.strip.downcase
    PROFILES.key?(mode) ? mode : "drive"
  end

  def parse_coord(raw, min, max)
    str = raw.to_s.strip
    return nil unless str.match?(/\A[-+]?\d+(\.\d+)?\z/)

    value = Float(str)
    return nil if value < min || value > max

    value
  rescue ArgumentError, TypeError
    nil
  end

  def fetch_route(mode, from_lat, from_lng, to_lat, to_lng)
    profile = PROFILES.fetch(mode)
    coords = "#{from_lng},#{from_lat};#{to_lng},#{to_lat}"
    uri = URI("https://routing.openstreetmap.de/#{profile[:host]}/route/v1/#{profile[:path]}/#{coords}")
    uri.query = URI.encode_www_form(overview: "full", geometries: "geojson", steps: "true")

    req = Net::HTTP::Get.new(uri)
    req["User-Agent"] = USER_AGENT

    res = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true, open_timeout: 4, read_timeout: 6) do |http|
      http.request(req)
    end
    return nil unless res.is_a?(Net::HTTPSuccess)

    present(mode, JSON.parse(res.body))
  rescue Net::OpenTimeout, Net::ReadTimeout, SocketError, JSON::ParserError => e
    Rails.logger.warn("route upstream failed: #{e.class}: #{e.message}")
    nil
  end

  def present(mode, body)
    return nil unless body["code"] == "Ok"

    route = body["routes"]&.first
    return nil unless route

    {
      mode: mode,
      distance_m: route["distance"].to_f.round,
      duration_s: route["duration"].to_f.round,
      geometry: geometry(route),
      steps: steps(route)
    }
  end

  # GeoJSON is [lng, lat]; Leaflet wants [lat, lng].
  def geometry(route)
    coords = route.dig("geometry", "coordinates") || []
    coords.map { |lng, lat| [ lat, lng ] }
  end

  def steps(route)
    legs = route["legs"] || []
    legs.flat_map { |leg| leg["steps"] || [] }.map do |step|
      {
        instruction: instruction_for(step),
        distance_m: step["distance"].to_f.round,
        name: step["name"].to_s
      }
    end
  end

  # Build a short, legible instruction from the OSRM maneuver + road name.
  def instruction_for(step)
    maneuver = step["maneuver"] || {}
    type = maneuver["type"].to_s
    modifier = maneuver["modifier"].to_s.strip
    name = step["name"].to_s.strip
    onto = name.empty? ? "" : " onto #{name}"

    case type
    when "depart"
      road = name.empty? ? "" : " on #{name}"
      "Head #{compass(maneuver['bearing_after'])}#{road}"
    when "arrive"
      "You have arrived at your destination"
    when "turn", "end of road"
      "Turn #{modifier.presence || 'ahead'}#{onto}"
    when "new name", "continue"
      "Continue#{onto}"
    when "merge"
      "Merge#{onto}"
    when "on ramp"
      "Take the ramp#{onto}"
    when "off ramp"
      "Take the exit#{onto}"
    when "fork"
      "Keep #{modifier.presence || 'straight'}#{onto}"
    when "roundabout", "rotary", "roundabout turn"
      "Take the roundabout#{onto}"
    else
      modifier.present? ? "#{modifier.capitalize}#{onto}" : "Continue#{onto}"
    end
  end

  def compass(bearing)
    return "out" unless bearing.is_a?(Numeric)

    COMPASS[((bearing % 360) / 45.0).round % 8]
  end
end
