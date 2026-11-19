namespace :gas_stations do
  desc "Re-fetch the SF gas stations from Overture Maps and reload the dataset"
  task refresh: :environment do
    RefreshGasStationsJob.perform_now
  end
end
