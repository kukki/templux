# Project-owned skeleton

Business files, configuration, independent version and deployment skeleton belong to this project. Shared implementation is installed from locked vendor tarballs. Preserve templux.lock.json, package-lock.json and .templux/baseline for reviewed upgrades. See the release contract in the template distribution.


## Startup and domain access

Use a complete verified release project (vendor, exact locks and pristine baseline), not this bare source skeleton. For local development, copy `.env.example` to a private `.env` without overwriting existing configuration and run `./templux env-check --json` before `./templux start --json`. `env-list` reports keys/status only, never values.

For an existing Ubuntu Traefik deployment, set a unique project name/environment, `DOMAIN_NAME` (optional root), `APP_HOST` (full project hostname), HTTPS `APP_PUBLIC_URL`, `NETWORK_NAME` and the exact Traefik peer in `ENTRY_TRUSTED_PROXY_CIDRS`. Use `TEMPLUX_TRAEFIK=1 ./templux ...`, or both Compose files; only entry:8080 joins the existing external network. No new certificate resolver, proxy or host ports are provisioned. The distribution's Ubuntu testing guide covers real TLS/maintenance checks; local container evidence does not certify your Ubuntu host.

`.env.example` is a public, versioned deployment sample: keep real assignments only in `.env` or controlled external configuration. Public sample changes use reviewed three-way upgrades; private environment files never enter proposals or catalogs. Do not remove required metadata or overwrite project business/configuration during an upgrade.
