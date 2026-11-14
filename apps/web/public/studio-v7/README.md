# Portal V7

Open `/studio-v7/compare.html` from the web app to compare Folio, Atelier,
Index, Commons, and Studio. Each preview uses sample data and supports light
and dark themes, role switching, and mobile navigation.

To review the preview independently, run `python3 -m http.server 5181` from
this directory and open `http://localhost:5181/compare.html`.

Run `python3 build.py` after editing the shared JavaScript or CSS to rebuild
the preview pages. This repository copy uses system font fallbacks.
