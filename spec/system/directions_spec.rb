require "rails_helper"

RSpec.describe "Turn-by-turn directions", type: :system do
  # Distinct bodies so we can tell drive vs walk apart in the summary.
  def osrm_body(distance:, duration:)
    {
      code: "Ok",
      routes: [
        {
          distance: distance, duration: duration,
          geometry: {
            type: "LineString",
            coordinates: [ [ -122.3937, 37.7955 ], [ -122.40, 37.78 ], [ -122.41, 37.77 ] ]
          },
          legs: [ { steps: [
            { distance: 180.0, name: "The Embarcadero", maneuver: { type: "depart", bearing_after: 315 } },
            { distance: 240.0, name: "Market Street", maneuver: { type: "turn", modifier: "right" } },
            { distance: 0.0, name: "", maneuver: { type: "arrive" } }
          ] } ]
        }
      ]
    }.to_json
  end

  def stub_driving
    stub_request(:get, %r{routing\.openstreetmap\.de/routed-car/route/v1/driving/})
      .to_return(status: 200, headers: { "Content-Type" => "application/json" },
                 body: osrm_body(distance: 3380.0, duration: 480.0))
  end

  def stub_walking
    stub_request(:get, %r{routing\.openstreetmap\.de/routed-foot/route/v1/walking/})
      .to_return(status: 200, headers: { "Content-Type" => "application/json" },
                 body: osrm_body(distance: 1600.0, duration: 1200.0))
  end

  def set_destination
    visit "/"
    click_button "Choose a location"
    find("button[aria-label='San Francisco landmark']").click
    find("li.gf-dd__opt", text: "Ferry Building").click
    click_button "Set location"
    expect(page).to have_css("h1", text: "Your location")
    expect(page).to have_css(".gf-station", count: 5)
    within(first(".gf-station")) { click_button "Set as destination" }
  end

  it "shows the mode toggle, summary and turn-by-turn steps, and refetches on walk" do
    stub_driving
    stub_walking

    set_destination

    # Mode toggle defaults to Drive.
    toggle = find(".gf-route .til-seg[aria-label='Travel mode']")
    expect(toggle).to have_button("Drive")
    expect(toggle).to have_button("Walk")

    # Prominent summary: driving time + distance.
    expect(page).to have_css(".gf-route__summary")
    expect(page).to have_css(".gf-route__time", text: "8 min")
    expect(page).to have_css(".gf-route__dist", text: "2.1 mi")

    # Numbered steps with built instructions.
    expect(page).to have_css(".gf-step", minimum: 2)
    expect(page).to have_content("Head northwest on The Embarcadero")
    expect(page).to have_content("Turn right onto Market Street")
    expect(page).to have_content("You have arrived at your destination")

    # The route is drawn on the map.
    expect(page).to have_css(".gf-routeline--drive")

    # Switching to Walk refetches (longer time, dashed line).
    click_button "Walk"
    expect(page).to have_css(".gf-route__time", text: "20 min")
    expect(page).to have_css(".gf-route__dist", text: "1.0 mi")
    expect(page).to have_css(".gf-routeline--walk")
    expect(a_request(:get, %r{routed-foot/route/v1/walking/})).to have_been_made
  end

  it "shows an error state when directions can't be loaded" do
    stub_request(:get, %r{routing\.openstreetmap\.de/routed-car/route/v1/driving/})
      .to_return(status: 500, body: "boom")

    set_destination

    expect(page).to have_content("Couldn’t load directions")
    expect(page).to have_no_css(".gf-routeline--drive")
  end
end
