require "rails_helper"

RSpec.describe "GET /api/geocode", type: :request do
  let(:nominatim_url) { "https://nominatim.openstreetmap.org/search" }

  def json_body
    JSON.parse(response.body)
  end

  context "when the query is shorter than 3 characters" do
    it "returns an empty array without hitting the upstream service" do
      get "/api/geocode", params: { q: "ab" }

      expect(response).to have_http_status(:ok)
      expect(json_body).to eq([])
      expect(a_request(:get, nominatim_url)).not_to have_been_made
    end

    it "treats a whitespace-padded short query as too short" do
      get "/api/geocode", params: { q: "  a  " }

      expect(json_body).to eq([])
      expect(a_request(:get, nominatim_url)).not_to have_been_made
    end

    it "returns an empty array when no query is given" do
      get "/api/geocode"

      expect(json_body).to eq([])
      expect(a_request(:get, nominatim_url)).not_to have_been_made
    end
  end

  context "with a successful upstream response" do
    let(:nominatim_rows) do
      [
        {
          osm_type: "node",
          osm_id: 123,
          lat: "37.7955",
          lon: "-122.3937",
          display_name: "Ferry Building, The Embarcadero, Financial District, San Francisco, California, 94111, United States"
        },
        {
          osm_type: "way",
          osm_id: 456,
          lat: "37.7880",
          lon: "-122.4074",
          display_name: "Union Square, Geary Street, Downtown, San Francisco, California, United States"
        }
      ]
    end

    before do
      stub_request(:get, nominatim_url)
        .with(query: hash_including({}))
        .to_return(
          status: 200,
          headers: { "Content-Type" => "application/json" },
          body: nominatim_rows.to_json
        )
    end

    it "maps the upstream rows into value/label/hint/lat/lng" do
      get "/api/geocode", params: { q: "ferry" }

      expect(response).to have_http_status(:ok)
      results = json_body
      expect(results.length).to eq(2)

      first = results.first
      expect(first["value"]).to eq("osm-node-123")
      expect(first["label"]).to eq("Ferry Building")
      expect(first["hint"]).to eq("The Embarcadero, Financial District, San Francisco")
      expect(first["lat"]).to eq(37.7955)
      expect(first["lng"]).to eq(-122.3937)
    end

    it "sends the SF viewbox, bounded=1 and the custom User-Agent upstream" do
      get "/api/geocode", params: { q: "ferry" }

      expect(
        a_request(:get, nominatim_url)
          .with(
            query: hash_including(
              "q" => "ferry",
              "viewbox" => "-122.5247,37.8324,-122.3366,37.7034",
              "bounded" => "1",
              "countrycodes" => "us"
            ),
            headers: { "User-Agent" => "GasFinder/1.0 (San Francisco gas station finder)" }
          )
      ).to have_been_made.once
    end
  end

  context "with structured address details" do
    it "builds the label from the house number and road" do
      rows = [
        {
          osm_type: "way", osm_id: 595,
          lat: "37.7897", lon: "-122.3972",
          name: "",
          display_name: "595, Market Street, Yerba Buena, San Francisco, California, 94105, United States",
          address: { "house_number" => "595", "road" => "Market Street", "neighbourhood" => "Yerba Buena", "city" => "San Francisco" }
        }
      ]
      stub_request(:get, nominatim_url).with(query: hash_including({})).to_return(status: 200, body: rows.to_json)

      get "/api/geocode", params: { q: "595 market" }

      result = json_body.first
      expect(result["label"]).to eq("595 Market Street")
      expect(result["hint"]).to eq("Yerba Buena, San Francisco")
    end

    it "uses the place name for a POI with no house number" do
      rows = [
        {
          osm_type: "way", osm_id: 10,
          lat: "37.7955", lon: "-122.3937",
          name: "Ferry Building",
          display_name: "Ferry Building, The Embarcadero, San Francisco, California, United States",
          address: { "road" => "The Embarcadero", "neighbourhood" => "Embarcadero", "city" => "San Francisco" }
        }
      ]
      stub_request(:get, nominatim_url).with(query: hash_including({})).to_return(status: 200, body: rows.to_json)

      get "/api/geocode", params: { q: "ferry building" }

      result = json_body.first
      expect(result["label"]).to eq("Ferry Building")
      expect(result["hint"]).to eq("Embarcadero, San Francisco")
    end
  end

  context "when some upstream rows are missing coordinates" do
    before do
      rows = [
        { osm_type: "node", osm_id: 1, lat: "37.80", lon: "-122.41", display_name: "Good Place, San Francisco" },
        { osm_type: "node", osm_id: 2, lat: nil, lon: "-122.41", display_name: "No Lat, San Francisco" },
        { osm_type: "node", osm_id: 3, lat: "37.81", display_name: "No Lon, San Francisco" }
      ]
      stub_request(:get, nominatim_url).with(query: hash_including({})).to_return(status: 200, body: rows.to_json)
    end

    it "drops the rows without both lat and lon" do
      get "/api/geocode", params: { q: "place" }

      results = json_body
      expect(results.length).to eq(1)
      expect(results.first["value"]).to eq("osm-node-1")
    end
  end

  context "when the upstream service fails" do
    it "returns an empty array with HTTP 200 on a 500 response" do
      stub_request(:get, nominatim_url).with(query: hash_including({})).to_return(status: 500, body: "boom")

      get "/api/geocode", params: { q: "ferry" }

      expect(response).to have_http_status(:ok)
      expect(json_body).to eq([])
    end

    it "returns an empty array with HTTP 200 on a timeout" do
      stub_request(:get, nominatim_url).with(query: hash_including({})).to_timeout

      get "/api/geocode", params: { q: "ferry" }

      expect(response).to have_http_status(:ok)
      expect(json_body).to eq([])
    end

    it "returns an empty array with HTTP 200 on malformed JSON" do
      stub_request(:get, nominatim_url).with(query: hash_including({})).to_return(status: 200, body: "not json")

      get "/api/geocode", params: { q: "ferry" }

      expect(response).to have_http_status(:ok)
      expect(json_body).to eq([])
    end
  end
end
