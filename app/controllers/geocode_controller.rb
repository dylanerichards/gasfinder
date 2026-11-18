require "net/http"
require "json"

# Proxies address search to OpenStreetMap's Nominatim, biased to San Francisco.
# Kept server-side so we send a proper User-Agent (per Nominatim's usage policy)
# and never expose any user identity — only the typed query is forwarded.
class GeocodeController < ApplicationController
  # left,top,right,bottom (lon,lat) — San Francisco bounding box.
  SF_VIEWBOX = "-122.5247,37.8324,-122.3366,37.7034".freeze
  USER_AGENT = "GasFinder/1.0 (San Francisco gas station finder)".freeze

  def index
    query = params[:q].to_s.strip
    return render(json: []) if query.length < 3

    render json: search(query)
  rescue => e
    Rails.logger.warn("geocode failed: #{e.class}: #{e.message}")
    render json: [], status: :ok
  end

  private

  def search(query)
    uri = URI("https://nominatim.openstreetmap.org/search")
    uri.query = URI.encode_www_form(
      q: query,
      format: "jsonv2",
      addressdetails: 1,
      limit: 6,
      countrycodes: "us",
      viewbox: SF_VIEWBOX,
      bounded: 1
    )

    req = Net::HTTP::Get.new(uri)
    req["User-Agent"] = USER_AGENT
    req["Accept-Language"] = "en"

    res = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true, open_timeout: 4, read_timeout: 6) do |http|
      http.request(req)
    end
    return [] unless res.is_a?(Net::HTTPSuccess)

    JSON.parse(res.body).filter_map { |row| format_result(row) }
  end

  def format_result(row)
    lat = row["lat"]&.to_f
    lng = row["lon"]&.to_f
    return nil unless lat && lng

    name = row["display_name"].to_s
    primary, *rest = name.split(", ")
    {
      value: "osm-#{row['osm_type']}-#{row['osm_id']}",
      label: primary.presence || name,
      hint: rest.first(3).join(", "),
      lat: lat,
      lng: lng
    }
  end
end
