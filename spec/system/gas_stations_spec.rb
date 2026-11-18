require "rails_helper"

RSpec.describe "Nearest gas stations", type: :system do
  def set_location_from_landmark(name = "Ferry Building")
    visit "/"
    click_button "Choose a location"
    find("button[aria-label='San Francisco landmark']").click
    find("li.gf-dd__opt", text: name).click
    click_button "Set location"
    expect(page).to have_css("h1", text: "Your location")
  end

  it "lists the five nearest stations and plots them on the map" do
    set_location_from_landmark

    expect(page).to have_css(".gf-station", count: 5)
    # Each row shows a formatted distance and a destination button.
    expect(page).to have_css(".gf-station__dist", count: 5)
    expect(page).to have_button("Set as destination")

    expect(page).to have_css(".leaflet-container")
    expect(page).to have_css(".leaflet-marker-icon.gf-smarker", count: 5)
  end

  it "sets a station as the destination from the list" do
    stub_request(:get, %r{routing\.openstreetmap\.de/routed-car/route/v1/driving/})
      .to_return(status: 200, headers: { "Content-Type" => "application/json" }, body: driving_body)

    set_location_from_landmark
    expect(page).to have_css(".gf-station", count: 5)

    within first(".gf-station") do
      click_button "Set as destination"
    end

    selected = find(".gf-station.is-selected")
    expect(selected).to have_button("Selected")
    expect(selected).to have_css(".gf-station__tag", text: "Destination")

    # One destination at a time, with a highlighted pin on the map.
    expect(page).to have_css(".gf-station.is-selected", count: 1)
    expect(page).to have_css(".leaflet-marker-icon.gf-smarker--on", count: 1)

    # Directions replace the old placeholder note.
    expect(page).to have_css(".gf-route")
    expect(page).to have_no_content("Directions are coming soon")
  end

  def driving_body
    {
      code: "Ok",
      routes: [
        {
          distance: 2100.0, duration: 480.0,
          geometry: { type: "LineString", coordinates: [ [ -122.3937, 37.7955 ], [ -122.40, 37.78 ] ] },
          legs: [ { steps: [
            { distance: 150.0, name: "The Embarcadero", maneuver: { type: "depart", bearing_after: 315 } },
            { distance: 0.0, name: "", maneuver: { type: "arrive" } }
          ] } ]
        }
      ]
    }.to_json
  end

  it "shows an empty state when the dataset has no stations" do
    allow(GasStationsController).to receive(:stations).and_return([])

    set_location_from_landmark

    expect(page).to have_content("No gas stations found nearby")
    expect(page).to have_no_css(".gf-station")
  end
end
