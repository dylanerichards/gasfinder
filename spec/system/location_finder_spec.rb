require "rails_helper"

RSpec.describe "Location finder", type: :system do
  it "sets a location from a landmark and reveals the map" do
    visit "/"

    click_button "Choose a location"

    # Open the custom landmark dropdown and pick a landmark.
    find("button[aria-label='San Francisco landmark']").click
    find("li.gf-dd__opt", text: "Ferry Building").click

    click_button "Set location"

    # The reveal animation swaps the intro for the "Your location" panel.
    expect(page).to have_css("h1", text: "Your location")

    # The meta list shows the picked landmark's latitude (toFixed(6)).
    within("dl.til-meta") do
      expect(page).to have_content("Latitude")
      expect(page).to have_content("37.795500")
    end

    # The confirmation toast names the place.
    expect(page).to have_css(".gf-toast.is-show", text: "Location set — Ferry Building")

    # The Leaflet map is injected.
    expect(page).to have_css(".leaflet-container")
  end

  it "sets a location from an async address search" do
    nominatim_rows = [
      {
        osm_type: "node",
        osm_id: 777,
        lat: "37.7955",
        lon: "-122.3937",
        display_name: "Ferry Building, The Embarcadero, San Francisco, California, United States"
      }
    ]
    stub_request(:get, "https://nominatim.openstreetmap.org/search")
      .with(query: hash_including({}))
      .to_return(status: 200, headers: { "Content-Type" => "application/json" }, body: nominatim_rows.to_json)

    visit "/"
    click_button "Choose a location"

    # Open the async address dropdown and type a query past the 3-char minimum.
    find("button[aria-label='Address or place']").click
    fill_in_search "ferry building"

    # The WebMock-stubbed geocode result shows up; select it.
    find("li.gf-dd__opt", text: "Ferry Building").click

    click_button "Set location"

    expect(page).to have_css("h1", text: "Your location")
    expect(page).to have_css(".gf-toast.is-show", text: "Location set — Ferry Building")
    expect(page).to have_css(".leaflet-container")
  end

  it "shows an inline error when submitting with nothing selected" do
    visit "/"
    click_button "Choose a location"

    click_button "Set location"

    expect(page).to have_content("Pick a landmark or search for an address.")
    # Still on the input screen — no reveal happened.
    expect(page).to have_no_css("h1", text: "Your location")
  end

  # The address dropdown's search field has no label/name, so target it by its
  # placeholder inside the open panel.
  def fill_in_search(text)
    field = find("input.gf-dd__search-input")
    field.set(text)
  end
end
