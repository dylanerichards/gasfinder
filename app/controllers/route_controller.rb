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

  # Max distance (m) from a walking step to a car road for us to borrow that
  # road's name. Beyond this the path is genuinely off-street, so it stays
  # generic rather than being mislabelled.
  NEAREST_MAX_DISTANCE_M = 60

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
      steps: steps(mode, route)
    }
  end

  # GeoJSON is [lng, lat]; Leaflet wants [lat, lng].
  def geometry(route)
    coords = route.dig("geometry", "coordinates") || []
    coords.map { |lng, lat| [ lat, lng ] }
  end

  def steps(mode, route)
    raw = (route["legs"] || []).flat_map { |leg| leg["steps"] || [] }
    names = resolved_names(mode, raw)
    raw.each_with_index.map do |step, i|
      name = names[i]
      {
        instruction: instruction_for(step, name),
        distance_m: step["distance"].to_f.round,
        name: name
      }
    end
  end

  # Resolve each step's road name with a fallback chain, so walking directions
  # surface street names as readily as driving does. The foot profile often
  # leaves sidewalk / crossing segments with a blank `name` even while they run
  # along a named street, so we fall back from the OSRM `name` to its numbered
  # `ref`, then to the named street an unnamed connector sits between, and
  # finally (walking only) to the nearest car road the segment runs alongside.
  # We never invent a name; every value comes straight from the routing data.
  def resolved_names(mode, raw)
    base = raw.map { |step| step_name(step) }
    bracketed = base.each_index.map do |i|
      next base[i] if base[i].present?

      before = base[0...i].reverse.find(&:present?)
      after = base[(i + 1)..].find(&:present?)
      # Inherit only when the same street brackets the gap on both sides, i.e.
      # the unnamed segment genuinely lies on that one named street.
      (before if before.present? && before == after).to_s
    end

    mode == "walk" ? enrich_with_nearest(bracketed, raw) : bracketed
  end

  # Walking routes follow unnamed sidewalk / crossing geometry, so OSRM leaves
  # many steps nameless even on named streets. For each still-unnamed step, snap
  # its segment to the nearest car road (the sidewalk runs alongside it) and use
  # that street's name.
  def enrich_with_nearest(names, raw)
    pending = {}
    names.each_index do |i|
      next if names[i].present?

      point = step_point(raw[i])
      pending[i] = point if point
    end
    return names if pending.empty?

    found = nearest_road_names(pending)
    names.each_index.map { |i| names[i].presence || found[i].to_s }
  end

  # Midpoint of a step's own geometry (clearly on the segment, away from the
  # ambiguous intersection); falls back to the maneuver location. Returns
  # [lat, lng], or nil when the step carries no usable point.
  def step_point(step)
    coords = step.dig("geometry", "coordinates")
    point = if coords.is_a?(Array) && coords.any?
      coords[coords.length / 2]
    else
      step.dig("maneuver", "location")
    end
    lng, lat = point
    return nil unless lat.is_a?(Numeric) && lng.is_a?(Numeric)

    [ lat, lng ]
  end

  # Resolve {index => [lat, lng]} to {index => name} with a small thread pool so
  # a dozen lookups don't add a dozen round-trips of latency.
  def nearest_road_names(points)
    results = {}
    mutex = Mutex.new
    queue = Queue.new
    points.each { |pair| queue << pair }

    Array.new([ points.size, 6 ].min) do
      Thread.new do
        loop do
          index, (lat, lng) = begin
            queue.pop(true)
          rescue ThreadError
            break
          end
          name = nearest_road_name(lat, lng)
          mutex.synchronize { results[index] = name } if name
        rescue StandardError => e
          Rails.logger.warn("nearest worker failed: #{e.class}: #{e.message}")
        end
      end
    end.each(&:join)

    results
  end

  # Nearest named car road to a point, or nil. Cached long (street names are
  # static) and tolerant of upstream failure so directions still render.
  def nearest_road_name(lat, lng)
    key = format("nearest/v1/%.5f,%.5f", lat, lng)
    Rails.cache.fetch(key, expires_in: 7.days, skip_nil: true) do
      uri = URI("https://routing.openstreetmap.de/routed-car/nearest/v1/driving/#{lng},#{lat}")
      uri.query = URI.encode_www_form(number: 1)
      req = Net::HTTP::Get.new(uri)
      req["User-Agent"] = USER_AGENT
      res = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true, open_timeout: 4, read_timeout: 6) do |http|
        http.request(req)
      end
      next nil unless res.is_a?(Net::HTTPSuccess)

      waypoint = JSON.parse(res.body)["waypoints"]&.first
      name = waypoint && waypoint["name"].to_s.strip
      name.presence if name.present? && waypoint["distance"].to_f <= NEAREST_MAX_DISTANCE_M
    end
  rescue Net::OpenTimeout, Net::ReadTimeout, SocketError, JSON::ParserError => e
    Rails.logger.warn("nearest lookup failed: #{e.class}: #{e.message}")
    nil
  end

  # A step's own road name: the OSRM `name`, or its `ref` (e.g. "US-101") when
  # the name is blank. Returns "" when the step is genuinely unnamed.
  def step_name(step)
    name = step["name"].to_s.strip
    return name unless name.empty?

    step["ref"].to_s.strip
  end

  # Build a short, legible instruction from the OSRM maneuver + resolved name.
  def instruction_for(step, name)
    maneuver = step["maneuver"] || {}
    type = maneuver["type"].to_s
    modifier = maneuver["modifier"].to_s.strip
    name = name.to_s.strip
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
