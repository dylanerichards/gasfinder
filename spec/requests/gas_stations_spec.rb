require "rails_helper"

RSpec.describe "GET /api/gas_stations", type: :request do
  let(:overpass_url) { "https://overpass-api.de/api/interpreter" }

  # Near the Ferry Building (37.7955, -122.3937).
  let(:lat) { 37.7955 }
  let(:lng) { -122.3937 }

  def json_body
    JSON.parse(response.body)
  end

  # Builds an Overpass element. Pass a lat/lon offset so distances differ.
  def node(id, dlat:, dlng:, tags: {})
    { type: "node", id: id, lat: lat + dlat, lon: lng + dlng, tags: tags }
  end

  def stub_overpass(elements, radius: nil)
    matcher = stub_request(:post, overpass_url)
    matcher = matcher.with(body: hash_including("data" => /around:#{radius},/)) if radius
    matcher.to_return(
      status: 200,
      headers: { "Content-Type" => "application/json" },
      body: { elements: elements }.to_json
    )
  end

  context "when lat/lng are missing or invalid" do
    it "returns [] without hitting Overpass when both are missing" do
      get "/api/gas_stations"

      expect(response).to have_http_status(:ok)
      expect(json_body).to eq([])
      expect(a_request(:post, overpass_url)).not_to have_been_made
    end

    it "returns [] when lng is missing" do
      get "/api/gas_stations", params: { lat: lat }

      expect(json_body).to eq([])
      expect(a_request(:post, overpass_url)).not_to have_been_made
    end

    it "returns [] when a coordinate is not numeric" do
      get "/api/gas_stations", params: { lat: "nope", lng: lng }

      expect(json_body).to eq([])
      expect(a_request(:post, overpass_url)).not_to have_been_made
    end

    it "returns [] when a coordinate is out of range" do
      get "/api/gas_stations", params: { lat: 120.0, lng: lng }

      expect(json_body).to eq([])
      expect(a_request(:post, overpass_url)).not_to have_been_made
    end
  end

  context "with a successful upstream response" do
    before do
      elements = [
        node(1, dlat: 0.0090, dlng: 0.0, tags: { "name" => "Far Fuel" }),          # ~1000 m
        node(2, dlat: 0.0009, dlng: 0.0, tags: { "name" => "Near Fuel", "brand" => "Shell" }), # ~100 m
        node(3, dlat: 0.0045, dlng: 0.0, tags: { "name" => "Mid Fuel" }),          # ~500 m
        {
          type: "way", id: 4,
          center: { lat: lat + 0.0027, lon: lng },                                 # ~300 m
          tags: { "name" => "Way Fuel", "addr:housenumber" => "500", "addr:street" => "Market Street" }
        },
        node(5, dlat: 0.0018, dlng: 0.0, tags: {}),                                # ~200 m, unnamed
        node(6, dlat: 0.0063, dlng: 0.0, tags: { "operator" => "Costco" })         # ~700 m
      ]
      stub_overpass(elements)
    end

    it "maps, sorts by ascending distance and limits to 5" do
      get "/api/gas_stations", params: { lat: lat, lng: lng }

      expect(response).to have_http_status(:ok)
      results = json_body
      expect(results.length).to eq(5)

      names = results.map { |r| r["name"] }
      expect(names).to eq([ "Near Fuel", "Gas station", "Way Fuel", "Mid Fuel", "Costco" ])
      # Farthest (Far Fuel, ~1000 m) is dropped by the limit.
      expect(names).not_to include("Far Fuel")

      distances = results.map { |r| r["distance_m"] }
      expect(distances).to eq(distances.sort)
    end

    it "shapes each station with id, coords, distance, brand and address" do
      get "/api/gas_stations", params: { lat: lat, lng: lng }

      near = json_body.find { |r| r["name"] == "Near Fuel" }
      expect(near["id"]).to eq("osm-node-2")
      expect(near["brand"]).to eq("Shell")
      expect(near["lat"]).to be_within(0.0001).of(lat + 0.0009)
      expect(near["distance_m"]).to be_within(20).of(100)

      way = json_body.find { |r| r["name"] == "Way Fuel" }
      expect(way["id"]).to eq("osm-way-4")
      expect(way["address"]).to eq("500 Market Street")
    end

    it "sends amenity=fuel around the point with the custom User-Agent" do
      get "/api/gas_stations", params: { lat: lat, lng: lng }

      expect(
        a_request(:post, overpass_url)
          .with(
            body: hash_including("data" => /amenity.*fuel.*around:2500,#{Regexp.escape(lat.to_s)},#{Regexp.escape(lng.to_s)}/m),
            headers: { "User-Agent" => "GasFinder/1.0 (San Francisco gas station finder)" }
          )
      ).to have_been_made.once
    end
  end

  context "when the tight radius returns fewer than five" do
    it "widens the radius once and uses the second response" do
      stub_overpass([ node(1, dlat: 0.001, dlng: 0.0, tags: { "name" => "Lonely Fuel" }) ], radius: 2500)
      wide = (1..5).map { |i| node(i, dlat: 0.001 * i, dlng: 0.0, tags: { "name" => "Fuel #{i}" }) }
      stub_overpass(wide, radius: 6000)

      get "/api/gas_stations", params: { lat: lat, lng: lng }

      expect(json_body.length).to eq(5)
      expect(a_request(:post, overpass_url).with(body: hash_including("data" => /around:2500,/))).to have_been_made.once
      expect(a_request(:post, overpass_url).with(body: hash_including("data" => /around:6000,/))).to have_been_made.once
    end

    it "does not widen when the first radius already yields five" do
      stub_overpass((1..5).map { |i| node(i, dlat: 0.001 * i, dlng: 0.0, tags: { "name" => "Fuel #{i}" }) }, radius: 2500)

      get "/api/gas_stations", params: { lat: lat, lng: lng }

      expect(json_body.length).to eq(5)
      expect(a_request(:post, overpass_url).with(body: hash_including("data" => /around:6000,/))).not_to have_been_made
    end
  end

  context "when the upstream service fails" do
    it "returns [] with HTTP 200 on a 500 response" do
      stub_request(:post, overpass_url).to_return(status: 500, body: "boom")

      get "/api/gas_stations", params: { lat: lat, lng: lng }

      expect(response).to have_http_status(:ok)
      expect(json_body).to eq([])
    end

    it "returns [] with HTTP 200 on a timeout" do
      stub_request(:post, overpass_url).to_timeout

      get "/api/gas_stations", params: { lat: lat, lng: lng }

      expect(response).to have_http_status(:ok)
      expect(json_body).to eq([])
    end

    it "returns [] with HTTP 200 on malformed JSON" do
      stub_request(:post, overpass_url).to_return(status: 200, body: "not json")

      get "/api/gas_stations", params: { lat: lat, lng: lng }

      expect(response).to have_http_status(:ok)
      expect(json_body).to eq([])
    end
  end
end
