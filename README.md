# BETA v BET on Render

Upload the contents of this folder to a GitHub repo, then Render > New > Web Service > pick the repo.
render.yaml sets the build: it installs, then fetch-games.mjs downloads each game's source from GitHub
(games-source.json lists them) into games/. The first build takes several minutes.

Custom domain (FreeDNS): Render > Settings > Custom Domains > add yourname.mooo.com,
then on FreeDNS add an A record to 216.24.57.1 and click Verify in Render. No AAAA record.
