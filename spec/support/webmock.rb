require "webmock/rspec"

# Block all real outbound HTTP during the suite, but allow localhost so the
# in-process Capybara/Rails server (and its asset requests) keep working.
WebMock.disable_net_connect!(allow_localhost: true)
