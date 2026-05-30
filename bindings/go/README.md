# rdapify (Go binding) — ⚠️ EXPERIMENTAL STUB

> **Status: experimental / not built or tested in CI.**
> Do **not** depend on this binding in production. It is a hand-written CGo
> sketch kept for design reference until a real C-ABI target ships.

## Why it is a stub

This package links against a C shared/static library via CGo:

```go
/*
#cgo LDFLAGS: -lrdapify
#include "rdapify.h"
*/
import "C"
```

…but **no crate in the workspace currently produces a `librdapify`
cdylib/staticlib**. Both `rdapify` and `rdapify-client` are compiled as `rlib`
only, so the `-lrdapify` link step cannot resolve. `rdapify.h` is maintained by
hand and is **not** generated from the Rust source, so it can drift from the
actual ABI without any check catching it.

## Why there is no CI gate

A prior `go-binding-build` job in `.github/workflows/ci.yml` ran `go vet ./...`
against this directory. `go vet` validates **CGo syntax only** — it never
invokes the C linker — so it always passed regardless of whether a real
`librdapify` existed. That produced a misleading "green" check implying a
working C-ABI backstop that does not exist. The job has been **removed** to
prevent false compliance.

## What is required to graduate this binding

Before re-enabling a real (link-tested) CI job, the following must land:

1. A crate exposing a stable C ABI with `crate-type = ["cdylib", "staticlib"]`
   that actually builds a `librdapify.{so,a,dylib}`.
2. A generated (not hand-written) `rdapify.h` — e.g. via `cbindgen` — kept in
   sync by CI.
3. A CI job that **builds and links** (`go build ./...` against the real
   library), not merely `go vet`.

Until all three exist, treat this directory as a design stub only.
