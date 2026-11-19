require "rails_helper"

RSpec.describe RefreshGasStationsJob do
  it "invokes the refresher" do
    refresher = instance_double(GasStations::Refresher, call: "Wrote 131 gas stations")
    allow(GasStations::Refresher).to receive(:new).and_return(refresher)

    described_class.perform_now

    expect(refresher).to have_received(:call)
  end

  it "logs and does not raise when the refresh fails" do
    allow(GasStations::Refresher).to receive(:new)
      .and_raise(GasStations::Refresher::RefreshError, "nope")

    expect { described_class.perform_now }.not_to raise_error
  end
end
