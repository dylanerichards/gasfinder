# Deploying GasFinder to Heroku

GasFinder is a Rails 8 + Vite (vite_rails) + React 19 + Tailwind v4 app. Node is
needed at build time (Vite builds the frontend); Ruby runs the app. Production
uses PostgreSQL.

This repo is already prepared for Heroku:

- `Procfile` — `web` (Puma) + `release` (runs `rails db:migrate` on each deploy).
- `app.json` — declares the buildpacks (Node then Ruby), the Postgres add-on, and env vars.
- `.node-version` — pins Node `24.14.0` for the Node buildpack.
- `Gemfile` — `pg` in the `:production` group; `sqlite3` stays in `:development, :test`.
- `config/database.yml` — production reads `DATABASE_URL` (Postgres); dev/test stay SQLite.
- `config/environments/production.rb` — serves static files, forces SSL, uses in-process
  cache/queue adapters (no Solid multi-DB setup).

## Prerequisites

- Heroku CLI installed and logged in (`heroku login`).
- This directory is a git repo with a `main` branch and at least one commit.
- You have the contents of `config/master.key` (NOT committed — it is gitignored).

## One-time setup

```sh
# From the repo root: /Users/dylanerichards/code/gasfinder

# 1. Create the app (optionally pass a name, e.g. `heroku create gasfinder-app`).
heroku create

# 2. Set the buildpacks IN ORDER. Node MUST run before Ruby so Vite can build
#    the frontend during `assets:precompile`. (app.json also declares this, but
#    setting them explicitly is the reliable path for a plain `git push`.)
heroku buildpacks:clear
heroku buildpacks:add heroku/nodejs
heroku buildpacks:add heroku/ruby
heroku buildpacks   # verify: 1. heroku/nodejs  2. heroku/ruby

# 3. Provision Postgres (sets DATABASE_URL automatically).
heroku addons:create heroku-postgresql:essential-0

# 4. Set the Rails master key (decrypts credentials). Paste the contents of
#    config/master.key — this file is gitignored and must NOT be committed.
heroku config:set RAILS_MASTER_KEY=$(cat config/master.key)

# 5. Recommended runtime env (app.json sets these on `heroku create` from a
#    GitHub deploy, but set them explicitly for a plain git push):
heroku config:set RAILS_ENV=production RACK_ENV=production \
  RAILS_LOG_TO_STDOUT=enabled RAILS_SERVE_STATIC_FILES=true
```

## Deploy

```sh
git push heroku main
```

On each push, Heroku: runs the Node buildpack (installs npm deps), then the Ruby
buildpack (`bundle install`, then `assets:precompile` which runs `vite build` via
the vite_rails hook), then the `release` phase (`rails db:migrate`), then boots
the `web` dyno.

```sh
heroku open          # open the deployed app
heroku logs --tail   # watch logs if anything looks off
```

`rails db:migrate` runs automatically in the `release` phase. There are no
migrations yet (no models), so it is a no-op until you add some — no manual
`heroku run rails db:migrate` is needed.

## Notes / decisions

- **Database:** The app shipped with SQLite (Rails 8 default), but Heroku's
  filesystem is ephemeral, so SQLite files would be wiped on every dyno
  restart/deploy. Production now uses Postgres via `DATABASE_URL`, mirroring the
  sibling EHA app. SQLite remains the dev/test database, so local workflow is
  unchanged.
- **No background jobs / websockets:** Cache, Active Job, and Action Cable use
  in-process adapters (`:memory_store`, `:async`, `async`) in production, so no
  extra Postgres databases are needed. If you later add background jobs, follow
  EHA's pattern: run Solid Queue on the primary database, add a
  `worker: bundle exec bin/jobs` line to the `Procfile`, add a
  `create_solid_queue_tables` migration, and switch the queue adapter back to
  `:solid_queue`.
- **Host authorization:** `config.hosts` is left at the Rails production default
  (unset = all hosts allowed), so `*.herokuapp.com` works out of the box. If you
  later lock it down, add your Heroku host and any custom domain to
  `config.hosts` in `config/environments/production.rb`, and exclude the `/up`
  health check.
- **Node version:** Pinned via `.node-version` (24.14.0). `package.json` has no
  `engines` field; if you prefer to pin there too, add `"engines": { "node":
  "24.x" }` (package.json is outside this deploy-prep change set).
- **master.key:** gitignored. It must be provided to Heroku as `RAILS_MASTER_KEY`
  (step 4) or the app cannot decrypt credentials and will fail to boot.

## Verified locally

`SECRET_KEY_BASE=dummy RAILS_ENV=production bin/rails assets:precompile` succeeds:
Vite builds the React/Tailwind frontend into `public/vite` and propshaft compiles
assets into `public/assets` (exit 0). Generated artifacts were cleaned up and are
gitignored.
