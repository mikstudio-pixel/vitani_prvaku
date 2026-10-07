# Vítání prváků

This repository is a standalone browser copy of the Designblok application.
Never modify, deploy, rebuild or connect to the Designblok exhibition project,
its native iPads, its Mac operator panel, or its hosting project from this repo.
Do not introduce native iOS/macOS build scripts or update packages.
Keep internal events under `vitani-prvaku:`; never subscribe to `michas:` events.
Keep browser storage keys under `vitani-prvaku.`; never migrate or clear the
original application's `michas.*` settings. Deploy only to this repository's
GitHub Pages path, `/vitani_prvaku/`.

Open PRs ready for review. Resolve applicable Codex, CodeRabbit and Macroscope
feedback on the current HEAD before remote CI. If CodeRabbit is out of capacity,
do not wait for it. Run `tests.yml` once after reviews are clean and wait for it
to pass. Recheck all review threads and pending reviews before finishing.
