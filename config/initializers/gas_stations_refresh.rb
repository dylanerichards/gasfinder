# Daily in-process refresh of the gas-station dataset from Overture Maps.
#
# Enabled only when GAS_STATION_REFRESH_CRON is set to a cron expression, so dev,
# test, and CI never spawn scheduler threads. On Heroku's single web dyno this
# refreshes the in-memory dataset once a day with no separate worker or database:
# the job regenerates db/sf_gas_stations.json and the controller reloads it.
#
#   heroku config:set GAS_STATION_REFRESH_CRON="0 9 * * *"   # 09:00 UTC daily
#
# (The generator needs the Overture Python tooling available on the dyno; without
# it the job logs a failure and keeps serving the committed dataset.)
cron = ENV["GAS_STATION_REFRESH_CRON"]

if cron.present? && !Rails.env.test?
  require "rufus-scheduler"

  Rails.application.config.after_initialize do
    begin
      Rufus::Scheduler.singleton.cron(cron) do
        RefreshGasStationsJob.perform_later
      end
    rescue => e
      Rails.logger.error("[gas_stations] could not schedule refresh (#{cron.inspect}): #{e.class}: #{e.message}")
    end
  end
end
