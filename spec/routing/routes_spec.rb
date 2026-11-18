require "rails_helper"

RSpec.describe "Routing", type: :routing do
  it "routes the root path to home#index" do
    expect(get: "/").to route_to("home#index")
  end

  it "routes GET /api/geocode to geocode#index" do
    expect(get: "/api/geocode").to route_to("geocode#index")
  end
end
