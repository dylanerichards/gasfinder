# Be sure to restart your server when you modify this file.
#
# Content Security Policy. The app proxies every third-party API (geocoding,
# routing) through same-origin endpoints, so the browser only ever connects to
# 'self'. The only cross-origin resources are Google Fonts (the stylesheet and
# font files) and OpenStreetMap map tiles. Scripts are same-origin only.
Rails.application.configure do
  config.content_security_policy do |policy|
    policy.default_src      :self
    policy.base_uri         :self
    policy.object_src       :none
    policy.frame_ancestors  :self
    policy.form_action      :self
    policy.script_src       :self
    policy.style_src        :self, :unsafe_inline, "https://fonts.googleapis.com"
    policy.font_src         :self, :data, "https://fonts.gstatic.com"
    policy.img_src          :self, :data, "https://*.tile.openstreetmap.org"
    policy.connect_src      :self

    if Rails.env.development?
      # Vite dev server: inline refresh preamble, eval, and the HMR websocket.
      vite = ViteRuby.config.host_with_port
      policy.script_src(*policy.script_src, :unsafe_eval, :unsafe_inline, "http://#{vite}")
      policy.connect_src(*policy.connect_src, "http://#{vite}", "ws://#{vite}")
    end
  end
end
