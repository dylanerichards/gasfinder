require "rails_helper"

RSpec.describe "Shortest-route auto-pick", type: :system do
  # Three stations at distinct coordinates. "Near" is closest in a straight line,
  # but the stubs below give other stations the shortest actual road/foot route —
  # proving the buttons pick by real route distance, not haversine.
  let(:fixture_stations) do
    [
      { id: "near", name: "Near Station", lat: 37.7900, lng: -122.3950, brand: nil, address: "Near St" },
      { id: "mid", name: "Mid Station", lat: 37.7850, lng: -122.4000, brand: nil, address: "Mid St" },
      { id: "far", name: "Far Station", lat: 37.7800, lng: -122.4100, brand: nil, address: "Far St" }
    ]
  end

  def osrm_body(distance:)
    {
      code: "Ok",
      routes: [
        {
          distance: distance, duration: distance,
          geometry: { type: "LineString", coordinates: [ [ -122.3937, 37.7955 ], [ -122.40, 37.78 ] ] },
          legs: [ { steps: [
            { distance: distance, name: "Main Street", maneuver: { type: "depart", bearing_after: 90 } },
            { distance: 0.0, name: "", maneuver: { type: "arrive" } }
          ] } ]
        }
      ]
    }.to_json
  end

  before do
    allow(GasStationsController).to receive(:stations).and_return(fixture_stations)
    # Defaults: every station is far. Per-station stubs below (declared later, so
    # they take precedence) make one station the shortest for a given mode.
    stub_request(:get, %r{routed-car/route/v1/driving/}).to_return(status: 200, body: osrm_body(distance: 5000.0))
    stub_request(:get, %r{routed-foot/route/v1/walking/}).to_return(status: 200, body: osrm_body(distance: 4000.0))
  end

  def locate
    visit "/"
    click_button "Choose a location"
    find("button[aria-label='San Francisco landmark']").click
    find("li.gf-dd__opt", text: "Ferry Building").click
    click_button "Set location"
    expect(page).to have_css("h1", text: "Your location")
    expect(page).to have_button("Shortest drive")
  end

  it "picks the shortest driving route (not the straight-line nearest) and collapses the list" do
    # Mid (lng -122.4) wins by road even though Near is closer as the crow flies.
    stub_request(:get, %r{routed-car/route/v1/driving/[^;]+;-122\.4,}).to_return(status: 200, body: osrm_body(distance: 300.0))

    locate
    click_button "Shortest drive"

    # Mid becomes the destination and the list collapses to a summary.
    expect(page).to have_css(".gf-chosen .gf-station__name", text: "Mid Station")
    expect(page).to have_button("Show all 3")
    expect(page).to have_no_css(".gf-auto__btn") # auto-pick buttons hidden while collapsed
    expect(page).to have_css(".gf-route__mode-label", text: /driving/i)
  end

  it "picks the shortest walking route independently of the driving pick" do
    # Far (lng -122.41) has the shortest foot route.
    stub_request(:get, %r{routed-foot/route/v1/walking/[^;]+;-122\.41,}).to_return(status: 200, body: osrm_body(distance: 200.0))

    locate
    click_button "Shortest walk"

    expect(page).to have_css(".gf-chosen .gf-station__name", text: "Far Station")
    expect(page).to have_css(".gf-route__mode-label", text: /walking/i)
  end

  it "collapses on manual selection and re-expands via Show all" do
    locate
    within(first(".gf-station")) { click_button "Set as destination" }

    # Collapsed: a chosen summary + Show all, no auto-pick buttons.
    expect(page).to have_css(".gf-chosen")
    expect(page).to have_button("Show all 3")
    expect(page).to have_no_css(".gf-auto__btn")

    click_button "Show all 3"

    # Expanded again: auto-pick buttons back, no collapsed summary.
    expect(page).to have_css(".gf-auto__btn", minimum: 2)
    expect(page).to have_button("Shortest drive")
    expect(page).to have_no_css(".gf-chosen")
  end
end
