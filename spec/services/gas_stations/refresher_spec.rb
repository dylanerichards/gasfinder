require "rails_helper"

RSpec.describe GasStations::Refresher do
  it "runs the generator and reloads the dataset on success" do
    status = instance_double(Process::Status, success?: true)
    allow(Open3).to receive(:capture2e).and_return([ "Wrote 131 gas stations\n", status ])
    allow(GasStationsController).to receive(:reload_stations!)

    expect(described_class.new.call).to eq("Wrote 131 gas stations")
    expect(GasStationsController).to have_received(:reload_stations!)
  end

  it "raises and does not reload when the generator fails" do
    status = instance_double(Process::Status, success?: false, exitstatus: 1)
    allow(Open3).to receive(:capture2e).and_return([ "boom\n", status ])
    allow(GasStationsController).to receive(:reload_stations!)

    expect { described_class.new.call }
      .to raise_error(GasStations::Refresher::RefreshError, /boom/)
    expect(GasStationsController).not_to have_received(:reload_stations!)
  end

  it "runs the gas-station generator script with the configured interpreter" do
    status = instance_double(Process::Status, success?: true)
    allow(GasStationsController).to receive(:reload_stations!)
    allow(ENV).to receive(:[]).and_call_original
    allow(ENV).to receive(:[]).with("OVERTURE_PYTHON").and_return("/usr/bin/python3")
    allow(Open3).to receive(:capture2e).and_return([ "", status ])

    described_class.new.call

    expect(Open3).to have_received(:capture2e)
      .with("/usr/bin/python3", a_string_ending_with("script/fetch_sf_gas_stations.py"))
  end
end
