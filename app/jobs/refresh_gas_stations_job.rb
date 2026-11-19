# Re-fetches the SF gas-station dataset from Overture Maps and reloads it into
# the running process. Scheduled daily (config/initializers/gas_stations_refresh.rb)
# and runnable by hand with `bin/rails gas_stations:refresh`.
#
# Failures are logged and swallowed so a transient Overture/network problem (or
# a host without the Python generator available) never crashes the scheduler or
# a request; the previously loaded dataset keeps serving.
class RefreshGasStationsJob < ApplicationJob
  queue_as :default

  def perform
    output = GasStations::Refresher.new.call
    Rails.logger.info(
      "[gas_stations] refreshed #{GasStationsController.stations.size} stations #{output}".strip
    )
  rescue => e
    Rails.logger.error("[gas_stations] refresh failed: #{e.class}: #{e.message}")
  end
end
