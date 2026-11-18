require "rails_helper"

RSpec.describe "GET /api/route", type: :request do
  def json_body
    JSON.parse(response.body)
  end

  let(:car_url) { %r{\Ahttps://routing\.openstreetmap\.de/routed-car/route/v1/driving/} }
  let(:foot_url) { %r{\Ahttps://routing\.openstreetmap\.de/routed-foot/route/v1/walking/} }

  # A compact OSRM payload exercising the main maneuver types.
  def osrm_body(distance: 3380.4, duration: 487.6)
    {
      code: "Ok",
      routes: [
        {
          distance: distance,
          duration: duration,
          geometry: {
            type: "LineString",
            coordinates: [ [ -122.3937, 37.7955 ], [ -122.4000, 37.7800 ], [ -122.4100, 37.7700 ] ]
          },
          legs: [
            {
              steps: [
                { distance: 120.2, name: "The Embarcadero", maneuver: { type: "depart", bearing_after: 315 } },
                { distance: 200.7, name: "Market Street", maneuver: { type: "turn", modifier: "right" } },
                { distance: 0.0, name: "", maneuver: { type: "arrive" } }
              ]
            }
          ]
        }
      ]
    }
  end

  let(:valid_params) do
    { from_lat: "37.7955", from_lng: "-122.3937", to_lat: "37.7700", to_lng: "-122.4100" }
  end

  context "with a successful driving response" do
    before do
      stub_request(:get, car_url).to_return(
        status: 200,
        headers: { "Content-Type" => "application/json" },
        body: osrm_body.to_json
      )
    end

    it "maps distance, duration, geometry and steps" do
      get "/api/route", params: valid_params.merge(mode: "drive")

      expect(response).to have_http_status(:ok)
      body = json_body
      expect(body["mode"]).to eq("drive")
      expect(body["distance_m"]).to eq(3380)
      expect(body["duration_s"]).to eq(488)
      expect(body["distance_m"]).to be_a(Integer)

      # GeoJSON [lng,lat] is converted to Leaflet [lat,lng].
      expect(body["geometry"].first).to eq([ 37.7955, -122.3937 ])
      expect(body["geometry"].last).to eq([ 37.7700, -122.4100 ])
    end

    it "builds human-readable instructions" do
      get "/api/route", params: valid_params.merge(mode: "drive")

      instructions = json_body["steps"].map { |s| s["instruction"] }
      expect(instructions).to eq(
        [
          "Head northwest on The Embarcadero",
          "Turn right onto Market Street",
          "You have arrived at your destination"
        ]
      )
      expect(json_body["steps"].first["distance_m"]).to eq(120)
      expect(json_body["steps"].first["name"]).to eq("The Embarcadero")
    end

    it "requests the routed-car host with lng,lat coordinate order" do
      get "/api/route", params: valid_params.merge(mode: "drive")

      expect(
        a_request(:get, %r{routed-car/route/v1/driving/-122\.3937,37\.7955;-122\.41,37\.77})
      ).to have_been_made.once
    end

    it "defaults to driving when the mode is missing or unknown" do
      get "/api/route", params: valid_params.merge(mode: "teleport")

      expect(json_body["mode"]).to eq("drive")
      expect(a_request(:get, car_url)).to have_been_made.once
    end
  end

  context "with a successful walking response" do
    before do
      stub_request(:get, foot_url).to_return(
        status: 200,
        headers: { "Content-Type" => "application/json" },
        body: osrm_body(distance: 1510.0, duration: 1100.0).to_json
      )
    end

    it "proxies the routed-foot walking host and reports walk mode" do
      get "/api/route", params: valid_params.merge(mode: "walk")

      expect(json_body["mode"]).to eq("walk")
      expect(json_body["distance_m"]).to eq(1510)
      expect(
        a_request(:get, %r{routed-foot/route/v1/walking/-122\.3937,37\.7955;-122\.41,37\.77})
      ).to have_been_made.once
    end
  end

  context "with invalid parameters" do
    it "returns an error when a coordinate is missing" do
      get "/api/route", params: { from_lat: "37.79", from_lng: "-122.39", to_lat: "37.77" }

      expect(response).to have_http_status(:ok)
      expect(json_body).to eq("error" => "Invalid coordinates.")
      expect(a_request(:get, car_url)).not_to have_been_made
    end

    it "returns an error when a coordinate is non-numeric" do
      get "/api/route", params: valid_params.merge(from_lat: "abc")

      expect(json_body["error"]).to be_present
      expect(json_body).not_to have_key("geometry")
    end

    it "returns an error when a coordinate is out of range" do
      get "/api/route", params: valid_params.merge(to_lng: "-999")

      expect(json_body["error"]).to be_present
    end
  end

  context "when the upstream service fails" do
    it "returns an error with HTTP 200 on a non-200 response" do
      stub_request(:get, car_url).to_return(status: 500, body: "boom")

      get "/api/route", params: valid_params.merge(mode: "drive")

      expect(response).to have_http_status(:ok)
      expect(json_body).to eq("error" => "Couldn't load directions.")
    end

    it "returns an error with HTTP 200 on a timeout" do
      stub_request(:get, car_url).to_timeout

      get "/api/route", params: valid_params.merge(mode: "drive")

      expect(response).to have_http_status(:ok)
      expect(json_body["error"]).to be_present
    end

    it "returns an error when OSRM reports a non-Ok code" do
      stub_request(:get, car_url).to_return(
        status: 200,
        body: { code: "NoRoute", routes: [] }.to_json
      )

      get "/api/route", params: valid_params.merge(mode: "drive")

      expect(response).to have_http_status(:ok)
      expect(json_body).to eq("error" => "Couldn't load directions.")
    end

    it "returns an error on malformed JSON" do
      stub_request(:get, car_url).to_return(status: 200, body: "not json")

      get "/api/route", params: valid_params.merge(mode: "drive")

      expect(json_body["error"]).to be_present
    end
  end
end
