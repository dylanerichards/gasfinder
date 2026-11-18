require "rails_helper"

RSpec.describe "GET /api/gas_stations", type: :request do
  def json_body
    JSON.parse(response.body)
  end

  # A small deterministic dataset so distance/sort/limit are exact.
  let(:fixture) do
    [
      { id: "a", name: "Near A", lat: 37.7750, lng: -122.4180, brand: nil, address: "A St" },
      { id: "b", name: "Near B", lat: 37.7760, lng: -122.4190, brand: "Shell", address: "B St" },
      { id: "c", name: "Mid C", lat: 37.7700, lng: -122.4100, brand: nil, address: nil },
      { id: "d", name: "Mid D", lat: 37.7850, lng: -122.4300, brand: nil, address: nil },
      { id: "e", name: "Far E", lat: 37.8100, lng: -122.4600, brand: nil, address: nil },
      { id: "f", name: "Farthest F", lat: 37.7300, lng: -122.3700, brand: nil, address: nil }
    ]
  end

  context "with invalid parameters" do
    it "returns [] when lat/lng are missing" do
      get "/api/gas_stations"
      expect(response).to have_http_status(:ok)
      expect(json_body).to eq([])
    end

    it "returns [] when a coordinate is non-numeric" do
      get "/api/gas_stations", params: { lat: "abc", lng: "-122.4" }
      expect(json_body).to eq([])
    end

    it "returns [] when a coordinate is out of range" do
      get "/api/gas_stations", params: { lat: "120", lng: "-122.4" }
      expect(json_body).to eq([])
    end
  end

  context "with a fixed dataset" do
    before { allow(GasStationsController).to receive(:stations).and_return(fixture) }

    it "returns the 5 nearest stations sorted by ascending distance" do
      get "/api/gas_stations", params: { lat: "37.7749", lng: "-122.4194" }

      expect(json_body.length).to eq(5)
      distances = json_body.map { |s| s["distance_m"] }
      expect(distances).to eq(distances.sort)
      expect([ "Near A", "Near B" ]).to include(json_body.first["name"])
    end

    it "includes the expected fields with a rounded integer distance" do
      get "/api/gas_stations", params: { lat: "37.7749", lng: "-122.4194" }

      station = json_body.first
      expect(station.keys).to include("id", "name", "lat", "lng", "distance_m", "brand", "address")
      expect(station["distance_m"]).to be_a(Integer)
    end
  end

  context "with the real committed San Francisco dataset" do
    it "returns up to 5 nearby stations sorted by distance" do
      get "/api/gas_stations", params: { lat: "37.7955", lng: "-122.3937" } # Ferry Building

      results = json_body
      expect(results.length).to be_between(1, 5)
      distances = results.map { |s| s["distance_m"] }
      expect(distances).to eq(distances.sort)
      expect(results.first["name"]).to be_present
    end
  end
end
