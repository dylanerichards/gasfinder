require "capybara/rspec"
require "capybara/cuprite"

# Prefer the installed Google Chrome; fall back to Ferrum's autodetection.
CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome".freeze

Capybara.register_driver(:cuprite) do |app|
  options = {
    window_size: [1280, 900],
    # Give the first run room to trigger the Vite build and boot Chrome.
    process_timeout: 120,
    timeout: 30,
    headless: true,
    js_errors: false,
    browser_options: { "no-sandbox": nil }
  }
  options[:browser_path] = CHROME_PATH if File.exist?(CHROME_PATH)
  Capybara::Cuprite::Driver.new(app, **options)
end

# Serve the in-process app so WebMock can intercept its outbound HTTP.
Capybara.server = :puma, { Silent: true }
Capybara.javascript_driver = :cuprite
Capybara.default_max_wait_time = 10
