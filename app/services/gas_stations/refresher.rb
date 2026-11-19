require "open3"

module GasStations
  # Regenerates db/sf_gas_stations.json from Overture Maps by running the
  # generator script, then reloads the controller's in-memory dataset so the
  # running process serves the fresh data. Invoked by RefreshGasStationsJob.
  class Refresher
    class RefreshError < StandardError; end

    SCRIPT = Rails.root.join("script", "fetch_sf_gas_stations.py").to_s

    # Which interpreter runs the generator. Defaults to a project virtualenv if
    # present (overturemaps can't be installed globally under Homebrew Python),
    # else plain python3. Override with OVERTURE_PYTHON.
    def self.python
      ENV["OVERTURE_PYTHON"].presence ||
        [ Rails.root.join(".venv/bin/python").to_s ].find { |p| File.executable?(p) } ||
        "python3"
    end

    def call
      output, status = Open3.capture2e(self.class.python, SCRIPT)
      unless status.success?
        raise RefreshError, output.strip.presence || "generator exited #{status.exitstatus}"
      end

      GasStationsController.reload_stations!
      output.strip
    end
  end
end
