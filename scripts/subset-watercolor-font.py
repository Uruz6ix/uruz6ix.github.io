"""Build the self-hosted UI font from Google's NotoSansSC[wght].ttf.

Requires fonttools and brotli only when rebuilding the checked-in font.
Usage: python scripts/subset-watercolor-font.py /path/to/NotoSansSC.ttf
"""
from pathlib import Path
import re
import sys
from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parent.parent
sources = [root / "_includes/watercolor-app.html", root / "_page/watercolor.html", root / "_page/watercolor-en.html", *list((root / "assets/interactive/watercolor/js").glob("*.js"))]
text = "".join(path.read_text(encoding="utf-8") for path in sources)
characters = set(chr(code) for code in range(32, 127))
characters.update(re.findall(r"[\u3400-\u9fff]", text))
characters.update("×←↗↓")
font = TTFont(sys.argv[1])
options = subset.Options()
options.flavor = "woff2"
options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14, 16, 17]
options.name_languages = [0x409, 0x804]
subsetter = subset.Subsetter(options=options)
subsetter.populate(text="".join(sorted(characters)))
subsetter.subset(font)
font.flavor = "woff2"
output = root / "assets/interactive/watercolor/fonts/noto-sans-sc-ui.woff2"
font.save(output)
assert all(ord(char) in font.getBestCmap() for char in characters)
print(f"{output.name}: {output.stat().st_size} bytes, {len(characters)} characters")
