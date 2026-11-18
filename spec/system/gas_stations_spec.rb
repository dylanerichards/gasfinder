require "rails_helper"

RSpec.describe "Nearest gas stations", type: :system do
  # Overpass fuel nodes clustered around the Ferry Building (37.7955, -122.3937).
  let(:overpass_elements) do
    [
      { type: "node", id: 1, lat: 37.7960, lon: -122.3937, tags: { "name" => "Embarcadero Fuel", "brand" => "Shell" } },
      { type: "node", id: 2, lat: 37.7948, lon: -122.3950, tags: { "name" => "Market Street Gas" } },
      { type: "node", id: 3, lat: 37.7975, lon: -122.3920, tags: { "name" => "Pier 1 Fuel", "addr:housenumber" => "1", "addr:street" => "The Embarcadero" } },
      { type: "node", id: 4, lat: 37.7930, lon: -122.3965, tags: { "name" => "Folsom Fuel" } },
      { type: "node", id: 5, lat: 37.7990, lon: -122.3900, tags: { "name" => "Washington Gas" } },
      { type: "node", id: 6, lat: 37.8020, lon: -122.3870, tags: { "name" => "Far Away Fuel" } }
    ]
  end

  before do
    stub_request(:post, "https://overpass-api.de/api/interpreter")
      .to_return(
        status: 200,
        headers: { "Content-Type" => "application/json" },
        body: { elements: overpass_elements }.to_json
      )
  end

  def set_ferry_building_location
    visit "/"
    click_button "Choose a location"
    find("button[aria-label='San Francisco landmark']").click
    find("li.gf-dd__opt", text: "Ferry Building").click
    click_button "Set location"
    expect(page).to have_css("h1", text: "Your location")
  end

  it "lists the five nearest stations and plots them on the map" do
    set_ferry_building_location

    # Exactly five rows (the sixth, farthest station is dropped by the limit).
    expect(page).to have_css(".gf-station", count: 5)
    expect(page).to have_content("Embarcadero Fuel")
    expect(page).to have_content("Market Street Gas")
    expect(page).to have_no_content("Far Away Fuel")

    # Brand and address detail surface on the rows.
    expect(page).to have_content("Shell")
    expect(page).to have_content("1 The Embarcadero")

    # The Leaflet map and five distinct station markers render.
    expect(page).to have_css(".leaflet-container")
    expect(page).to have_css(".leaflet-marker-icon.gf-smarker", count: 5)
  end

  it "sets a station as the destination from the list" do
    set_ferry_building_location
    expect(page).to have_css(".gf-station", count: 5)

    within first(".gf-station") do
      click_button "Set as destination"
    end

    # The chosen row is highlighted and now reads as the destination.
    selected = find(".gf-station.is-selected")
    expect(selected).to have_button("Selected")
    expect(selected).to have_css(".gf-station__tag", text: "Destination")

    # Only one destination at a time, and the map shows a highlighted pin.
    expect(page).to have_css(".gf-station.is-selected", count: 1)
    expect(page).to have_css(".leaflet-marker-icon.gf-smarker--on", count: 1)
    expect(page).to have_content("Directions are coming soon")
  end

  it "shows an empty state when no stations are nearby" do
    stub_request(:post, "https://overpass-api.de/api/interpreter")
      .to_return(status: 200, headers: { "Content-Type" => "application/json" }, body: { elements: [] }.to_json)

    set_ferry_building_location

    expect(page).to have_content("No gas stations found nearby")
    expect(page).to have_no_css(".gf-station")
  end
end
