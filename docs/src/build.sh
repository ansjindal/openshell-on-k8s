#!/bin/bash
# Regenerate docs/*.svg from these scripts:  bash docs/src/build.sh
# (Coordinates are laid out by hand; the scripts warn on overflowing or
#  overlapping text.) The training site restyles them for its theme.
set -e
H=$(cd "$(dirname "$0")"; pwd); D=$(dirname "$H")
python3 "$H/arch.py" "$D/architecture.svg"
python3 "$H/anatomy.py" "$D/sandbox-anatomy.svg"
python3 "$H/cred.py" "$D/credential-flow.svg"
python3 "$H/cluster.py" "$D/cluster.svg"
