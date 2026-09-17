### Environment

- **Date:** 2026-09-17T06:54:18.505Z
- **OS:** Windows_NT 10.0.26200 (x64)
- **CPU:** Intel(R) Core(TM) i5-7500 CPU @ 3.40GHz (4 threads)
- **RAM:** 15.8 GB
- **Electron:** 44.3.0
- **Method:** end-to-end `runEngine` round trip through the Electron IPC bridge (worker + disk I/O included), 3 measured iterations after 1 warmup; median reported.

| Group | Operation | Input | Median (ms) | Min (ms) | Max (ms) | Output (KB) |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| Images | image.convert 1MP | 1.0 MP (1000×1000) | 57 | 56 | 100 | 599 |
| Images | image.convert 4MP | 4.0 MP (2000×2000) | 206 | 203 | 206 | 2382 |
| Images | image.convert 8MP | 8.0 MP (2828×2828) | 260 | 256 | 272 | 4676 |
| Images | image.compress 8MP | 8.0 MP (2828×2828) | 404 | 399 | 410 | 156 |
| Images | image.resize 8MP → 1280 | 8.0 MP (2828×2828) | 281 | 280 | 283 | 5003 |
| Archives | zip.create 1MB | 1.00 MB | 74 | 71 | 75 | 1024 |
| Archives | zip.create 6MB | 6.00 MB | 404 | 393 | 406 | 6146 |
| Archives | computeHash 6MB | 6.00 MB | 28 | 28 | 29 | — |
| PDF | pdf.merge 2 pages | — | 6 | 5 | 8 | 2 |
| PDF | pdf.merge 10 pages | — | 7 | 7 | 9 | 5 |

