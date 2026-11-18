require "rails_helper"

RSpec.describe "GET /", type: :request do
  it "responds with 200 and renders the React mount point" do
    get "/"

    expect(response).to have_http_status(:ok)
    expect(response.body).to include('id="react-root"')
  end
end
