#!/bin/zsh
# Refresh this folder's copy of score-reader.js from Handpan Studio, with the source commit in the
# header. COPIED, NOT SHARED: run this deliberately, never automatically.
cd "$(dirname "$0")/.." || exit 1
C=$(git rev-parse --short HEAD) || exit 1
D=$(git log -1 --format=%ad --date=format:'%d %b %Y')
python3 - "$C" "$D" <<'PY'
import sys
c,d=sys.argv[1],sys.argv[2]
src=open("score-reader.js",encoding="utf-8").read()
body=src[src.index("(function(root){"):]
head=src[:src.index("(function(root){")]
first=head[head.index("\n")+1:]
out=("/* score-reader.js — reads engraved staff notation from a bitmap.\n\n"
 f"   COPIED, NOT SHARED. Source: Handpan Studio, score-reader.js at commit {c} ({d}).\n"
 "   Fixes made here do not travel back on their own, and neither do fixes made there: port them\n"
 "   deliberately, one at a time, and say which commit you took. Refresh with copy-reader.command.\n\n"
 "   Everything below is the original file. It knows nothing about any instrument: it reads a\n"
 "   picture of printed music and says what is on the page.\n"+first+body)
open("score-to-midi/score-reader.js","w",encoding="utf-8").write(out)
print("score-to-midi/score-reader.js <- commit",c)
PY
