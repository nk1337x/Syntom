#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

export LD_LIBRARY_PATH=/mnt/d/Projects/Syntom/Post_Quantum_Cryptography/lib/liboqs/build/lib:$LD_LIBRARY_PATH

export OQS_INSTALL_PATH=/mnt/d/Projects/Syntom/Post_Quantum_Cryptography/lib/liboqs/build

"$DIR/venv/bin/python3" "$DIR/app.py"
