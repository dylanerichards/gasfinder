# Scheduled in-process refresh of the gas-station dataset from Overture Maps.
#
# Overture publishes a new release roughly monthly, so there's nothing to gain
# from polling faster than that: a monthly cron captures essentially all the
# freshness for a once-a-month cost. Enabled only when GAS_STATION_REFRESH_CRON
# is set, so dev, test, and CI never spawn scheduler threads. On the single web
# dyno this regenerates db/sf_gas_stations.json and the controller reloads it,
# with no separate worker or database.
#
#   heroku config:set GAS_STATION_REFRESH_CRON="0 9 1 * *"   # 09:00 UTC, 1st of the month
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
