require "rails_helper"

# Unit coverage for the class-level dataset cache that the daily refresh swaps.
RSpec.describe GasStationsController do
  # Save and restore the memoized dataset so these tests, which drive it
  # directly, can't leak into specs that rely on the real committed dataset.
  around do |example|
    prior = GasStationsController.instance_variable_get(:@stations)
    example.run
    GasStationsController.instance_variable_set(:@stations, prior)
  end

  def dataset(json)
    allow(File).to receive(:read).and_call_original
    allow(File).to receive(:read).with(GasStationsController::DATA_PATH).and_return(json)
  end

  describe ".reload_stations!" do
    it "re-reads the dataset from disk and swaps the in-memory copy" do
      dataset([ { id: "x", name: "First", lat: 1.0, lng: 2.0 } ].to_json)
      GasStationsController.reload_stations!
      expect(GasStationsController.stations.map { |s| s[:name] }).to eq([ "First" ])

      dataset([ { id: "y", name: "Second", lat: 3.0, lng: 4.0 },
                 { id: "z", name: "Third", lat: 5.0, lng: 6.0 } ].to_json)
      GasStationsController.reload_stations!
      expect(GasStationsController.stations.map { |s| s[:name] }).to eq([ "Second", "Third" ])
    end

    it "symbolizes keys and freezes the loaded dataset" do
      dataset([ { id: "x", name: "First", lat: 1.0, lng: 2.0 } ].to_json)
      GasStationsController.reload_stations!

      expect(GasStationsController.stations.first).to include(id: "x", name: "First")
      expect(GasStationsController.stations).to be_frozen
    end
  end

  describe "when the dataset is unavailable" do
    it "returns [] when the dataset file is missing" do
      allow(File).to receive(:read).and_call_original
      allow(File).to receive(:read).with(GasStationsController::DATA_PATH).and_raise(Errno::ENOENT)

      GasStationsController.reload_stations!

      expect(GasStationsController.stations).to eq([])
    end

    it "returns [] when the dataset file is corrupt" do
      dataset("{ not valid json ]")

      GasStationsController.reload_stations!

      expect(GasStationsController.stations).to eq([])
    end

    it "logs a warning explaining why the dataset couldn't load" do
      allow(Rails.logger).to receive(:warn)
      allow(File).to receive(:read).and_call_original
      allow(File).to receive(:read).with(GasStationsController::DATA_PATH).and_raise(Errno::ENOENT)

      GasStationsController.reload_stations!

      expect(Rails.logger).to have_received(:warn).with(/dataset unavailable/)
    end
  end
end
